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
    ["This outcome is guaranteed if you act now.", "guaranteed"],
    ["You are destined for this role.", "destined"],
    ["I'd diagnose this as burnout.", "diagnose"],
    ["The Hermit predicts a quiet month ahead.", "predicts"],
  ])("rejects asserted certainty: %s", (sentence, word) => {
    const result = validateInterpretation({ ...good(), reflection: sentence + " Sit with that for a week." }, DRAWN);
    expect(result).toMatchObject({ ok: false, reason: "asserted_certainty", detail: word });
  });

  it.each([
    "Nothing here is guaranteed, and that's the honest part.",
    "There's no guarantee the offer comes through.",
    "This isn't a diagnosis — a clinician can give you that.",
    "The cards can't predict whether they'll say yes.",
    "That is beyond what three cards can predict.",
  ])("accepts the same words when denied: %s", (sentence) => {
    expect(findAssertedCertainty(sentence)).toBeUndefined();
    const result = validateInterpretation({ ...good(), reflection: sentence + " Sit with that for a week." }, DRAWN);
    expect(result.ok).toBe(true);
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
