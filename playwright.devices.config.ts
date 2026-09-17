import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

const server = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
/** Engine/device emulation; this does not claim physical iOS/Android testing. */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "https://localhost:47104", ignoreHTTPSErrors: true },
  webServer: {
    ...server,
    command: "node scripts/browser-https.mjs",
    url: "https://localhost:47104",
    ignoreHTTPSErrors: true,
  },
  testMatch: ["readingDepth.spec.ts", "journeys.spec.ts"],
  projects: [
    { name: "webkit-phone", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "webkit-tablet", use: { ...devices["iPad (gen 7)"], browserName: "webkit" } },
    { name: "firefox-desktop", use: { browserName: "firefox", viewport: { width: 1440, height: 900 } } },
    { name: "chromium-android", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "tablet-768", testMatch: "readingDepth.spec.ts", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "tablet-landscape", testMatch: "readingDepth.spec.ts", use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: "phone-landscape", testMatch: "readingDepth.spec.ts", use: { viewport: { width: 844, height: 390 }, hasTouch: true } },
  ],
});
