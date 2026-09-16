import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

async function chooseThreeAndReveal(page: Page) {
  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
  await expect(page.getByRole("heading", { name: "Pull three cards" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Rapid taps: no waiting for each save (docs/PLAN-EXTENDED.md section 8).
  for (const slot of [3, 8, 15]) await page.getByRole("button", { name: `Card slot ${slot + 1}. Activate to select.` }).click();
  await expect(page.getByRole("button", { name: /selected as card 3/ })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Turn them over" }).click();
}

async function expectResult(page: Page) {
  await expect(page).toHaveURL(/\/reading\/[^/]+\/result$/);
  await expect(page.getByText("The short of it")).toBeVisible();
  for (const position of ["Situation", "Challenge", "Guidance"]) {
    await expect(page.locator("section").filter({ hasText: position }).first()).toBeVisible();
  }
  await expect(page.getByText("One to take with you")).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

test("first reading needs no email and keeps the question", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await page.getByLabel(/Your question/).fill("What should I consider before changing jobs?");
  await page.getByRole("button", { name: "Pull my cards" }).click();

  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
  await expect(page.getByText("What should I consider before changing jobs?", { exact: true })).toBeVisible();
  await chooseThreeAndReveal(page);
  await expect(page).toHaveURL(/\/reading\/[^/]+\/result$/);
  await expect(page.getByRole("heading", { name: "What should I consider before changing jobs?" })).toBeVisible();

  // Release B: one contextual answer, with optional general library text.
  await expect(page.getByText("On your question").first()).toBeVisible();
  await expect(page.getByText(/Here's the short of it for what you asked/)).toBeVisible();
  await expect(page.getByText("On your question", { exact: true })).toHaveCount(1);
  await expect(page.getByText("One to take with you", { exact: true })).toHaveCount(1);
  await expect(page.getByText("The short of it", { exact: true })).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(3);
  await expect(page.locator("details[open]")).toHaveCount(0);
  await expect(page.getByText("About this card", { exact: true })).toHaveCount(3);
  await page.locator("summary").first().click();
  await expect(page.locator("details[open]")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  // Refresh shows the same stored answer without another request cycle.
  await page.reload();
  await expect(page.getByText(/Here's the short of it for what you asked/)).toBeVisible();

  // Release C1: one follow-up under the reading (stub provider), the sent text
  // visible at once, the answer in place, the allowance counting down.
  await expect(page.getByText("Explore this reading")).toBeVisible();
  await page.getByRole("button", { name: "How do these three cards connect?" }).click();
  await expect(page.getByLabel("Your follow-up")).toHaveValue("How do these three cards connect?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/is the card to look at/)).toBeVisible();
  await expect(page.getByText("2 follow-ups left")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.getByText(/is the card to look at/)).toBeVisible();
});

test("a general reading has no personalized section; a crisis question gets the authored response", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Just read for me" }).click();
  await chooseThreeAndReveal(page);
  await expectResult(page);
  await expect(page.getByText("On your question")).toHaveCount(0);
  await expect(page.getByText("Reading your cards against")).toHaveCount(0);
  const firstResult = page.url();

  // The second reading (the gate) with a crisis question: no card reading for it.
  await page.getByRole("link", { name: "Pull again" }).click();
  await page.getByLabel(/Your question/).fill("I don't want to be here anymore. Is there any point?");
  await page.getByRole("button", { name: "Pull my cards" }).click();
  await expect(page).toHaveURL(/\/verify\?next=/);
  await page.getByLabel("Email address").fill("crisis-check@example.com");
  await page.getByRole("button", { name: "Send my code" }).click();
  const code = await page.locator("strong.font-mono").textContent();
  await page.getByLabel("6-digit verification code").fill(code!);
  await page.getByRole("button", { name: "Confirm and continue" }).click();
  await chooseThreeAndReveal(page);
  await expect(page).toHaveURL(/\/reading\/[^/]+\/result$/);
  await expect(page.getByRole("heading", { name: /bigger than a card reading/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a helpline" })).toHaveAttribute("href", "https://findahelpline.com/");
  await expect(page.getByText("The short of it", { exact: true })).toHaveCount(0);
  await expect(page.getByText("One to take with you", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Your three cards" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pull again" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await expect(page.getByText("On your question")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(page.url()).not.toBe(firstResult);
});

test("a second reading asks for email once, then later draws go straight through", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Just read for me" }).click();
  await chooseThreeAndReveal(page);
  await expectResult(page);

  await page.getByRole("link", { name: "Pull again" }).click();
  await page.getByRole("button", { name: "Just read for me" }).click();

  await expect(page).toHaveURL(/\/verify\?next=/);
  await expect(page.getByRole("heading", { name: "Back for another?" })).toBeVisible();
  await page.getByLabel("Email address").fill("second@example.com");
  await page.getByRole("button", { name: "Send my code" }).click();

  await expect(page).toHaveURL(/\/verify\/code\?next=/);
  const code = await page.locator("strong.font-mono").textContent();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("6-digit verification code").fill(code!);
  await page.getByRole("button", { name: "Confirm and continue" }).click();

  await chooseThreeAndReveal(page);
  await expectResult(page);

  // Verification is remembered: the third draw skips the gate entirely.
  await page.getByRole("link", { name: "Pull again" }).click();
  await page.getByRole("button", { name: "Just read for me" }).click();
  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
});

test("another browser cannot open a private result", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Just read for me" }).click();
  await chooseThreeAndReveal(page);
  await expectResult(page);
  const resultUrl = page.url();

  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto(resultUrl);
  await expect(other.getByText("This reading isn't here anymore")).toBeVisible();
  await expect(other.getByText("The short of it")).toHaveCount(0);
  await stranger.close();
});
