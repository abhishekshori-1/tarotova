import { expect, test, type Page } from "@playwright/test";
import { SAFETY_RESPONSES } from "../src/content/safety";
import type { InterpretationView } from "../src/server/generation/types";

// Network fixtures isolate presentation from generation and routing quality.
// The service tests cover those handoffs separately without paid API calls.
const cards = [
  { position: "situation", id: "major-00-fool", name: "The Fool", numeral: "0" },
  { position: "challenge", id: "major-07-chariot", name: "The Chariot", numeral: "VII" },
  { position: "guidance", id: "major-09-hermit", name: "The Hermit", numeral: "IX" },
].map((c) => ({ ...c, keywords: ["Theme"], interpretation: "General library interpretation.", focusNote: "General focus note." }));

async function openResult(page: Page, interpretation: InterpretationView, question: string | null = "What matters to me?") {
  await page.route("**/api/readings/presentation/status", (route) => route.fulfill({ json: { state: "locked" } }));
  await page.route("**/api/readings/presentation/result", (route) => route.fulfill({ json: {
    question, focus: "general", cards, interpretation,
    overview: "General library overview.", reflection: "General closing reflection.",
  } }));
  await page.route("**/api/readings/presentation/interpretation", (route) => route.fulfill({ json: interpretation }));
  await page.goto("/reading/presentation/result");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

for (const view of [
  { status: "pending" },
  { status: "failed", reason: "provider_timeout", retryable: false },
  { status: "unavailable", reason: "not_configured" },
] as const) {
  test(`${view.status} questions do not show unclassified card advice`, async ({ page }) => {
    await openResult(page, view);
    await expect(page.getByText("On your question", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
    await expect(page.getByText("The short of it", { exact: true })).toHaveCount(0);
    await expect(page.getByText("One to take with you", { exact: true })).toHaveCount(0);
    await expect(page.getByText("General library interpretation.")).toHaveCount(0);
  });
}

for (const view of [
  { status: "pending", classifiedCategory: "none" },
  { status: "failed", reason: "provider_timeout", retryable: false, classifiedCategory: "stressful" },
  { status: "unavailable", reason: "not_configured", classifiedCategory: "none" },
] as const) {
  test(`${view.status} classified questions retain the library reading`, async ({ page }) => {
    await openResult(page, view);
    await expect(page.getByText("General library overview.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Your three cards" })).toBeVisible();
    await expect(page.getByText("General closing reflection.")).toBeVisible();
    await expect(page.getByText("From the card library", { exact: true })).toBeVisible();
  });
}

test("polls triage before a delayed POST finishes and preserves cards on failure", async ({ page }) => {
  let phase: "unclassified" | "classified" | "failed" = "unclassified";
  let finishPost!: () => void;
  const postGate = new Promise<void>((resolve) => { finishPost = resolve; });
  await page.route("**/api/readings/presentation/status", (route) => route.fulfill({ json: { state: "locked" } }));
  await page.route("**/api/readings/presentation/result", (route) => route.fulfill({ json: {
    question: "What matters to me?", focus: "general", cards,
    overview: "General library overview.", reflection: "General closing reflection.",
    interpretation: phase === "unclassified" ? { status: "idle" } : phase === "classified" ? { status: "pending", classifiedCategory: "none" } : { status: "failed", reason: "timeout", retryable: false, classifiedCategory: "none" },
  } }));
  await page.route("**/api/readings/presentation/interpretation", async (route) => {
    await postGate;
    await route.fulfill({ json: { status: "failed", reason: "timeout", retryable: false, classifiedCategory: "none" } });
  });
  await page.goto("/reading/presentation/result");
  await expect(page.getByText("Taking a moment with your question…")).toBeVisible();
  await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
  phase = "classified";
  await expect(page.getByText("General library overview.")).toBeVisible();
  await expect(page.getByText("Your cards are below. Writing the answer to your question…")).toBeVisible();
  phase = "failed";
  finishPost();
  await expect(page.getByText("The answer to your question couldn’t be completed.", { exact: false })).toBeVisible();
  await expect(page.getByText("General library overview.")).toBeVisible();
});

test("support replaces all card advice and links to help", async ({ page }) => {
  await openResult(page, { status: "refused", category: "crisis", response: SAFETY_RESPONSES.crisis });
  await expect(page.getByRole("heading", { name: SAFETY_RESPONSES.crisis.heading })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a helpline" })).toHaveAttribute("href", "https://findahelpline.com/");
  await expect(page.getByText("General library interpretation.")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
  await expect(page.getByText("One to take with you", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pull again" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

test("success gives one answer, with optional library reference", async ({ page }) => {
  await openResult(page, { status: "succeeded", model: "fixture", promptVersion: "fixture", answer: {
    perspective: "A contextual perspective.", synthesis: null, reflection: "A contextual reflection.", beyondSpread: "A clearly stated limit.",
    cards: ["situation", "challenge", "guidance"].map((position) => ({ position: position as "situation" | "challenge" | "guidance", relevance: `Contextual ${position} paragraph.` })),
  } });
  await expect(page.getByText("A contextual perspective.")).toBeVisible();
  await expect(page.getByText("A clearly stated limit.")).toBeVisible();
  await expect(page.getByText("One to take with you", { exact: true })).toHaveCount(1);
  await expect(page.getByText("General library overview.")).toHaveCount(0);
  await expect(page.getByText("General closing reflection.")).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(3);
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.locator("summary").first().click();
  await expect(page.getByText("General library interpretation.").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("no-question readings keep the editorial reading", async ({ page }) => {
  await openResult(page, { status: "not_applicable" }, null);
  await expect(page.getByText("General library overview.")).toBeVisible();
  await expect(page.getByText("General closing reflection.")).toBeVisible();
  await expect(page.getByText("On your question", { exact: true })).toHaveCount(0);
});

test("a stored follow-up support response suppresses earlier card advice on reload", async ({ page }) => {
  await page.route("**/api/readings/presentation/status", (route) => route.fulfill({ json: { state: "locked" } }));
  await page.route("**/api/readings/presentation/result", (route) => route.fulfill({ json: {
    question: "A question", focus: "general", cards, interpretation: { status: "disabled" },
    overview: "Old card advice", reflection: "Old reflection", followupSupport: SAFETY_RESPONSES.abuse,
  } }));
  await page.goto("/reading/presentation/result");
  await expect(page.getByRole("heading", { name: SAFETY_RESPONSES.abuse.heading })).toBeVisible();
  await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
  await expect(page.getByText("Old card advice")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

test("finished conversation keeps its reflections and one retention notice", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/readings/presentation/followups", (route) => route.fulfill({ json: {
    status: "ready", available: false, remaining: 0, reason: "allowance_exhausted",
    turns: [1, 2, 3].map((sequence) => ({ sequence, submissionId: `fixture-${sequence}`, text: `My follow-up ${sequence}`, status: "succeeded", answer: {
      paragraphs: ["There is room to consider the question without deciding everything today. This is a fixture for the layout, not a generated reading."],
      reflection: sequence === 3 ? null : "What would you like to understand next?", beyondSpread: null,
    } })),
  } }));
  await openResult(page, { status: "not_applicable" }, null);
  await expect(page.getByRole("heading", { name: "A place to pause" })).toBeVisible();
  await expect(page.getByText("This reading stays here for 30 days.", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("heading", { name: "Explore this reading" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("conversation.png"), fullPage: true });
});
