import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * `npm run eval`: runs eval/questions.json through the real provider and
 * writes a report for the human pass (eval/RUBRIC.md). Separate config so
 * `npm test` never needs a key or makes a paid call.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    testTimeout: 120_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
});
