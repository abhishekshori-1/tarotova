import { expect, it } from "vitest";
import { check } from "../eval/conversation-checks";
const answer = (text: string) => ({ paragraphs: [text], reflection: null, beyondSpread: null });
it("catches invented time in acknowledgments, while allowing user context and requested optional steps", () => {
  expect(check("no_unprovided_time", answer("May it be a comfort to you tonight."), { text: "help us Lord" }, "help us Lord").ok).toBe(false);
  expect(check("no_unprovided_time", answer("May it be a comfort to you tonight."), { text: "I am worried tonight" }, "I am worried tonight").ok).toBe(true);
  expect(check("no_unprovided_time", answer("One option: you could call tomorrow if you want."), { text: "What can I try?" }, "What can I try?").ok).toBe(true);
  expect(check("no_time_claim", answer("There is no rush."), { text: "What now?" }).ok).toBe(false);
});
