import { expect, test, type Page } from "@playwright/test";
import { JOURNEYS } from "../src/content/journeys";
test.beforeEach(async ({ page }) => { await page.setExtraHTTPHeaders({ "x-forwarded-for": crypto.randomUUID() }); });

async function openJourney(page: Page, slug: string, question: string) {
  await page.goto(`/journeys/${slug}`);
  await page.getByLabel("Make the question yours").fill(question);
  await page.getByRole("button", { name: "Begin this journey" }).click();
  await expect(page).toHaveURL(/\/journey\/[^/]+$/);
  await page.getByRole("link", { name: "Choose your three cards" }).click();
  for (const n of [1, 2, 3]) await page.getByRole("button", { name: `Card slot ${n}. Activate to select.` }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Turn them over" }).click();
  await expect(page).toHaveURL(/\/journey\/[^/]+$/);
  await page.getByRole("button", { name: "Explore your reading" }).click();
}
for (const template of JOURNEYS) test(`${template.title}: complete, resume, keep one draw, no mandatory follow-ups`, async ({ page }) => {
  let draws = 0;
  page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/api/journeys")) draws++; });
  await openJourney(page, template.slug, template.starter);
  await expect(page.getByText(/Here's the short of it for what you asked/)).toBeVisible();
  const cards = await page.getByRole("list", { name: "Your three cards" }).locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt")));
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue to reflection" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Your three cards" }).locator("img")).toHaveCount(3);
  expect(await page.getByRole("list", { name: "Your three cards" }).locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt")))).toEqual(cards);
  await page.getByRole("button", { name: "Continue to reflection" }).click();
  await expect(page.getByRole("heading", { name: template.reflection })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Finish this journey" }).click();
  await expect(page.getByText("Journey complete", { exact: true })).toBeVisible();
  expect(draws).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("a generation outage keeps the library and allows completion", async ({ page }) => {
  await openJourney(page, JOURNEYS[0].slug, "A change [stub:fail]");
  await expect(page.getByText("The answer to your question couldn’t be completed.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue to reflection" }).click();
  await page.getByRole("button", { name: "Finish this journey" }).click();
  await expect(page.getByText("Journey complete", { exact: true })).toBeVisible();
});

test("support replaces journey prompts and remains after refresh", async ({ page }) => {
  await openJourney(page, JOURNEYS[1].slug, JOURNEYS[1].starter);
  await page.getByLabel("Your follow-up").fill("He hits me when he is angry.");
  await page.getByRole("button", { name: "Explore this", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue to reflection" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("home resumes a saved journey without a discovery API request", async ({ page }) => {
  await page.goto(`/journeys/${JOURNEYS[0].slug}`);
  await page.getByLabel("Make the question yours").fill(JOURNEYS[0].starter);
  await page.getByRole("button", { name: "Begin this journey" }).click();
  await expect(page).toHaveURL(/\/journey\/[^/]+$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  let discoveryCalls = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/journeys")) discoveryCalls++; });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("link", { name: /Continue your journey/ })).toBeVisible();
  expect(discoveryCalls).toBe(0);
});
