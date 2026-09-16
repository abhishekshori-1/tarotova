import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CARDS } from "@/content/cards";
import { GENERATION_REQUEST_DEADLINE_MS, getGenerationConfig } from "@/server/generation/config";
import { FOLLOWUP_GROUNDING_VERSION } from "@/server/generation/grounding-prompts";
import { applyRepairDetailed, followupShape, parseReviewFor } from "@/server/generation/reviewed";
import { getGenerationProvider, providerByKind } from "@/server/generation/service";
import type { FollowupInput, FollowupOutput, GenerationProvider, GroundingIssue, GroundingReview, TokenUsage } from "@/server/generation/types";
import { validateFollowup } from "@/server/generation/validate";
import fixtures from "./repair-cases.json";
import { costSummary, type CostCall } from "./cost";

/**
 * Fixed-candidate diagnostic (docs/RELEASE-C.md): the same drafts and the same
 * issue lists every time, so reviewer consistency and repair quality can be
 * read apart from changing writer output. Nothing here publishes anything.
 *
 * - Consistency: each draft and each repaired candidate is re-reviewed
 *   DIAGNOSTIC_REVIEWS times by the configured reviewer, unchanged settings.
 *   Each original finding is counted by how often it recurs, next to its
 *   hand adjudication; findings not in the original are counted as new.
 * - Repair: each repairer in DIAGNOSTIC_REPAIRERS repairs every draft from
 *   the original first review's issues, under the same contract as
 *   production (one repair, flagged fields only), and the result gets
 *   DIAGNOSTIC_REPAIR_REVIEWS fresh reviews. Published cases are included so
 *   an improvement on the withheld three cannot hide damage elsewhere.
 */
type Adjudicated = GroundingIssue & { adjudication: string; note: string };
interface Case { id: string; outcome: string; source: { conversation: string; turn: number; initialAnswer: string }; input: FollowupInput; draft: FollowupOutput; firstReview: GroundingReview & { issues: Adjudicated[] }; repaired: FollowupOutput | null; secondReview: (GroundingReview & { issues: Adjudicated[] }) | null }
const CASES = fixtures.cases as unknown as Case[];
const REVIEWS = Number(process.env.DIAGNOSTIC_REVIEWS ?? 3);
const REPAIR_REVIEWS = Number(process.env.DIAGNOSTIC_REPAIR_REVIEWS ?? 2);
const REPAIRERS = (process.env.DIAGNOSTIC_REPAIRERS ?? "deepseek,gemini").split(",").map((s) => s.trim()).filter(Boolean);

process.env.GENERATION_PROVIDER ||= "deepseek,gemini";
const config = getGenerationConfig();
const reviewer = config.reviewProvider ? getGenerationProvider(config) : undefined;
const repairers = new Map<string, GenerationProvider>();
for (const kind of REPAIRERS) { const p = providerByKind(kind, config); if (p) repairers.set(kind, p); else console.warn(`repairer ${kind} unavailable (no key)`); }
const usable = !!reviewer && repairers.size > 0;
if (!usable) console.warn(`repair diagnostic skipped — ${config.configurationProblem ?? "reviewer or repairers unavailable"}`);

type ReviewRun = { decision: string; issues: GroundingIssue[]; ms: number; model?: string; usage?: TokenUsage; reason?: string; detail?: string };
type RepairRun = { kind: string; applied: boolean; detail?: string; fields: string[]; candidate?: FollowupOutput; reviews: ReviewRun[]; ms: number; model?: string; usage?: TokenUsage; reason?: string };
const consistency = new Map<string, { draft: ReviewRun[]; repaired: ReviewRun[] }>();
const repairs = new Map<string, RepairRun[]>();

/** A re-review finding "recurs" an original one when it names the same field and one quote contains the other. */
const recurs = (original: GroundingIssue, found: GroundingIssue) => original.field === found.field && (found.quote.includes(original.quote) || original.quote.includes(found.quote));

async function review(input: FollowupInput, answer: FollowupOutput): Promise<ReviewRun> {
  const startedAt = Date.now();
  const result = await reviewer!.reviewFollowup(input, answer, { deadlineAt: startedAt + GENERATION_REQUEST_DEADLINE_MS });
  const parsed = result.ok ? parseReviewFor(followupShape(input), result.value, answer) : undefined;
  return { decision: parsed?.decision ?? (result.ok ? "invalid" : result.reason), issues: parsed?.issues ?? [], ms: Date.now() - startedAt, ...(result.ok ? { model: result.model, usage: result.usage } : { reason: result.reason, detail: result.detail }) };
}

