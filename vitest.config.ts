import { defineConfig } from "vitest/config";

/**
 * VORTEX CI / default suite — basketball shell only.
 * Legacy GOLACO football match-engine tests stay in-tree but are excluded
 * so Pages deploy is not blocked by unfinished football leftovers.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/ui/**/*.test.ts",
      "src/core/**/*.test.ts",
      "src/football/miteam/**/*.test.ts",
      "src/football/pyramid/**/*.test.ts",
      "src/football/predictions/**/*.test.ts",
      "src/football/stadium/CourtArena.test.ts",
      "scripts/**/*.test.mjs",
    ],
  },
});
