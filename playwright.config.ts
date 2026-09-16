import { defineConfig } from "@playwright/test";

const PORT = 47102;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser tests run against `next dev` on their own port and a throwaway
 * pglite directory, so the console email provider (and its on-page dev
 * code) is available and nothing touches the developer's local data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "narrow", use: { viewport: { width: 320, height: 568 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `rm -rf data/e2e && PGLITE_DATA_DIR=data/e2e npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      EMAIL_PROVIDER: "console",
      TURNSTILE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      GENERATION_ENABLED: "true",
      FOLLOWUPS_ENABLED: "true",
      // Every generation role on the offline stub, and every vendor key blank:
      // Next.js lets an existing process variable win over .env.local, so the
      // suite can never reach a real provider whatever the developer has set.
      GENERATION_PROVIDER: "stub",
      GENERATION_REVIEW_PROVIDER: "stub",
      GENERATION_CLASSIFIER_PROVIDER: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      DEEPSEEK_API_KEY: "",
    },
  },
});
