import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

async function chooseThreeAndReveal(page: Page) {
  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
  await expect(page.getByRole("heading", { name: "Choose three cards" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Rapid taps: no waiting for each save (docs/PLAN-EXTENDED.md section 8).
  for (const slot of [3, 8, 15]) await page.getByRole("button", { name: `Card slot ${slot + 1}. Activate to select.` }).click();
  await expect(page.getByRole("button", { name: /selected as card 3/ })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reveal these cards" }).click();
}

async function expectResult(page: Page) {
  await expect(page).toHaveURL(/\/reading\/[^/]+\/result$/);
  await expect(page.getByText("Your perspective")).toBeVisible();
  for (const position of ["Situation", "Challenge", "Guidance"]) {
    await expect(page.locator("section").filter({ hasText: position }).first()).toBeVisible();
  }
  await expect(page.getByText("A question to sit with")).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

test("first reading needs no email and keeps the question", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalOverflow(page);
  await page.getByLabel(/Your question/).fill("What should I consider before changing jobs?");
  await page.getByRole("button", { name: "Choose my cards" }).click();

  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
  await expect(page.getByText("What should I consider before changing jobs?", { exact: true })).toBeVisible();
  await chooseThreeAndReveal(page);
  await expectResult(page);
  await expect(page.getByRole("heading", { name: "What should I consider before changing jobs?" })).toBeVisible();
});

test("a second reading asks for email once, then later draws go straight through", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a general reading" }).click();
  await chooseThreeAndReveal(page);
  await expectResult(page);

  await page.getByRole("link", { name: "Begin another reading" }).click();
  await page.getByRole("button", { name: "Explore a general reading" }).click();

  await expect(page).toHaveURL(/\/verify\?next=/);
  await expect(page.getByRole("heading", { name: "Keep exploring with Tarotova" })).toBeVisible();
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
  await page.getByRole("link", { name: "Begin another reading" }).click();
  await page.getByRole("button", { name: "Explore a general reading" }).click();
  await expect(page).toHaveURL(/\/reading\/[^/]+\/choose$/);
});

test("another browser cannot open a private result", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a general reading" }).click();
  await chooseThreeAndReveal(page);
  await expectResult(page);
  const resultUrl = page.url();

  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto(resultUrl);
  await expect(other.getByText("This result isn't available")).toBeVisible();
  await expect(other.getByText("Your perspective")).toHaveCount(0);
  await stranger.close();
});
