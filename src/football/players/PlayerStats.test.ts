import { describe, expect, it } from "vitest";
import {
  applyOverride,
  applyPhysicalToAppearance,
  bodyTypeFromPhysical,
  bodyWidthFromPhysical,
  deriveOverall,
  heightScaleFromCm,
  resolveAttributes,
} from "./PlayerStats";
import type { PlayerRecord } from "../../data/schema";

const base = {
  pace: 70,
  passing: 81,
  longPassing: 77,
  vision: 80,
  control: 78,
  dribbling: 74,
  shooting: 67,
  finishing: 65,
  shotPower: 72,
  longShots: 68,
  defending: 70,
  strength: 69,
  stamina: 82,
  composure: 77,
} as const;

function player(pos: PlayerRecord["primaryPosition"]): PlayerRecord {
  return {
    id: "player_test",
    name: "Test",
    displayName: "T. Est",
    primaryPosition: pos,
    secondaryPositions: [],
    ...base,
  };
}

describe("player ratings", () => {
  it("uses different weights by position", () => {
    const attrs = resolveAttributes(player("PG"));
    const pg = deriveOverall("PG", attrs);
    const sg = deriveOverall("SG", attrs);
    const c = deriveOverall("C", attrs);
    expect(pg).not.toBe(c);
    expect(sg).toBeGreaterThan(50);
    expect(pg).toBeGreaterThan(60);
  });

  it("applies membership overrides without replacing identity", () => {
    const attrs = applyOverride(base, { passing: 90, overall: 88 });
    expect(attrs.passing).toBe(90);
    expect(attrs.pace).toBe(70);
    const resolved = resolveAttributes(player("PG"));
    expect(resolved.passAccuracy).toBeGreaterThan(50);
    expect(resolved.speed).toBe(70);
    const over = applyOverride(base, { defending: 80, defensiveAwareness: 92 });
    expect(over.defensiveAwareness).toBe(92);
    expect(player("PG").id).toBe("player_test");
  });
});

describe("physical appearance", () => {
  it("maps height to mesh scale around 198cm ≈ 1 for NBA", () => {
    expect(heightScaleFromCm(198)).toBeCloseTo(0.98, 1);
    expect(heightScaleFromCm(175)).toBeLessThan(heightScaleFromCm(210));
    expect(heightScaleFromCm(220)).toBeLessThanOrEqual(1.22);
  });

  it("derives lean/stocky from BMI and continuous width from weight", () => {
    expect(bodyTypeFromPhysical(180, 68)).toBe("lean");
    expect(bodyTypeFromPhysical(180, 82)).toBe("stocky");
    expect(bodyTypeFromPhysical(180, 74)).toBe("standard");
    expect(bodyWidthFromPhysical(180, 68)).toBeLessThan(1);
    expect(bodyWidthFromPhysical(180, 85)).toBeGreaterThan(1);
  });

  it("syncs appearance fields from measured height and weight", () => {
    const next = applyPhysicalToAppearance(
      { bodyType: "lean" as const, heightScale: 1, bodyWidth: 1 },
      191,
      96,
    );
    expect(next.heightScale).toBe(heightScaleFromCm(191));
    expect(next.bodyType).toBe("stocky");
    expect(next.bodyWidth).toBeGreaterThan(1);
  });
});