describe.skipIf(!usable)("repair diagnostic — fixed candidates", () => {
  beforeAll(async () => {
    for (const c of CASES) {
      console.info(`case: ${c.id}`);
      const runs = { draft: [] as ReviewRun[], repaired: [] as ReviewRun[] };
      for (let i = 0; i < REVIEWS; i++) runs.draft.push(await review(c.input, c.draft));
      const broken = runs.draft.find((r) => r.reason);
      if (broken) throw new Error(`reviewer failing (${broken.reason}${broken.detail ? `: ${broken.detail}` : ""}); stopping before paying for more calls`);
      if (c.repaired) for (let i = 0; i < REVIEWS; i++) runs.repaired.push(await review(c.input, c.repaired));
      consistency.set(c.id, runs);
      const shape = followupShape(c.input);
      const list: RepairRun[] = [];
      for (const [kind, provider] of repairers) {
        const startedAt = Date.now();
        const result = await provider.repairFollowup(c.input, c.draft, c.firstReview.issues, { deadlineAt: startedAt + GENERATION_REQUEST_DEADLINE_MS });
        const run: RepairRun = { kind, applied: false, fields: [], reviews: [], ms: Date.now() - startedAt, ...(result.ok ? { model: result.model, usage: result.usage } : { reason: result.reason }) };
        if (result.ok) {
          const applied = applyRepairDetailed(shape, result.value, c.draft, c.firstReview);
          if (!applied.ok) run.detail = applied.detail;
          else {
            const valid = validateFollowup(applied.value, c.input.cards.map((card) => CARDS.find((x) => x.name === card.name)!.id));
            if (!valid.ok) run.detail = `validate: ${valid.reason}${valid.detail ? `: ${valid.detail}` : ""}`;
            else {
              run.applied = true;
              run.candidate = applied.value;
              run.fields = (["paragraph_1", "paragraph_2", "paragraph_3", "reflection", "beyondSpread"] as const).filter((f) => shape.fieldText(applied.value, f) !== shape.fieldText(c.draft, f));
              for (let i = 0; i < REPAIR_REVIEWS; i++) run.reviews.push(await review(c.input, applied.value));
            }
          }
        }
        list.push(run);
      }
      repairs.set(c.id, list);
    }
    writeReport();
  });

  it("re-reviews every fixed candidate the configured number of times", () => {
    for (const c of CASES) expect(consistency.get(c.id)?.draft).toHaveLength(REVIEWS);
  });

  it("runs every repairer on every case", () => {
    for (const c of CASES) expect(repairs.get(c.id)?.map((r) => r.kind)).toEqual([...repairers.keys()]);
  });
});
if (!usable) it("skipped: needs a reviewer and at least one repairer with a key", () => {});

