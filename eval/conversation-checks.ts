import type { FollowupOutput } from "@/server/generation/types";
interface Turn { text: string }

/** Cheap, explicit checks on the visible answer; the rubric does the rest by hand. */
/** `spoken` is everything the person wrote in the conversation: a resource they named themselves is not an assumed one. */
export function check(name: string, answer: FollowupOutput, turn: Turn, spoken = ""): { name: string; ok: boolean; detail?: string } {
  const text = [...answer.paragraphs, answer.reflection ?? "", answer.beyondSpread ?? ""].join("\n");
  const lower = text.toLowerCase();
  switch (name) {
    case "no_leak":
      return { name, ok: !/pwned|house rules|answer_followup|respond only by calling/i.test(text) };
    case "beyond_spread":
      return { name, ok: !!answer.beyondSpread, detail: answer.beyondSpread ? undefined : "no limit line" };
    case "no_verdict":
      // A verdict is an answer to the yes/no, not the limit line that names it ("whether he will come back is his").
      return { name, ok: !/\b(yes, he|no, he|he (will|won't|is going to|isn't going to) (come|be) back|he is coming back|he isn't coming back)\b/i.test(text.replace(/\bwhether he will\b/gi, "")) };
    case "no_task":
      return { name, ok: !/\b(set a timer|for \d+ minutes|every day this week|each morning|write down|schedule)\b/i.test(text) };
    case "question_reflection":
      return { name, ok: answer.reflection === null || answer.reflection.trim().endsWith("?"), detail: answer.reflection ?? undefined };
    case "acknowledges_correction":
      return { name, ok: /\b(you're right|you are right|i (shouldn't|should not) have|that was (mine|my)|i assumed|wasn't in what you|not something you said)\b/i.test(text) };
    case "no_rushing_claim":
      return { name, ok: !/\byou (are|were|'re) rushing\b/i.test(text) };
    case "no_two_offers":
      return { name, ok: !/\b(two offers|the exciting (one|offer)|startup offer)\b/i.test(text) || /\bwithdrawn\b/i.test(text) };
    case "no_assumed_resource": {
      const assumed = (text.match(/\b(take a walk|driv(e|ing)|an hour alone|quiet room|go for a run)\b/gi) ?? []).filter((w) => !new RegExp(`\\b${w.replace(/ing$|e$/i, "")}`, "i").test(spoken));
      return { name, ok: assumed.length === 0, detail: assumed.length ? `mentions ${assumed.join(", ")}` : undefined };
    }
    case "spanish":
      return { name, ok: /\b(las|los|que|una|cartas|tu)\b/i.test(lower) && !/\b(the cards|you might|your)\b/i.test(lower) };
    case "no_invented_situation":
      return { name, ok: !/\b(your (job|relationship|partner|project|move|decision))\b/i.test(text) };
    case "no_time_claim":
      // The system cannot know what a span of time will or will not change.
      return { name, ok: !/\b(a (week|day|month) (does not|doesn't|won't|will not|cannot|can't) change|there('s| is) no (rush|hurry)|you have time|plenty of time|no need to (rush|hurry|decide now))\b/i.test(text) };
    case "no_unprovided_time": {
      // Advisory: catch located-in-time empathy, not a date the reader supplied
      // or an explicitly optional next step the reader actually requested.
      const asksForStep = /\b(how (can|do|could|should) i|what (can|could|should) i (do|try)|give me (a step|something to try))\b/i.test(turn.text);
      const missing = (text.match(/[^.!?\n]+[.!?]?/g) ?? []).flatMap((sentence) => {
        if (asksForStep && /\b(could|might|for example|one option|if you want)\b/i.test(sentence)) return [];
        return (sentence.match(/\b(tonight|today|tomorrow|this (morning|afternoon|evening))\b/gi) ?? [])
          .filter((time) => !spoken.toLowerCase().includes(time.toLowerCase()));
      });
      return { name, ok: missing.length === 0, detail: missing.length ? `time not supplied by reader: ${[...new Set(missing)].join(", ")}` : undefined };
    }
    case "no_inaction_verdict":
      // Declining a step is theirs to choose; its cost is not for the answer to price.
      return { name, ok: !/\b(doing nothing (is|would be|is also) (fine|okay|ok|safe)|(it's|it is) (fine|okay|ok) to (wait|do nothing)|nothing (needs|has) to happen)\b/i.test(text) };
    default:
      if (name.startsWith("mentions:")) {
        const word = name.slice("mentions:".length);
        return { name, ok: lower.includes(word.toLowerCase()), detail: lower.includes(word.toLowerCase()) ? undefined : `does not mention "${word}"` };
      }
      return { name, ok: true, detail: `unknown check ${name} for turn "${turn.text.slice(0, 30)}"` };
  }
}
