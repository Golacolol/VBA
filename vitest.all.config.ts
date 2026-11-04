import { defineConfig } from "vitest/config";

/** Full tree including legacy football suites (not used by Pages CI). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
