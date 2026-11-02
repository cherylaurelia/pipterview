import path from "node:path";
import { defineConfig } from "vitest/config";

// Only for `npm run eval:feedback`: the normal test run never calls the API.

// The key lives in .env.local, as for the app (variables already set in the shell win).
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env.local"));
} catch {
  // no .env.local: fine with MOCK_AI=1, and the runner says so otherwise
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "../../src") } },
  test: { include: ["evals/feedback/run.eval.ts"], testTimeout: 60 * 60 * 1000, hookTimeout: 60_000 },
});
