import { describe, expect, it } from "vitest";
import { FOLLOWUP_LENGTHS, READING_LIMITS, WORD_TARGETS, inRange, wordCount } from "./lengths";
import { LIMITS, FOLLOWUP_LIMITS, normalizeStoredAnswer, validateInterpretation, validateFollowup } from "./validate";
import { READING_TOOL, FOLLOWUP_TOOL, INTERPRETATION_SYSTEM, FOLLOWUP_SYSTEM } from "./prompts";
import { FOLLOWUP_REPAIR_SYSTEM, FOLLOWUP_REPAIR_TOOL, REPAIR_SYSTEM, REPAIR_TOOL, GROUNDING_TOOL, FOLLOWUP_GROUNDING_TOOL, followupGroundingUserMessage, repairFields, repairToolFor } from "./grounding-prompts";
import { applyRepairDetailed, followupShape, readingShape } from "./reviewed";
import { ANSWER_FIELDS, FOLLOWUP_FIELDS, type FollowupInput, type InterpretationInput, type InterpretationOutput } from "./types";
import { StubProvider } from "./stub";
import { toGeminiSchema } from "./gemini";

const DRAWN = ["major-00-fool", "major-07-chariot", "major-09-hermit"];
const input = { question: "Should I change jobs?", focusLabel: "Work", safetyCategory: "none", cards: [
  { position: "situation", name: "The Fool", keywords: [], coreMeaning: "A beginning.", positionText: "An open start.", focusNote: "Curiosity." },
  { position: "challenge", name: "The Chariot", keywords: [], coreMeaning: "Drive.", positionText: "A pull in two directions.", focusNote: "Direction." },
  { position: "guidance", name: "The Hermit", keywords: [], coreMeaning: "Reflection.", positionText: "Time to look.", focusNote: "Understanding." },
] } satisfies InterpretationInput;
const followupInput: FollowupInput = { focusLabel: "Work", cards: input.cards, originalQuestion: input.question, initialAnswer: null, priorTurns: [], latest: "How do the cards connect?", safetyCategory: "none" };

function reading(): InterpretationOutput {
  return {
    perspective: "The three cards describe an opening you can walk toward, a need to steer rather than drift, and a pause for honest reflection before you commit to anything.",
    cards: [
      { position: "situation", relevance: "The Fool as Situation brings an open beginning into view as a theme to consider, with more openness than certainty about where it leads." },
      { position: "challenge", relevance: "The Chariot as Challenge raises the pull to force momentum before the direction is known, and asks what the effort is aimed at." },
      { position: "guidance", relevance: "The Hermit as Guidance offers deliberate time alone with the question before answering anyone else, as a way of looking rather than a task." },
    ],
    synthesis: "Read together, the three separate two questions that are easy to run together: whether to move at all, and how to move well. The first two cards speak to the first, the third to the second.",
    reflection: "What would a new role have to give you that the current one does not?",
    beyondSpread: null,
  };
}

describe("shared length constants", () => {
  it("drive validation, tool schemas and prompts from one place", () => {
    expect(LIMITS).toMatchObject({ perspective: 1200, relevance: 1800, synthesis: 1200, reflection: 320, beyondSpread: 480, total: 7200 });
    expect(FOLLOWUP_LIMITS).toMatchObject({ paragraph: 1100, paragraphs: 5, total: 3400, reflection: 320, beyondSpread: 480 });
    expect(READING_TOOL.input_schema.required).toContain("synthesis");
    expect(FOLLOWUP_TOOL.input_schema.properties.paragraphs.maxItems).toBe(FOLLOWUP_LENGTHS.paragraphs.max);
    expect(INTERPRETATION_SYSTEM).toContain(`${WORD_TARGETS.reading.whole.min}–${WORD_TARGETS.reading.whole.max} words`);
    expect(INTERPRETATION_SYSTEM).toContain(`${READING_LIMITS.relevance.min}–${READING_LIMITS.relevance.max}`);
    expect(FOLLOWUP_SYSTEM).toContain(`${WORD_TARGETS.followup.substantive.min}–${WORD_TARGETS.followup.substantive.max} words`);
    expect(FOLLOWUP_SYSTEM).toContain(`${FOLLOWUP_LENGTHS.paragraph.min}–${FOLLOWUP_LENGTHS.paragraph.max} characters`);
    expect(REPAIR_SYSTEM).toContain(`synthesis ${READING_LIMITS.synthesis.min}–${READING_LIMITS.synthesis.max}`);
    expect(FOLLOWUP_REPAIR_SYSTEM).toContain(`${FOLLOWUP_LENGTHS.paragraph.min}–${FOLLOWUP_LENGTHS.paragraph.max} characters`);
    expect(FOLLOWUP_REPAIR_SYSTEM).toContain("Call only repair_followup.");
    expect(FOLLOWUP_REPAIR_SYSTEM).not.toContain("repair_reading");
  });

  it("counts words and ranges", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount(null)).toBe(0);
    expect(inRange(650, WORD_TARGETS.reading.whole)).toBe(true);
    expect(inRange(751, WORD_TARGETS.reading.whole)).toBe(false);
  });
});

