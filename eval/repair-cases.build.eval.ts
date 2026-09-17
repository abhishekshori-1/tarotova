import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CARDS } from "@/content/cards";
import { REFUSAL_CATEGORIES } from "@/content/safety";
import type { Focus, Position } from "@/content/types";
import { attemptPolicy, runAttempts } from "@/server/generation/attempts";
import { GENERATION_REQUEST_DEADLINE_MS, getGenerationConfig } from "@/server/generation/config";
import { buildFollowupInput } from "@/server/generation/followups";
import { buildInterpretationInput } from "@/server/generation/input";
import { generateReviewed } from "@/server/generation/reviewed";
import { getGenerationProvider } from "@/server/generation/service";
import type { FollowupOutput, GroundingReview, InterpretationOutput } from "@/server/generation/types";

/**
 * One-off builder for the fixed-candidate diagnostic (docs/RELEASE-C.md):
 * lifts drafts, review findings and repaired candidates out of a conversation
 * report into eval/repair-cases.json, exactly as the run produced them. The
 * initial answers the follow-ups were written against are not in older
 * reports, so they are regenerated once here and marked as such; newer
 * reports carry the complete initial answer and the builder uses it.
 *
 *   BUILD_REPAIR_CASES=eval/report/<report>.md BUILD_REPAIR_TURNS=conv-a:1,conv-b:2 npx vitest run --config vitest.eval.config.ts eval/repair-cases.build.eval.ts
 *   BUILD_REPAIR_FIXTURES names the fixture file the report ran from (default eval/conversations.json);
 *   BUILD_REPAIR_OUT names the output file (default eval/repair-cases.json).
 */
const REPORT = process.env.BUILD_REPAIR_CASES;
// The fixture file the report was run from (the gate set by default) and where to write the cases.
const FIXTURES = process.env.BUILD_REPAIR_FIXTURES ?? "eval/conversations.json";
const OUT = process.env.BUILD_REPAIR_OUT ?? "eval/repair-cases.json";
const TURNS = (process.env.BUILD_REPAIR_TURNS ?? "").split(",").filter(Boolean).map((s) => { const [id, n] = s.split(":"); return { id, turn: Number(n) }; });
const POSITIONS: Position[] = ["situation", "challenge", "guidance"];
interface Conversation { id: string; focus: Focus; question: string | null; cards: [string, string, string]; turns: { text: string; expectedCategory: string }[] }
interface Attempt { draft?: FollowupOutput; repairedAnswer?: FollowupOutput; reviews: GroundingReview[]; repaired: boolean }

