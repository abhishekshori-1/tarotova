import { describe, expect, it } from "vitest";
import { LIMITS, findAssertedCertainty, findForeignCardName, validateInterpretation } from "./validate";

const DRAWN = ["major-00-fool", "major-07-chariot", "major-09-hermit"];

function good() {
  return {
    perspective:
      "Read together for your question about changing jobs, The Fool, The Chariot and The Hermit describe an opening you can walk toward, a need to steer rather than drift, and a pause for honest reflection before you commit.",
    cards: [
      { position: "situation", relevance: "The Fool as Situation: you are at the edge of something new, with more openness than certainty about where it leads." },
      { position: "challenge", relevance: "The Chariot as Challenge: the pull is to force momentum before you know the direction you actually want." },
      { position: "guidance", relevance: "The Hermit as Guidance: take some deliberate time alone with the question before answering anyone else." },
    ],
    reflection: "Write down the three things a new role would have to give you, and check the current one against them honestly.",
    beyondSpread: null,
  };
}

describe("validateInterpretation", () => {
  it("accepts a well-formed answer and normalizes an empty beyondSpread", () => {
    const result = validateInterpretation({ ...good(), beyondSpread: "  " }, DRAWN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.beyondSpread).toBeNull();
  });

  it("rejects the wrong shape or position order", () => {
    const swapped = good();
    [swapped.cards[0], swapped.cards[1]] = [swapped.cards[1], swapped.cards[0]];
    expect(validateInterpretation(swapped, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    expect(validateInterpretation({ ...good(), cards: good().cards.slice(0, 2) }, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    expect(validateInterpretation("PWNED", DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
  });

  it("rejects answers that are too short or too long", () => {
    expect(validateInterpretation({ ...good(), perspective: "PWNED" }, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    expect(validateInterpretation({ ...good(), perspective: "x".repeat(LIMITS.perspective + 1) }, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
  });

  it.each([
    "The Chariot reversed would mean the opposite.",
    "The cards predict a new offer within weeks.",
    "You should stop taking the medication and see.",
    "This is not legal advice, but sue them.",
  ])("rejects banned phrasing: %s", (sentence) => {
    const result = validateInterpretation({ ...good(), perspective: good().perspective + " " + sentence }, DRAWN);
    expect(result).toMatchObject({ ok: false, reason: "banned_phrase" });
  });

  it.each([
    ["This outcome is guaranteed if you act now.", "is guaranteed"],
    ["You are destined for this role.", "are destined"],
    ["I'd diagnose this as burnout.", "I'd diagnose"],
    ["This reading predicts a quiet month ahead.", "This reading predicts"],
    ["Do this and it's guaranteed to work.", "guaranteed"],
  ])("rejects asserted certainty: %s", (sentence, phrase) => {
    const result = validateInterpretation({ ...good(), reflection: sentence + " Sit with that for a week." }, DRAWN);
    expect(result).toMatchObject({ ok: false, reason: "asserted_certainty", detail: expect.stringContaining(phrase) });
  });

  it.each([
    "Nothing here is guaranteed, and that's the honest part.",
    "There's no guarantee the offer comes through.",
    "This isn't a diagnosis — a clinician can give you that.",
    "The cards can't predict whether they'll say yes.",
    "That is beyond what three cards can predict.",
    // Sentences from the real eval runs that a blunter check rejected:
    "These cards can't tell you what your manager is thinking or intends, or hand you a script guaranteed to fix the dynamic.",
    "You're weighing a real change, and the cards suggest this is less about finding a guaranteed right answer and more about how you approach it.",
    "A deliberate pause names the trap of trying to urgently fix or diagnose what's happening between you.",
    "These cards can't tell you what the psychiatrist will think, say, or diagnose, and they don't predict how the appointment will go.",
    "A three-card reading can't tell you specific dates or predict how your year will unfold.",
  ])("accepts the same words when denied: %s", (sentence) => {
    expect(findAssertedCertainty(sentence)).toBeUndefined();
    const result = validateInterpretation({ ...good(), reflection: sentence + " Sit with that for a week." }, DRAWN);
    expect(result.ok).toBe(true);
  });

  it("rejects undeclared fields at both levels", () => {
    expect(validateInterpretation({ ...good(), secret: "unexpected" }, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
    const answer = good();
    Object.assign(answer.cards[0], { advice: "extra" });
    expect(validateInterpretation(answer, DRAWN)).toMatchObject({ ok: false, reason: "output_shape" });
  });

  it.each([
    "I cannot know his mind, but I guarantee he loves you.",
    "Nothing is certain.\nI guarantee this works.",
    "I can't know; however, this reading predicts a happy ending.",
  ])("rejects certainty after an unrelated denial: %s", (text) => {
    expect(findAssertedCertainty(text)).toBeDefined();
  });

  it.each(["The Star offers renewal.", "Try reflecting. The Tower reveals the answer."])("rejects an undrawn card at a sentence boundary: %s", (text) => {
    expect(findForeignCardName(text, DRAWN)).toBeDefined();
  });

  it("rejects a card that was not drawn, but tolerates the plain words", () => {
    expect(validateInterpretation({ ...good(), reflection: "Lean on The Star here and trust the process a little longer." }, DRAWN)).toMatchObject({
      ok: false,
      reason: "foreign_card",
      detail: "The Star",
    });
    expect(findForeignCardName("You have the strength to make this call, and justice is not the point.", DRAWN)).toBeUndefined();
    expect(findForeignCardName("Justice matters to you. Death is not on the table.", DRAWN)).toBeUndefined();
    expect(findForeignCardName("Here Justice weighs on the decision.", DRAWN)).toBe("Justice");
  });
});
