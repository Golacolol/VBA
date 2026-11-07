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

  it("prefers a second authored local path over a stale first local save path", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/blake-griffin.png",
        "/assets/portraits/classic/blake-griffin-old.png",
      ),
    ).toBe(true);
  });

  it("treats query-only cache bumps as the same local portrait", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/blake-griffin.png?v=2",
        "/assets/portraits/classic/blake-griffin.png",
      ),
    ).toBe(false);
  });

  it("does not override a matching local save portrait", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/magic-johnson.png",
        "/assets/portraits/classic/magic-johnson.png",
      ),
    ).toBe(false);
  });

  it("keeps Character Select /images custom picks", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/magic-johnson.png",
        "/images/l13.png",
      ),
    ).toBe(false);
  });

  it("keeps data-URL uploads over seed art", () => {
    expect(
      shouldPreferAuthoredPortrait(
        "/assets/portraits/classic/magic-johnson.png",
        "data:image/png;base64,abc",
      ),
    ).toBe(false);
  });
});
