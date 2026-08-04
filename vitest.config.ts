import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    // ponytail: one worker — every test truncates the shared test database
    fileParallelism: false,
    // …и advisory-лока разводит по очереди прогоны из разных чекаутов
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 20000,
  },
});
