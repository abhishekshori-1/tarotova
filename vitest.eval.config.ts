import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

/**
 * `npm run eval`: runs eval/questions.json through the real provider and
 * writes a report for the human pass (eval/RUBRIC.md). Separate config so
 * `npm test` never needs a key or makes a paid call. Reads .env.local (git-
 * ignored) so ANTHROPIC_* can live there instead of the shell.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["GENERATION_PROVIDER", "GENERATION_REVIEW_PROVIDER", "GENERATION_REVIEW_MODEL", "GENERATION_TIMEOUT_MS", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_CLASSIFIER_MODEL", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_CLASSIFIER_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID", "ANTHROPIC_MODEL", "ANTHROPIC_CLASSIFIER_MODEL", "GENERATION_MODEL", "CLASSIFIER_MODEL"]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    test: {
      environment: "node",
      include: ["eval/**/*.eval.ts"],
      testTimeout: 120_000,
      // Each fixture still has production's 55-second shared deadline;
      // allow the sequential reviewed pipelines and calibration to finish.
      hookTimeout: 3_600_000,
      fileParallelism: false,
    },
  };
});
