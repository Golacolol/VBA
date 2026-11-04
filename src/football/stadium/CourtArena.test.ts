/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import stadiumsData from "../../../public/data/stadiums.json";
import type { StadiumRecord } from "../../data/schema";
import { createHoops } from "./Hoops";

const stadiums = stadiumsData as StadiumRecord[];

describe("basketball arenas", () => {
  it("ships a vortex fallback arena and NBA court dims", () => {
    const vortex = stadiums.find((s) => s.id === "vortex_arena");
    expect(vortex).toBeTruthy();
    expect(vortex!.venueType).toBe("NBA_ARENA");
    expect(vortex!.pitchLength).toBeCloseTo(28.65, 2);
    expect(vortex!.pitchWidth).toBeCloseTo(15.24, 2);
    expect(stadiums.every((s) => s.venueType === "NBA_ARENA")).toBe(true);
    expect(stadiums.every((s) => !/park|anfield|old trafford|home_park/i.test(s.id + s.name))).toBe(true);
  });

  it("builds hoops at both baselines instead of football goals", () => {
    const hoops = createHoops();
    expect(hoops.name).toBe("hoops");
    expect(hoops.children.length).toBe(2);
  });
});