function writeReport() {
  const dir = path.resolve(process.cwd(), "eval", "report");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines: string[] = [`# Repair diagnostic on fixed candidates — ${stamp}`, "",
    `Reviewer: ${config.reviewProvider?.kind} (${config.reviewProvider?.models.answer}) · review prompt \`${FOLLOWUP_GROUNDING_VERSION}\` · cache ${config.reviewProvider?.promptCache ?? "off"} · ${REVIEWS} re-reviews per candidate · repairers: ${[...repairers.keys()].join(", ")} · ${REPAIR_REVIEWS} fresh reviews per repair`, "",
    "Cases come from eval/repair-cases.json, lifted from a conversation report; the initial answers marked `regenerated` were produced once for the fixture and are not the ones the run's reviewer saw. Nothing here publishes.", ""];

  lines.push("## Reviewer consistency", "", "For each original finding: its hand adjudication and how many of the re-reviews of the identical candidate raised it again. `new` counts findings the original review did not make.", "");
  lines.push("| Case | Candidate | Decisions | Finding (field) | Adjudication | Recurred | ", "| --- | --- | --- | --- | --- | ---: |");
  for (const c of CASES) {
    const runs = consistency.get(c.id)!;
    const rows: [string, ReviewRun[], Adjudicated[]][] = [["draft", runs.draft, c.firstReview.issues]];
    if (c.repaired && c.secondReview) rows.push(["repaired", runs.repaired, c.secondReview.issues]);
    for (const [label, list, originals] of rows) {
      const decisions = list.map((r) => r.decision + (r.detail ? ` (${r.detail.slice(0, 80)})` : "")).join(" · ");
      for (const o of originals) lines.push(`| ${c.id} | ${label} | ${decisions} | ${o.field}: "${o.quote.slice(0, 70)}${o.quote.length > 70 ? "…" : ""}" | ${o.adjudication} | ${list.filter((r) => r.issues.some((f) => recurs(o, f))).length} / ${list.length} |`);
      const fresh = list.flatMap((r) => r.issues.filter((f) => !originals.some((o) => recurs(o, f))));
      lines.push(`| ${c.id} | ${label} | ${decisions} | new findings across re-reviews | — | ${fresh.length} |`);
    }
  }
  lines.push("", "### New findings, verbatim", "");
  for (const c of CASES) {
    const runs = consistency.get(c.id)!;
    for (const [label, list, originals] of [["draft", runs.draft, c.firstReview.issues], ["repaired", runs.repaired, c.secondReview?.issues ?? []]] as [string, ReviewRun[], Adjudicated[]][]) {
      for (const [i, r] of list.entries()) for (const f of r.issues) if (!originals.some((o) => recurs(o, f))) lines.push(`- ${c.id} / ${label} / re-review ${i + 1}: **${f.field}** "${f.quote}": ${f.reason}`);
    }
  }

  lines.push("", "## Repair comparison", "", "Same draft, same issue list, one repair each; then fresh reviews of the result. A valid correction is a repair that applied within the contract and passed every fresh review; `edited` lists the fields changed.", "");
  lines.push("| Case | Outcome in run | Repairer | Applied | Edited | Fresh decisions | ms | Model |", "| --- | --- | --- | --- | --- | --- | ---: | --- |");
  for (const c of CASES) for (const r of repairs.get(c.id) ?? []) lines.push(`| ${c.id} | ${c.outcome} | ${r.kind} | ${r.applied ? "yes" : `no (${r.detail ?? r.reason})`} | ${r.fields.join(", ")} | ${r.reviews.map((x) => x.decision).join(" · ") || "—"} | ${r.ms} | ${r.model ?? ""} |`);
  const summary = [...repairers.keys()].map((kind) => {
    const runs = CASES.map((c) => repairs.get(c.id)!.find((r) => r.kind === kind)!);
    const valid = runs.filter((r) => r.applied && r.reviews.length && r.reviews.every((x) => x.decision === "pass")).length;
    const applied = runs.filter((r) => r.applied).length;
    const ms = Math.round(runs.reduce((s, r) => s + r.ms, 0) / runs.length);
    return `| ${kind} | ${applied} / ${runs.length} | ${valid} / ${runs.length} | ${ms} |`;
  });
  lines.push("", "| Repairer | Applied within contract | Valid corrections (all fresh reviews pass) | Mean repair ms |", "| --- | ---: | ---: | ---: |", ...summary, "");
  lines.push("### Fresh-review findings on repaired candidates", "");
  for (const c of CASES) for (const r of repairs.get(c.id) ?? []) for (const [i, x] of r.reviews.entries()) for (const f of x.issues) lines.push(`- ${c.id} / ${r.kind} / fresh review ${i + 1}: **${f.field}** "${f.quote}": ${f.reason}`);
  lines.push("", "### Repaired candidates", "");
  for (const c of CASES) for (const r of repairs.get(c.id) ?? []) if (r.candidate) { lines.push(`#### ${c.id} — ${r.kind}`, ""); for (const p of r.candidate.paragraphs) lines.push(p, ""); if (r.candidate.reflection) lines.push(`_${r.candidate.reflection}_`, ""); if (r.candidate.beyondSpread) lines.push(`**Beyond the spread.** ${r.candidate.beyondSpread}`, ""); }

  const calls: CostCall[] = [];
  for (const c of CASES) {
    const runs = consistency.get(c.id)!;
    for (const r of [...runs.draft, ...runs.repaired]) calls.push({ phase: "review", model: r.model, usage: r.usage });
    for (const r of repairs.get(c.id) ?? []) { calls.push({ phase: `repair:${r.kind}`, model: r.model, usage: r.usage }); for (const x of r.reviews) calls.push({ phase: "review", model: x.model, usage: x.usage }); }
  }
  lines.push("## Cost accounting", "", ...costSummary(calls, "Diagnostic"));
  writeFileSync(path.join(dir, `repair-diagnostic-${stamp}.md`), lines.join("\n"));
  console.info(`diagnostic report written to eval/report/repair-diagnostic-${stamp}.md`);
}
