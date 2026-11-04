import { describe, expect, it } from "vitest";
import type { PlayerAttributes } from "../../data/schema";
import {
  PROFILE_ATTR_SPOKES,
  PROFILE_AXIS_IDS,
  deriveProfileAxes,
  effectiveComposure,
  listProfileAttrSpokes,
  resolveAttributes,
} from "./PlayerStats";
import { nextProfileStatsMode, profileFullSvg, profileStatsBlock } from "../../ui/ProfileHex";

const attrs: PlayerAttributes = {
  finishing: 84,
  midRange: 78,
  threePoint: 80,
  freeThrow: 82,
  ballHandle: 76,
  passAccuracy: 74,
  perimeterD: 42,
  interiorD: 40,
  rebound: 55,
  steal: 48,
  block: 38,
  speed: 80,
  acceleration: 78,
  vertical: 72,
  strength: 68,
  stamina: 77,
  iq: 79,
  clutch: 81,
};

describe("deriveProfileAxes", () => {
  it("returns six overalls for hex comparison", () => {
    const axes = deriveProfileAxes(attrs);
    expect(Object.keys(axes).sort()).toEqual([...PROFILE_AXIS_IDS].sort());
    for (const id of PROFILE_AXIS_IDS) {
      expect(axes[id]).toBeGreaterThanOrEqual(1);
      expect(axes[id]).toBeLessThanOrEqual(100);
    }
    expect(axes.rim).toBeGreaterThan(axes.defence);
    expect(axes.shooting).toBeGreaterThan(50);
  });

  it("labels the top hex axis as RIM (finishing / dunks), not SCR", () => {
    const hex = profileStatsBlock(attrs, { mode: "hex", size: 168 });
    expect(hex).toContain(">RIM<");
    expect(hex).not.toContain(">SCR<");
    expect(hex).toContain(">SHT<");
  });

  it("infers form and concentration and blends them into effective composure", () => {
    const resolved = resolveAttributes({
      finishing: 70,
      midRange: 70,
      threePoint: 70,
      freeThrow: 70,
      ballHandle: 70,
      passAccuracy: 70,
      perimeterD: 70,
      interiorD: 70,
      rebound: 70,
      steal: 70,
      block: 70,
      speed: 70,
      vertical: 70,
      strength: 70,
      stamina: 70,
      iq: 70,
      clutch: 80,
      primaryPosition: "PG",
    });
    expect(resolved.form).toBe(80);
    expect(resolved.concentration).toBe(70);
    expect(effectiveComposure({ ...resolved, form: 40, concentration: 40 })).toBeLessThan(80);
    expect(effectiveComposure({ ...resolved, form: 95, concentration: 95 })).toBeGreaterThan(80);
  });
});

describe("full attribute radar spokes", () => {
  it("lists every basketball attribute spoke", () => {
    const spokes = listProfileAttrSpokes(attrs);
    expect(spokes).toHaveLength(PROFILE_ATTR_SPOKES.length);
    expect(spokes.every((s) => s.value >= 1 && s.value <= 100)).toBe(true);
    expect(spokes.some((s) => s.key === "threePoint")).toBe(true);
    expect(spokes.some((s) => s.key === "ballHandle")).toBe(true);
  });

  it("keeps the full shape inside the same fixed footprint as the hex", () => {
    const hex = profileStatsBlock(attrs, { mode: "hex", size: 168 });
    const full = profileStatsBlock(attrs, { mode: "full", size: 168 });
    expect(hex).toMatch(/width:168px;height:168px/);
    expect(full).toMatch(/width:168px;height:168px/);
    expect(full).toContain("profile-hex-full");
    const svg = profileFullSvg(listProfileAttrSpokes(attrs), 168);
    expect(svg).toContain('viewBox="0 0 168 168"');
    expect(svg.match(/profile-hex-shape/g)?.length).toBe(1);
  });

  it("cycles hex → full → detail → hex", () => {
    expect(nextProfileStatsMode("hex")).toBe("full");
    expect(nextProfileStatsMode("full")).toBe("detail");
    expect(nextProfileStatsMode("detail")).toBe("hex");
  });
});
