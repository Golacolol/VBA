/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildPyramidRingSlots,
  DEFAULT_PYRAMID_ORDER,
  DEFAULT_PYRAMID_POOL,
  defaultPyramidSave,
  elevatePoolToPyramid,
  movePyramidIndex,
  normalizePyramidOrder,
  normalizePyramidPool,
  normalizePyramidSave,
  PYRAMID_POOL_SIZE,
  PYRAMID_SIZE,
  PYRAMID_TIER_COUNTS,
  PYRAMID_TIER_PATTERNS,
  PYRAMID_TIER_SCALES,
  PYRAMID_POSITION_TEAM_COUNTS,
  pyramidEligiblePositions,
  pyramidPositionTeamRows,
  pyramidTierRows,
  swapPyramidNeighbor,
  swapPyramidWithPool,
} from "./defaultPyramid";

describe("defaultPyramid", () => {
  it("seeds a unique Top 50 order and reserve pool", () => {
    expect(DEFAULT_PYRAMID_ORDER).toHaveLength(PYRAMID_SIZE);
    expect(DEFAULT_PYRAMID_POOL).toHaveLength(PYRAMID_POOL_SIZE);
    expect(new Set(DEFAULT_PYRAMID_ORDER).size).toBe(PYRAMID_SIZE);
    expect(new Set(DEFAULT_PYRAMID_POOL).size).toBe(PYRAMID_POOL_SIZE);
    expect(DEFAULT_PYRAMID_ORDER[0]).toBe("classic_chi_1995_96_p02"); // Jordan
    expect(DEFAULT_PYRAMID_ORDER[1]).toBe("classic_mia_2012_13_p03"); // LeBron
    expect(DEFAULT_PYRAMID_ORDER[2]).toBe("classic_lal_1986_87_p05"); // Kareem
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_hou_1994_95_p05"); // Hakeem
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_phx_1992_93_p04"); // Barkley
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_orl_1994_95_p01"); // Penny Hardaway
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_nyk_2011_12_p03"); // Carmelo Anthony
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_was_2007_08_p01"); // Gilbert Arenas
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_det_1996_97_p03"); // Grant Hill
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_lal_2009_10_p02"); // Kobe #24 (09/10)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_tor_2000_01_p02"); // Vince Carter (88 → reserve)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_lal_2009_10_p04"); // Pau Gasol (88 → reserve)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_orl_1994_95_p02"); // Nick Anderson
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_lal_2009_10_p03"); // Metta World Peace
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_nyk_2011_12_p01"); // Jeremy Lin
    // Pool ranked by OVR — no team clumps (e.g. three Bulls in a row).
    expect(DEFAULT_PYRAMID_POOL[0]).toBe("classic_hou_2018_19_p02"); // Harden #51 (90)
    // One form per person — Magic Shaq / 00–01 Kobe stay out (09/10 Kobe is the seed).
    expect(DEFAULT_PYRAMID_ORDER.concat(DEFAULT_PYRAMID_POOL)).not.toContain("classic_orl_1994_95_p05");
    expect(DEFAULT_PYRAMID_ORDER.concat(DEFAULT_PYRAMID_POOL)).not.toContain("classic_lal_2000_01_p02");
    expect(PYRAMID_TIER_COUNTS.reduce((a, b) => a + b, 0)).toBe(PYRAMID_SIZE);
    expect(PYRAMID_TIER_SCALES).toHaveLength(PYRAMID_TIER_COUNTS.length);
    const overlap = DEFAULT_PYRAMID_POOL.filter((id) => DEFAULT_PYRAMID_ORDER.includes(id));
    expect(overlap).toEqual([]);
  });

  it("normalizes saved order and pads from the default seed", () => {
    const known = new Set([...DEFAULT_PYRAMID_ORDER, ...DEFAULT_PYRAMID_POOL]);
    const order = normalizePyramidOrder(["classic_mia_2012_13_p03", "missing", "classic_chi_1995_96_p02"], known);
    expect(order[0]).toBe("classic_mia_2012_13_p03");
    expect(order[1]).toBe("classic_chi_1995_96_p02");
    expect(order).toHaveLength(PYRAMID_SIZE);
    expect(new Set(order).size).toBe(PYRAMID_SIZE);
  });

  it("keeps pool disjoint from order when normalizing", () => {
    const known = new Set([...DEFAULT_PYRAMID_ORDER, ...DEFAULT_PYRAMID_POOL]);
    const order = normalizePyramidOrder(DEFAULT_PYRAMID_ORDER, known);
    const pool = normalizePyramidPool([order[0], ...DEFAULT_PYRAMID_POOL], order, known);
    expect(pool).toHaveLength(PYRAMID_POOL_SIZE);
    expect(pool.includes(order[0]!)).toBe(false);
  });

  it("reorders via swap and move", () => {
    const base = ["a", "b", "c", "d"];
    expect(swapPyramidNeighbor(base, 1, -1)).toEqual(["b", "a", "c", "d"]);
    expect(movePyramidIndex(base, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("swaps reserve into Top 50 and elevates against #50", () => {
    const order = ["a", "b", "c"];
    const pool = ["x", "y"];
    expect(swapPyramidWithPool(order, pool, 1, 0)).toEqual({
      order: ["a", "x", "c"],
      pool: ["b", "y"],
    });
    expect(elevatePoolToPyramid(order, pool, 1)).toEqual({
      order: ["a", "b", "y"],
      pool: ["x", "c"],
    });
  });

  it("builds tier rows matching band sizes", () => {
    const rows = pyramidTierRows(DEFAULT_PYRAMID_ORDER);
    expect(rows.map((r) => r.entries.length)).toEqual([...PYRAMID_TIER_COUNTS]);
    expect(rows[0]!.entries[0]!.rank).toBe(1);
    expect(rows.at(-1)!.entries.at(-1)!.rank).toBe(50);
  });

  it("supports odds, fibonacci, and positions display patterns summing to 50", () => {
    for (const [id, counts] of Object.entries(PYRAMID_TIER_PATTERNS)) {
      expect(counts.reduce((a, b) => a + b, 0), id).toBe(PYRAMID_SIZE);
      const rows = pyramidTierRows(DEFAULT_PYRAMID_ORDER, counts);
      expect(rows.map((r) => r.entries.length)).toEqual([...counts]);
      expect(rows.at(-1)!.entries.at(-1)!.rank).toBe(50);
    }
  });

  it("deals POS A rows as best-available primary-position teams", () => {
    const order = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    const pos = new Map([
      ["A", "SG"],
      ["B", "PG"],
      ["C", "C"],
      ["D", "SF"],
      ["E", "PF"],
      ["F", "SG"],
      ["G", "PG"],
      ["H", "SF"],
      ["I", "PF"],
      ["J", "C"],
      ["K", "SG"],
    ]);
    const rows = pyramidPositionTeamRows(order, (id) => pos.get(id), [1, 5, 5]);
    expect(rows.map((r) => r.entries.map((e) => e.playerId))).toEqual([
      ["A"],
      ["B", "F", "D", "E", "C"], // PG SG SF PF C — best remaining each
      ["G", "K", "H", "I", "J"],
    ]);
    expect(rows.flatMap((r) => r.entries).map((e) => e.playerId).sort()).toEqual([...order].sort());

    // Fold #1 into the top five — A (SG) seats at SG; teams reshuffle.
    const folded = pyramidPositionTeamRows(order, (id) => pos.get(id), {
      apexInTopTeam: true,
      counts: [5, 5],
    });
    expect(folded.map((r) => r.entries.map((e) => e.playerId))).toEqual([
      ["B", "A", "D", "E", "C"], // PG · SG(#1) · SF · PF · C
      ["G", "F", "H", "I", "J"],
      ["K"], // leftover after two fives
    ]);
    expect(PYRAMID_POSITION_TEAM_COUNTS.reduce((a, b) => a + b, 0)).toBe(PYRAMID_SIZE);
  });

  it("deals POS B with secondary flex so lineups differ from POS A", () => {
    expect(pyramidEligiblePositions("PF", [], "secondary")).toEqual(["PF", "SF", "C"]);
    expect(pyramidEligiblePositions("PG", [], "secondary")).toEqual(["PG", "SG"]);
    expect(pyramidEligiblePositions("PG", [], "secondary")).not.toContain("C");
    expect(pyramidEligiblePositions("PF", ["SF"], "secondary")).toEqual(["PF", "SF"]);

    // Rank order: star PF, role SF, then PG/SG/C.
    // POS A: SF seat waits for roleSF; starPF stays at PF.
    // POS B: starPF (next best) takes SF via flex; roleSF slides to PF.
    const order = ["starPF", "roleSF", "pg", "sg", "c"];
    const pos = new Map([
      ["starPF", "PF"],
      ["roleSF", "SF"],
      ["pg", "PG"],
      ["sg", "SG"],
      ["c", "C"],
    ]);
    const posA = pyramidPositionTeamRows(order, (id) => pos.get(id), {
      dealMode: "primary",
      counts: [5],
    });
    const posB = pyramidPositionTeamRows(order, (id) => pos.get(id), {
      dealMode: "secondary",
      counts: [5],
    });
    expect(posA[0]!.entries.map((e) => e.playerId)).toEqual(["pg", "sg", "roleSF", "starPF", "c"]);
    expect(posB[0]!.entries.map((e) => e.playerId)).toEqual(["pg", "sg", "starPF", "roleSF", "c"]);
    expect(posA[0]!.entries.map((e) => e.playerId)).not.toEqual(posB[0]!.entries.map((e) => e.playerId));
  });

  it("seeds Kobe as 2009/10 #24 form, not 2000/01 #8", () => {
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_lal_2009_10_p02");
    expect(DEFAULT_PYRAMID_ORDER).not.toContain("classic_lal_2000_01_p02");
    expect(DEFAULT_PYRAMID_POOL).not.toContain("classic_lal_2000_01_p02");
  });

  it("places ring players on position wedges around #1 from Top 50 only", () => {
    const order = [...DEFAULT_PYRAMID_ORDER];
    const pos = new Map([
      [order[0]!, "SG"],
      [order[1]!, "SF"],
      [order[2]!, "SG"],
      [order[3]!, "PG"],
    ]);
    const { centerId, slots } = buildPyramidRingSlots(order.slice(0, 4), (id) => pos.get(id));
    expect(centerId).toBe(order[0]);
    expect(slots).toHaveLength(3);
    expect(slots.find((s) => s.playerId === order[3]!)?.position).toBe("PG");
    expect(slots.every((s) => s.rank > 1)).toBe(true);
  });

  it("packs each position as 1 then pairs/triples, spreading outer rings", () => {
    const order = [...DEFAULT_PYRAMID_ORDER];
    // Five SF after #1 → rings: 1, then 2, then 2.
    const ids = order.slice(0, 6);
    const { slots } = buildPyramidRingSlots(ids, () => "SF");
    expect(slots).toHaveLength(5);
    const byRank = [...slots].sort((a, b) => a.rank - b.rank);
    expect(byRank[0]!.radiusT).toBe(0);
    expect(byRank[0]!.scale).toBe(1);
    // Next two share the same ring (paired).
    expect(byRank[1]!.radiusT).toBe(byRank[2]!.radiusT);
    expect(byRank[1]!.angleDeg).not.toBe(byRank[2]!.angleDeg);
    expect(byRank[1]!.scale).toBeLessThan(byRank[0]!.scale);
    // Outer pair farther + smaller.
    expect(byRank[3]!.radiusT).toBeGreaterThan(byRank[1]!.radiusT);
    expect(byRank[4]!.scale).toBeLessThanOrEqual(byRank[3]!.scale);
    expect(byRank[4]!.scale).toBeLessThan(byRank[1]!.scale);

    // Deeper wedge uses triples on outer rings (fewer buried layers).
    const deep = buildPyramidRingSlots(order.slice(0, 11), () => "PG").slots;
    const radii = [...new Set(deep.map((s) => s.radiusT))].sort((a, b) => a - b);
    expect(radii.length).toBeLessThanOrEqual(5);
    expect(radii[radii.length - 1]!).toBe(1);
  });

  it("normalizes pyramid save view and pool", () => {
    const save = normalizePyramidSave({
      order: DEFAULT_PYRAMID_ORDER,
      pool: DEFAULT_PYRAMID_POOL,
      view: "ring",
      size: 50,
      seedVersion: 9,
    });
    expect(save.view).toBe("ring");
    expect(save.pool).toHaveLength(PYRAMID_POOL_SIZE);
    expect(defaultPyramidSave().view).toBe("pyramid");
    expect(defaultPyramidSave().pool).toHaveLength(PYRAMID_POOL_SIZE);
    expect(defaultPyramidSave().seedVersion).toBe(9);
    expect(DEFAULT_PYRAMID_ORDER[9]).toBe("classic_gsw_2016_17_p01"); // Curry #10
    expect(DEFAULT_PYRAMID_ORDER[10]).toBe("classic_hou_1994_95_p05"); // Olajuwon #11
    expect(DEFAULT_PYRAMID_ORDER[15]).toBe("classic_lal_1971_72_p01"); // West #16
    expect(DEFAULT_PYRAMID_ORDER[16]).toBe("classic_den_2022_23_p05"); // Jokic #17 (93 active)
    expect(DEFAULT_PYRAMID_ORDER[49]).toBe("classic_nyk_2011_12_p03"); // Carmelo #50
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_det_2003_04_p01"); // Billups
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_det_2003_04_p05"); // Ben Wallace
  });

  it("replaces a stale seed with the curated Top 50", () => {
    const stale = normalizePyramidSave({
      order: ["classic_chi_1995_96_p07"],
      pool: [],
      view: "pyramid",
      seedVersion: 1,
    });
    expect(stale.order[0]).toBe(DEFAULT_PYRAMID_ORDER[0]);
    expect(stale.order).toContain("classic_hou_1994_95_p05");
    expect(stale.order).toContain("classic_nyk_2011_12_p03");
    expect(stale.order).toContain("classic_orl_1994_95_p01");
    expect(stale.order).toContain("classic_lal_2009_10_p02");
    expect(stale.pool).toContain("classic_okc_2011_12_p01"); // Westbrook → reserve
    expect(stale.pool).toContain("classic_lal_2009_10_p04"); // Pau → reserve
    expect(stale.pool).toContain("classic_tor_2000_01_p02"); // Vince → reserve
    expect(stale.pool).toContain("classic_det_2003_04_p01"); // Billups
    expect(stale.seedVersion).toBe(9);
    expect(stale.order[9]).toBe("classic_gsw_2016_17_p01");
    expect(stale.order[10]).toBe("classic_hou_1994_95_p05");
  });
});
