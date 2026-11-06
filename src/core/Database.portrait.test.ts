import { describe, expect, it } from "vitest";
import { shouldPreferAuthoredPortrait } from "./Database";

describe("shouldPreferAuthoredPortrait", () => {
  it("keeps authored art when the save omitted the portrait", () => {
    expect(shouldPreferAuthoredPortrait("/assets/portraits/classic/magic-johnson.png", null)).toBe(true);
  });

  it("prefers local authored art over a stale CDN save URL", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/nate-archibald.png",
        "https://cdn.nba.com/headshots/nba/latest/1040x760/76081.png",
      ),
    ).toBe(true);
  });

  it("does not override a matching local save portrait", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/magic-johnson.png",
        "/assets/portraits/classic/magic-johnson.png",
      ),
    ).toBe(false);
  });
});
