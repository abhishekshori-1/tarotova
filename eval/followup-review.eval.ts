import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CARDS } from "@/content/cards";
import type { Focus, Position } from "@/content/types";
import { GENERATION_REQUEST_DEADLINE_MS, getGenerationConfig } from "@/server/generation/config";
import { buildFollowupInput } from "@/server/generation/followups";
import { FOLLOWUP_GROUNDING_VERSION } from "@/server/generation/grounding-prompts";
import { followupShape, parseReviewFor } from "@/server/generation/reviewed";
import { getGenerationProvider } from "@/server/generation/service";
import type { FollowupOutput, TokenUsage } from "@/server/generation/types";
import fixtures from "./followup-review-fixtures.json";
import { costSummary, type CostCall } from "./cost";
import { caughtRequiredIssue, type RequiredIssue } from "./calibration";

// Reviewer-only calibration for follow-ups (docs/RELEASE-C.md): matched pairs
// where one answer must pass and its twin must be sent back. Measures false
// rejections as well as misses. Cheap: one review call per fixture.

interface Fixture { id: string; pairedWith: string; expected: "pass" | "revise"; behaviour: string; focus: Focus; cards: [string, string, string]; originalQuestion: string; latest: string; answer: FollowupOutput; requiredIssue?: RequiredIssue }
const FIXTURES = fixtures.fixtures as Fixture[];
const POSITIONS: Position[] = ["situation", "challenge", "guidance"];

process.env.GENERATION_PROVIDER ||= "deepseek,gemini";
const config = getGenerationConfig();
const usable = !!config.reviewProvider;
if (!usable) console.warn(`follow-up review calibration skipped — ${config.configurationProblem ?? "no reviewer"}`);

const results = new Map<string, { decision: string; issues?: { field: string; quote: string; reason: string }[]; model?: string; ms: number; usage?: TokenUsage; reason?: string }>();

describe.skipIf(!usable)("follow-up reviewer calibration", () => {
  const provider = getGenerationProvider(config)!;

  beforeAll(async () => {
    for (const f of FIXTURES) {
      console.info(`calibration: ${f.id}`);
      const snapshot = { focus: f.focus, cards: f.cards.map((id, i) => { const card = CARDS.find((x) => x.id === id)!; return { position: POSITIONS[i], id: card.id, name: card.name, numeral: card.numeral, keywords: card.keywords, coreMeaning: card.coreMeaning, interpretation: card.position[POSITIONS[i]], focusNote: card.focus[f.focus] }; }) };
      const input = buildFollowupInput(snapshot, f.originalQuestion, null, [], f.latest, "none");
      const startedAt = Date.now();
      const result = await provider.reviewFollowup(input, f.answer, { deadlineAt: startedAt + GENERATION_REQUEST_DEADLINE_MS });
      const review = result.ok ? parseReviewFor(followupShape(input), result.value, f.answer) : undefined;
      results.set(f.id, { decision: review?.decision ?? (result.ok ? "invalid" : result.reason), issues: review?.issues, ms: Date.now() - startedAt, ...(result.ok ? { model: result.model, usage: result.usage } : { reason: result.reason }) });
    }
    writeReport();
  });

  it("passes every grounded answer", () => {
    expect(FIXTURES.filter((f) => f.expected === "pass" && results.get(f.id)?.decision !== "pass").map((f) => `${f.id}: got ${results.get(f.id)?.decision} — ${results.get(f.id)?.issues?.map((i) => i.reason).join(" | ")}`)).toEqual([]);
  });

  it("sends back every answer that breaks the rule its pair keeps", () => {
    expect(FIXTURES.filter((f) => f.expected === "revise" && results.get(f.id)?.decision !== "revise").map((f) => `${f.id}: got ${results.get(f.id)?.decision}`)).toEqual([]);
    expect(FIXTURES.filter((f) => !caughtRequiredIssue(f.requiredIssue, results.get(f.id)?.issues)).map((f) => `${f.id}: missed the required claim`)).toEqual([]);
  });
});

if (!usable) it("skipped: the reviewer needs a usable key", () => {});

function writeReport() {
  const dir = path.resolve(process.cwd(), "eval", "report");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [`# Follow-up reviewer calibration — ${stamp}`, "", `Reviewer: ${config.reviewProvider?.kind} (${config.reviewProvider?.models.answer}) · review prompt \`${FOLLOWUP_GROUNDING_VERSION}\` · thinking ${config.reviewProvider?.thinkingLevel ?? "default"} · cache ${config.reviewProvider?.promptCache ?? "off"}`, "",
    "Matched pairs: the answer that must pass and the twin that must be sent back differ only in the behaviour named. Both directions count.", "",
    "| Fixture | Behaviour | Expected | Got | ms |", "| --- | --- | --- | --- | ---: |"];
  for (const f of FIXTURES) { const r = results.get(f.id); lines.push(`| ${f.id} | ${f.behaviour} | ${f.expected} | ${r?.decision ?? "not run"}${r && r.decision === f.expected ? " ✓" : " ✗"} | ${r?.ms ?? ""} |`); }
  for (const f of FIXTURES.filter((f) => f.requiredIssue)) lines.push(`Required claim — ${f.id}: ${caughtRequiredIssue(f.requiredIssue, results.get(f.id)?.issues) ? "caught" : "MISSED"}.`);
  lines.push("", "## Reviewer reasons", "");
  for (const f of FIXTURES) { const r = results.get(f.id); if (r?.issues?.length) { lines.push(`### ${f.id} (expected ${f.expected}, got ${r.decision})`, ""); for (const i of r.issues) lines.push(`- **${i.field}** "${i.quote}": ${i.reason}`); lines.push(""); } }
  const calls: CostCall[] = FIXTURES.map((f) => ({ phase: "review", model: results.get(f.id)?.model, usage: results.get(f.id)?.usage }));
  lines.push("## Cost accounting", "", ...costSummary(calls, "Calibration reviews"));
  writeFileSync(path.join(dir, `followup-review-${stamp}.md`), lines.join("\n"));
  console.info(`calibration report written to eval/report/followup-review-${stamp}.md`);
}
