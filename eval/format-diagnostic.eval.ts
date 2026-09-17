import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { it, expect } from "vitest";
import { CARDS } from "@/content/cards";
import { POSITIONS, type Focus } from "@/content/types";
import { getGenerationConfig } from "@/server/generation/config";
import { getGenerationProvider } from "@/server/generation/service";
import { buildInterpretationInput } from "@/server/generation/input";
import { validateInterpretation } from "@/server/generation/validate";

// Paid transport diagnostic, separate from release gates. Fixture output is
// retained locally, never credentials. Compare JSON mode with the documented
// strict tool schema before changing production transport.
it("records the exact reading transport on previously malformed cases", async () => {
  const questions = JSON.parse(readFileSync("eval/questions.json", "utf8")).questions as { id: string; question: string; focus: Focus; cards: string[] }[];
  const provider = getGenerationProvider(getGenerationConfig())!;
  expect(provider).toBeTruthy();
  const nativeFetch = globalThis.fetch;
  const records: unknown[] = [];
  try {
    for (const strict of [false, true]) {
      let raw: unknown;
      globalThis.fetch = async (url, init) => {
        const body = JSON.parse(init?.body as string);
        if (!strict) {
          const tool = body.tools[0].function;
          body.messages[0].content += `\n\nRespond with exactly one JSON object for ${tool.name}, matching this schema:\n${JSON.stringify(tool.parameters)}`;
          body.response_format = { type: "json_object" };
          delete body.tools;
          delete body.tool_choice;
        }
        const response = await nativeFetch(strict ? url : "https://api.deepseek.com/chat/completions", { ...init, body: JSON.stringify(body) });
        raw = await response.clone().json();
        return response;
      };
      for (const id of ["gen-03", "gen-04", "rel-01", "growth-03", "long-02", "quality-understanding-01"]) {
        const q = questions.find((q) => q.id === id)!;
        const snapshot = { focus: q.focus, cards: q.cards.map((id, i) => {
          const c = CARDS.find((c) => c.id === id)!;
          return { id: c.id, name: c.name, numeral: c.numeral, keywords: c.keywords, coreMeaning: c.coreMeaning, position: POSITIONS[i], interpretation: c.position[POSITIONS[i]], focusNote: c.focus[q.focus] };
        }) };
        const started = Date.now();
        const result = await provider.interpret(buildInterpretationInput(q.question, snapshot, "none"), { deadlineAt: started + 30000 });
        const validation = result.ok ? validateInterpretation(result.value, q.cards) : null;
        records.push({ id, strict, ms: Date.now() - started, result, validation, raw });
        console.info({ id, strict, ok: result.ok, validation: validation?.ok, reason: result.ok ? (validation?.ok ? undefined : validation?.detail) : result.reason });
      }
    }
  } finally {
    globalThis.fetch = nativeFetch;
    mkdirSync("data/review-pass", { recursive: true });
    writeFileSync("data/review-pass/format-diagnostic.json", JSON.stringify(records, null, 2));
  }
}, 240000);
