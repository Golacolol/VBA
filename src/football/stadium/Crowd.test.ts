import { describe, expect, it } from "vitest";
import {
  arenaCornerSpecs,
  arenaTerraceStep,
  deluxeCornerCrowdGrid,
  deluxeCornerSpecs,
  standCrowdGrid,
  standCrowdInset,
} from "./Crowd";
import { HALF_LENGTH, HALF_WIDTH } from "../constants";

/** Football pitch half-length — crowd helpers key off halfL < 40 for NBA arenas. */
const FOOTBALL_HALF_L = 52.5;
const FOOTBALL_HALF_W = 34;

describe("crowd fill", () => {
  it("covers the full width of each Home Park stand", () => {
    const north = standCrowdGrid("north", "four", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    const south = standCrowdGrid("south", "four", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    const end = standCrowdGrid("east", "four", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    expect(north.cols * north.colPitch).toBeGreaterThan(90);
    expect(north.rows).toBe(18);
    expect(south.cols * south.colPitch).toBeGreaterThan(84);
    expect(south.rows).toBe(14);
    expect(end.cols * end.colPitch).toBeGreaterThan(58);
    expect(end.rows).toBe(16);
    expect(standCrowdInset("four", FOOTBALL_HALF_L)).toBe(8.6);
  });

  it("fits the smaller Central Park single stand without changing Home Park", () => {
    const north = standCrowdGrid("north", "one", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    expect(north.cols * north.colPitch).toBeLessThanOrEqual(72);
    expect(north.cols * north.colPitch).toBeGreaterThan(60);
    expect(north.rows).toBe(8);
    expect(standCrowdInset("one", FOOTBALL_HALF_L)).toBe(6.5);
    expect(standCrowdGrid("north", "four", FOOTBALL_HALF_L, FOOTBALL_HALF_W).rows).toBe(18);
    expect(standCrowdInset("four", FOOTBALL_HALF_L)).toBe(8.6);
  });

  it("sizes Premiership deluxe bowls larger than Home Park", () => {
    const north = standCrowdGrid("north", "deluxe", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    const end = standCrowdGrid("east", "deluxe", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    const near = standCrowdGrid("south", "deluxe", FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    expect(north.rows).toBe(26);
    expect(north.cols * north.colPitch).toBeGreaterThan(90);
    expect(end.rows).toBe(22);
    expect(near.rows).toBe(12);
    expect(standCrowdInset("deluxe", FOOTBALL_HALF_L)).toBe(10.2);
    expect(standCrowdGrid("north", "four", FOOTBALL_HALF_L, FOOTBALL_HALF_W).rows).toBe(18);
  });

  it("defines four wrap-around corner arcs for deluxe bowls", () => {
    const corners = deluxeCornerSpecs(FOOTBALL_HALF_L, FOOTBALL_HALF_W);
    expect(corners).toHaveLength(4);
    expect(corners.map((c) => c.id).sort()).toEqual(["ne", "nw", "se", "sw"]);
    for (const c of corners) {
      expect(Math.abs(c.a1 - c.a0)).toBeGreaterThan(Math.PI / 2);
      expect(deluxeCornerCrowdGrid(c).cols).toBeGreaterThan(10);
      expect(deluxeCornerCrowdGrid(c).rows).toBe(c.rows);
    }
  });

  it("seats NBA arena fans on the same row depth as the terraces", () => {
    const south = standCrowdGrid("south", "four", HALF_LENGTH, HALF_WIDTH);
    const north = standCrowdGrid("north", "four", HALF_LENGTH, HALF_WIDTH);
    expect(south.rows).toBe(8);
    expect(south.rowPitch).toBe(arenaTerraceStep("south").rowDepth);
    expect(north.rowPitch).toBe(arenaTerraceStep("north").rowDepth);
    expect(standCrowdInset("four", HALF_LENGTH)).toBe(5.2);
    const corners = arenaCornerSpecs(HALF_LENGTH, HALF_WIDTH);
    expect(corners.find((c) => c.id === "se")?.rows).toBe(8);
  });
});
