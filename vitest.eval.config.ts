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
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID", "GENERATION_MODEL", "CLASSIFIER_MODEL"]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    test: {
      environment: "node",
      include: ["eval/**/*.eval.ts"],
      testTimeout: 120_000,
      hookTimeout: 600_000,
      fileParallelism: false,
    },
  };
});