describe.skipIf(!REPORT || TURNS.length === 0)("build repair cases", () => {
  it("writes eval/repair-cases.json from the report", async () => {
    const report = readFileSync(path.resolve(process.cwd(), REPORT!), "utf8");
    const fixtures = JSON.parse(readFileSync(path.resolve(process.cwd(), FIXTURES), "utf8")).conversations as Conversation[];
    const config = getGenerationConfig();
    const provider = getGenerationProvider(config)!;
    const cases = [];
    for (const { id, turn } of TURNS) {
      const c = fixtures.find((f) => f.id === id)!;
      const block = report.split(`\n### ${id} `)[1]?.split(/\n### [a-z]/)[0];
      expect(block, `${id} in report`).toBeTruthy();
      const parts = block!.split(/\n\*\*Turn (\d+), you asked:\*\* /);
      const audits = new Map<number, { published?: FollowupOutput | null; attempts: Attempt[] }>();
      for (let k = 1; k < parts.length; k += 2) {
        const json = parts[k + 1].match(/```json\n([\s\S]*?)\n```/)?.[1];
        if (json) audits.set(Number(parts[k]), JSON.parse(json));
      }
      const audit = audits.get(turn)!;
      const last = audit.attempts.at(-1)!;
      expect(last.draft, `${id} turn ${turn} draft`).toBeTruthy();
      const snapshot = { focus: c.focus, cards: c.cards.map((cid, i) => { const card = CARDS.find((x) => x.id === cid)!; return { position: POSITIONS[i], id: card.id, name: card.name, numeral: card.numeral, keywords: card.keywords, coreMeaning: card.coreMeaning, interpretation: card.position[POSITIONS[i]], focusNote: card.focus[c.focus] }; }) };
      // The complete initial answer: from the report when it carries one, else regenerated once.
      let initialAnswer: InterpretationOutput | null = null;
      let initialSource = "none";
      if (c.question) {
        const stored = block!.match(/<details><summary>Initial answer[^<]*<\/summary>\n\n```json\n([\s\S]*?)\n```/)?.[1];
        if (stored) { initialAnswer = JSON.parse(stored); initialSource = "report"; }
        else {
          const options = { deadlineAt: Date.now() + GENERATION_REQUEST_DEADLINE_MS };
          const category = await provider.classify(c.question, options);
          const safety = category.ok && category.value === "stressful" ? "stressful" : "none";
          const run = await runAttempts(attemptPolicy(options.deadlineAt), () => generateReviewed(provider, buildInterpretationInput(c.question!, snapshot, safety), c.cards as string[], options));
          expect(run.outcome?.ok, `${id} initial answer regenerated`).toBe(true);
          initialAnswer = run.outcome!.ok ? run.outcome!.value : null;
          initialSource = "regenerated";
        }
      }
      // Earlier turns as the follow-up saw them: the published answer of each earlier turn, or null.
      const prior = [];
      for (let t = 1; t < turn; t++) {
        const a = audits.get(t);
        const publishedEarlier = a?.published ?? (a && a.attempts.at(-1)!.repaired ? a.attempts.at(-1)!.repairedAnswer : a?.attempts.at(-1)?.draft) ?? null;
        const withheldEarlier = block!.split(/\n\*\*Turn (\d+), you asked:\*\* /)[2 * t]?.includes("**WITHHELD");
        prior.push({ text: c.turns[t - 1].text, status: withheldEarlier ? "failed" : "succeeded", output: withheldEarlier ? null : JSON.stringify(publishedEarlier) });
      }
      const got = block!.split(/\n\*\*Turn (\d+), you asked:\*\* /)[2 * turn].match(/^_([a-z]+)/m)?.[1] ?? "none";
      const input = buildFollowupInput(snapshot, c.question, initialAnswer, prior, c.turns[turn - 1].text, got === "stressful" ? "stressful" : "none");
      expect((REFUSAL_CATEGORIES as readonly string[]).includes(got)).toBe(false);
      const outcome = block!.split(/\n\*\*Turn (\d+), you asked:\*\* /)[2 * turn].includes("**WITHHELD") ? "withheld" : "published";
      cases.push({
        id: `${id}-t${turn}`, source: { report: REPORT, conversation: id, turn, initialAnswer: initialSource }, outcome,
        input, draft: last.draft,
        firstReview: { ...last.reviews[0], issues: last.reviews[0].issues.map((i) => ({ ...i, adjudication: "TODO", note: "" })) },
        repaired: last.repairedAnswer ?? null,
        secondReview: last.reviews[1] ? { ...last.reviews[1], issues: last.reviews[1].issues.map((i) => ({ ...i, adjudication: "TODO", note: "" })) } : null,
      });
    }
    const out = { $comment: "Fixed candidates for the repair/reviewer diagnostic (docs/RELEASE-C.md). Built by eval/repair-cases.build.eval.ts from a conversation report; adjudication fields are filled by hand against eval/RUBRIC.md: holds (an unsupported claim), questionable_prose (editorial, not a grounding failure), should_pass (the rubric allows it). Do not edit drafts or findings; add cases.", cases };
    writeFileSync(path.resolve(process.cwd(), OUT), JSON.stringify(out, null, 2) + "\n");
    console.info(`wrote ${OUT} with ${cases.length} cases`);
  });
});
if (!REPORT || TURNS.length === 0) it("skipped: set BUILD_REPAIR_CASES and BUILD_REPAIR_TURNS", () => {});
