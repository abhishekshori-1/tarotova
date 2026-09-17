import { expect, test, type Page } from "@playwright/test";
import { answer, question, reply } from "./fixtures/developed-reading";

async function openReading(page: Page, available = true, history = false) {
  const cards = [
    { position: "situation", id: "major-00-fool", name: "The Fool", numeral: "0" },
    { position: "challenge", id: "major-07-chariot", name: "The Chariot", numeral: "VII" },
    { position: "guidance", id: "major-09-hermit", name: "The Hermit", numeral: "IX" },
  ].map((card) => ({ ...card, keywords: ["A theme to consider"], interpretation: "A general library meaning, distinct from the contextual answer.", focusNote: "A general focus note." }));
  await page.route("**/api/readings/depth/status", (route) => route.fulfill({ json: { state: "locked" } }));
  await page.route("**/api/readings/depth/result", (route) => route.fulfill({ json: {
    question, focus: "work", cards, overview: "Library overview", reflection: "Library reflection",
    interpretation: { status: "succeeded", model: "layout-fixture", promptVersion: "layout-fixture", answer },
  } }));
  await page.route("**/api/readings/depth/followups", (route) => route.fulfill({ json: {
    status: "ready", available, remaining: history ? 0 : 3, reason: available ? undefined : history ? "allowance_exhausted" : "disabled",
    turns: history ? [1, 2, 3].map((sequence) => ({ sequence, submissionId: `depth-${sequence}`, text: `Help me consider the comparison from angle ${sequence}.`, status: "succeeded", answer: reply })) : [],
  } }));
  await page.goto("/reading/depth/result");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function fits(page: Page) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth - innerWidth,
    elements: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".section-links")).slice(0, 12).map((e) => ({ tag: e.tagName, class: e.className, text: e.textContent?.slice(0, 60) })),
  }));
  expect(overflow.width, JSON.stringify(overflow.elements)).toBeLessThanOrEqual(1);
}

test("developed reading keeps every paragraph and its section navigation", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReading(page);
  for (const card of answer.cards) {
    const paragraphs = page.locator(`#${card.position} .reading-body`).first().locator("p");
    await expect(paragraphs).toHaveText(card.relevance.split("\n\n"));
  }
  await expect(page.locator("#connect .reading-body")).toHaveText(answer.synthesis!);
  await fits(page);
  await page.getByRole("link", { name: "Together", exact: true }).click();
  await expect(page).toHaveURL(/#connect$/);
  await expect(page.getByRole("heading", { name: "How the cards connect" })).toBeInViewport();
  await page.getByRole("button", { name: "Ask about this reading", exact: true }).click();
  await expect(page.getByLabel("Your follow-up")).toBeFocused();
  await page.getByLabel("Your follow-up").fill("Can I compare these without choosing yet?");
  await fits(page);
  await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: testInfo.outputPath("developed-reading.png"), fullPage: true });
});

test("enlarged cards close with keyboard and restore focus", async ({ page }) => {
  await openReading(page);
  const opener = page.getByRole("button", { name: "Enlarge The Fool", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "The Fool, enlarged" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test("long conversation remains readable at enlarged text with no dead composer link", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReading(page, false, true);
  await expect(page.getByRole("heading", { name: "A place to pause" })).toBeVisible();
  await expect(page.locator(".conversation-turn")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Ask about this reading" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Conversation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  // 200% root text size is a reflow check; physical-device browser zoom is separate.
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await fits(page);
  await page.getByRole("heading", { name: "A place to pause" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "A place to pause" })).toBeInViewport();
});

test("feature off removes the entry controls after server availability arrives", async ({ page }) => {
  await openReading(page, false);
  await expect(page.getByRole("button", { name: "Ask about this reading" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Conversation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.locator("#connect .reading-body")).toHaveText(answer.synthesis!);
});
