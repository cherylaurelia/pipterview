import path from "node:path";
import { defineConfig } from "vitest/config";

// Only for `npm run eval:feedback`: the normal test run never calls the API.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "../../src") } },
  test: { include: ["evals/feedback/run.eval.ts"], testTimeout: 60 * 60 * 1000, hookTimeout: 60_000 },
});
