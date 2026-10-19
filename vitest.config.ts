import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // mongodb-memory-server downloads a binary on first run
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // One in-memory MongoDB per file; run files sequentially
    fileParallelism: false,
  },
});
