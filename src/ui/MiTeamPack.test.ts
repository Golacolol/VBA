/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  miteamFoilHtml,
  miteamFoilSerrationClip,
  packTierForOverall,
  playFoilOpen,
  MITEAM_GOLD_OVR,
  MITEAM_DIAMOND_OVR,
  MITEAM_PURPLE_OVR,
} from "./MiTeamPack";

describe("MiTeamPack tiers", () => {
  it("uses gold 80–89, diamond 90–94, purple 95+, and black for top cards", () => {
    expect(packTierForOverall(79)).toBe("silver");
    expect(packTierForOverall(MITEAM_GOLD_OVR)).toBe("gold");
    expect(packTierForOverall(89)).toBe("gold");
    expect(packTierForOverall(MITEAM_DIAMOND_OVR)).toBe("diamond");
    expect(packTierForOverall(94)).toBe("diamond");
    expect(packTierForOverall(MITEAM_PURPLE_OVR)).toBe("purple");
    expect(packTierForOverall(99)).toBe("purple");
    expect(packTierForOverall(99, { black: true })).toBe("black");
    expect(packTierForOverall(80, { black: true })).toBe("black");
  });

  it("renders gold, diamond, purple, and black foil chrome", () => {
    const gold = miteamFoilHtml("gold");
    expect(gold).toContain("miteam-foil-shell-gold");
    expect(gold).toContain("miteam-foil-gold");
    expect(gold).toContain("miteam-foil-well");
    expect(gold).toContain("miteam-foil-card-peek");
    expect(gold).toContain("GOLD PACK");
    expect(gold).toContain("miteam-foil-holo");
    expect(gold).toContain("clip-path:polygon(");
    expect(gold).toContain("miteam-foil-wrap-left");
    expect(gold).toContain("miteam-foil-lip-top");
    expect(gold).toContain("miteam-foil-tear-top");
    expect(gold.match(/vba-logo\.png/g)?.length).toBe(1);
    const diamond = miteamFoilHtml("diamond");
    expect(diamond).toContain("miteam-foil-shell-diamond");
    expect(diamond).toContain("miteam-foil-diamond");
    expect(diamond).toContain("DIAMOND PACK");
    expect(diamond).not.toContain("miteam-foil-gold");
    expect(diamond).not.toContain("miteam-foil-purple");
    expect(diamond).not.toContain("miteam-foil-black");
    const purple = miteamFoilHtml("purple");
    expect(purple).toContain("miteam-foil-shell-purple");
    expect(purple).toContain("miteam-foil-purple");
    expect(purple).toContain("PURPLE PACK");
    expect(purple).not.toContain("miteam-foil-gold");
    expect(purple).not.toContain("miteam-foil-diamond");
    expect(purple).not.toContain("miteam-foil-black");
    const black = miteamFoilHtml("black");
    expect(black).toContain("miteam-foil-shell-black");
    expect(black).toContain("miteam-foil-black");
    expect(black).toContain("BLACK PACK");
    expect(black).not.toContain("miteam-foil-gold");
    expect(black).not.toContain("miteam-foil-purple");
    expect(black).not.toContain("miteam-foil-diamond");
    const silver = miteamFoilHtml("silver");
    expect(silver).toContain("miteam-foil-silver");
    expect(silver).toContain("SILVER PACK");
    expect(silver).not.toContain("miteam-foil-gold");
    expect(silver).not.toContain("miteam-foil-purple");
    expect(silver).not.toContain("miteam-foil-diamond");
    expect(silver).not.toContain("miteam-foil-black");
  });

  it("serrates top and bottom tear edges only", () => {
    const clip = miteamFoilSerrationClip();
    expect(clip.startsWith("polygon(")).toBe(true);
    expect(clip).toContain("0.0% 0.0%");
    expect(clip).toContain("100.0% 100.0%");
    expect(clip).toContain("0.0% 100.0%");
    // Shallow notches — recessed well / card lip, not an opened pack.
    expect(clip).toContain("2.8%");
  });
});

describe("playFoilOpen", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onDone once even when animationend and timeout both fire", () => {
    vi.useFakeTimers();
    const foil = document.createElement("button");
    const onDone = vi.fn();
    playFoilOpen(foil, onDone);
    expect(foil.classList.contains("miteam-foil-opening")).toBe(true);
    foil.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(700);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("ignores bubbled animationend from child layers", () => {
    vi.useFakeTimers();
    const foil = document.createElement("button");
    const child = document.createElement("span");
    foil.appendChild(child);
    const onDone = vi.fn();
    playFoilOpen(foil, onDone);
    child.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