describe("synthesis and the aggregate ceiling", () => {
  it("requires synthesis on a new answer and reads an old stored answer without it", () => {
    expect(validateInterpretation(reading(), DRAWN).ok).toBe(true);
    const old = Object.fromEntries(Object.entries(reading()).filter(([k]) => k !== "synthesis")) as Omit<InterpretationOutput, "synthesis">;
    expect(validateInterpretation(old, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    expect(validateInterpretation({ ...reading(), synthesis: "Too short." }, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    const normalized = normalizeStoredAnswer(JSON.stringify(old));
    expect(normalized.synthesis).toBeNull();
    expect(normalized.perspective).toBe(old.perspective);
    expect(normalizeStoredAnswer(reading()).synthesis).toBe(reading().synthesis);
    expect(normalizeStoredAnswer({ ...reading(), synthesis: "  " }).synthesis).toBeNull();
  });

  it("accepts long card paragraphs up to their own limit and rejects the aggregate", () => {
    const long = { ...reading(), cards: reading().cards.map((c) => ({ ...c, relevance: "w".repeat(1800) })) };
    expect(validateInterpretation(long, DRAWN).ok).toBe(true);
    const over = { ...long, perspective: "p".repeat(1200), synthesis: "s".repeat(1200) };
    expect(validateInterpretation(over, DRAWN)).toMatchObject({ ok: false, reason: "output_shape", detail: expect.stringMatching(/^total \d+ > 7200$/) });
  });

  it("includes synthesis in the text gates", () => {
    expect(validateInterpretation({ ...reading(), synthesis: reading().synthesis + " The Star would help here too." }, DRAWN)).toMatchObject({ ok: false, reason: "foreign_card" });
  });

  it("counts paragraph breaks within fields toward the aggregate ceiling", () => {
    const answer = { ...reading(), perspective: "p".repeat(1200), synthesis: "s".repeat(1200), cards: reading().cards.map((c) => ({ ...c, relevance: "a\n\n".repeat(599) + "a" })) };
    expect(validateInterpretation(answer, DRAWN)).toMatchObject({ ok: false, reason: "output_shape", detail: expect.stringMatching(/^total \d+ > 7200$/) });
  });
});

describe("field mapping and repair with the wider shapes", () => {
  it("exposes synthesis and paragraph_4/5 as fields with their own limits", () => {
    expect([...ANSWER_FIELDS]).toEqual(["perspective", "situation", "challenge", "guidance", "synthesis", "reflection", "beyondSpread"]);
    expect([...FOLLOWUP_FIELDS]).toEqual(["paragraph_1", "paragraph_2", "paragraph_3", "paragraph_4", "paragraph_5", "reflection", "beyondSpread"]);
    const shape = readingShape(input);
    expect(shape.fieldText(reading(), "synthesis")).toBe(reading().synthesis);
    expect(shape.fieldLimit("synthesis")).toEqual(READING_LIMITS.synthesis);
    expect(shape.fieldLimit("challenge")).toEqual(READING_LIMITS.relevance);
    const five = { paragraphs: ["a".repeat(50), "b".repeat(50), "c".repeat(50), "d".repeat(50), "e".repeat(50)], reflection: null, beyondSpread: null };
    const fshape = followupShape(followupInput);
    expect(fshape.fieldText(five, "paragraph_5")).toBe("e".repeat(50));
    expect(fshape.fieldText({ ...five, paragraphs: five.paragraphs.slice(0, 2) }, "paragraph_4")).toBeNull();
    expect(fshape.fieldLimit("paragraph_4")).toEqual(FOLLOWUP_LENGTHS.paragraph);
    expect(fshape.applyEdit(five, "paragraph_4", "x".repeat(60))?.paragraphs[3]).toBe("x".repeat(60));
    expect(GROUNDING_TOOL.input_schema.properties.issues.items.properties.field.enum).toContain("synthesis");
    expect(FOLLOWUP_GROUNDING_TOOL.input_schema.properties.issues.items.properties.field.enum).toContain("paragraph_5");
    const message = followupGroundingUserMessage(followupInput, five);
    const rest = typeof message === "string" ? message : message.rest;
    expect(JSON.parse(rest).candidate).toMatchObject({ paragraph_4: "d".repeat(50), paragraph_5: "e".repeat(50) });
  });

  it("allows up to seven edits and checks each replacement against its own field's limit", () => {
    expect(REPAIR_TOOL.input_schema.properties.edits.maxItems).toBe(7);
    expect(FOLLOWUP_REPAIR_TOOL.input_schema.properties.edits.maxItems).toBe(7);
    const shape = readingShape(input);
    const review = { decision: "revise" as const, issues: ANSWER_FIELDS.map((field) => ({ field, quote: "x", reason: "r" })) };
    const edits = ANSWER_FIELDS.map((field) => ({ field, replacement: field === "beyondSpread" ? null : field === "reflection" ? "What do you notice first, before any explanation arrives?" : "r".repeat(1000) }));
    const applied = applyRepairDetailed(shape, { edits }, reading(), review);
    expect(applied.ok).toBe(true);
    if (applied.ok) expect(applied.value.cards[0].relevance).toBe("r".repeat(1000));
    // A card paragraph may run to 1,800 characters; the old universal 900 cap no longer applies.
    const longCard = applyRepairDetailed(shape, { edits: [{ field: "challenge", replacement: "c".repeat(1700) }] }, reading(), { decision: "revise", issues: [{ field: "challenge", quote: "x", reason: "r" }] });
    expect(longCard.ok).toBe(true);
    // A reflection has its own, smaller limit.
    const longReflection = applyRepairDetailed(shape, { edits: [{ field: "reflection", replacement: "q".repeat(400) }] }, reading(), { decision: "revise", issues: [{ field: "reflection", quote: "x", reason: "r" }] });
    expect(longReflection).toMatchObject({ ok: false, detail: expect.stringContaining("repair_length: reflection 400 outside 20–320") });
    const narrowed = repairToolFor(REPAIR_TOOL, repairFields(review.issues));
    expect(narrowed.input_schema.properties.edits).toMatchObject({ minItems: 7, maxItems: 7 });
    expect(toGeminiSchema(narrowed.input_schema)).toMatchObject({ properties: { edits: { items: { properties: { field: { enum: [...ANSWER_FIELDS] } } } } } });
    expect(toGeminiSchema(READING_TOOL.input_schema)).toMatchObject({ required: expect.arrayContaining(["synthesis"]) });
  });
});

describe("stub provider", () => {
  it("writes an answer that passes the new validation and keeps the sentences the browser suite asserts", async () => {
    const stub = new StubProvider();
    const written = await stub.interpret(input);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    const valid = validateInterpretation(written.value, DRAWN);
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.output.perspective).toContain("Here's the short of it for what you asked");
      expect(valid.output.synthesis).toBeTruthy();
    }
    const reply = await stub.followup(followupInput);
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(validateFollowup(reply.value, DRAWN).ok).toBe(true);
  });
});
