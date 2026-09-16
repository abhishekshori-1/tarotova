import { expect, test } from "@playwright/test";
test("disabled journey discovery is hidden on both routes and makes no home fetch", async ({ page, request }) => {
  test.skip(process.env.E2E_JOURNEYS_ENABLED !== "false", "Run separately with journeys disabled");
  for (const path of ["/journeys", "/journeys/navigating-change"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("button", { name: "Begin this journey" })).toHaveCount(0);
    await expect(page.getByText("Navigating change", { exact: true })).toHaveCount(0);
  }
  let calls = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/journeys")) calls++; });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Pull my cards" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore guided journeys/ })).toHaveCount(0);
  expect(calls).toBe(0);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /journeys"); expect(robots).toContain("Disallow: /journey/");
});
