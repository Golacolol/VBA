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
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_lal_1953_54_p05"); // George Mikan
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_nyk_2011_12_p03"); // Carmelo → reserve
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_gsw_2016_17_p04"); // Draymond Green (peak → Top 50)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_lal_2019_20_p05"); // Dwight Howard → reserve
    expect(DEFAULT_PYRAMID_ORDER).not.toContain("classic_was_2007_08_p01"); // Arenas → reserve
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_det_1996_97_p03"); // Grant Hill
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_lal_2009_10_p02"); // Kobe #24 (09/10)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_was_2007_08_p01"); // Gilbert Arenas (88 → reserve)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_was_2016_17_p02"); // Bradley Beal (86 → mid reserve)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_tor_2000_01_p02"); // Vince Carter (88 → reserve)
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_lal_2009_10_p04"); // Pau Gasol (88 → reserve)
    // Current stars fill high reserve seats when outside Top 50.
    expect(DEFAULT_PYRAMID_POOL[0]).toBe("espn_4278073"); // SGA #51
    expect(DEFAULT_PYRAMID_POOL).toContain("espn_3945274"); // Luka
    expect(DEFAULT_PYRAMID_POOL).toContain("espn_5104157"); // Wemby
    expect(DEFAULT_PYRAMID_ORDER).toContain("classic_hou_2018_19_p02"); // Harden peak → Top 50
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_was_2016_17_p01"); // John Wall → reserve
    expect(DEFAULT_PYRAMID_ORDER).not.toContain("classic_was_2016_17_p01");
    // Classics reclaim mid-reserve seats; Lillard holds #112, Trae sits later at #126.
    const sabonis = DEFAULT_PYRAMID_POOL.indexOf("classic_por_1999_00_p05");
    const trae = DEFAULT_PYRAMID_POOL.indexOf("espn_4277905");
    const beal = DEFAULT_PYRAMID_POOL.indexOf("classic_was_2016_17_p02");
    const fox = DEFAULT_PYRAMID_POOL.indexOf("espn_4066259");
    const lillard = DEFAULT_PYRAMID_POOL.indexOf("espn_6606");
    expect(sabonis).toBeGreaterThanOrEqual(0);
    expect(sabonis).toBeLessThan(beal);
    expect(lillard).toBe(112 - 51);
    expect(beal).toBeLessThan(fox);
    expect(fox).toBeLessThan(trae);
    expect(trae).toBe(126 - 51);
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

  it("deals POS B preferring primary seats and never PF as SF", () => {
    expect(pyramidEligiblePositions("PF", [], "secondary")).toEqual(["PF", "C"]);
    expect(pyramidEligiblePositions("PF", [], "secondary")).not.toContain("SF");
    expect(pyramidEligiblePositions("PF", ["SF"], "secondary")).toEqual(["PF"]);
    expect(pyramidEligiblePositions("PG", [], "secondary")).toEqual(["PG", "SG"]);
    expect(pyramidEligiblePositions("PG", [], "secondary")).not.toContain("C");

    // Higher SG must not steal SF while both holes are open (no SG↔SF swap).
    const swapOrder = ["starSG", "roleSF", "pg", "pf", "c"];
    const swapPos = new Map([
      ["starSG", "SG"],
      ["roleSF", "SF"],
      ["pg", "PG"],
      ["pf", "PF"],
      ["c", "C"],
    ]);
    const noSwap = pyramidPositionTeamRows(swapOrder, (id) => swapPos.get(id), {
      dealMode: "secondary",
      counts: [5],
    });
    expect(noSwap[0]!.entries.map((e) => e.playerId)).toEqual(["pg", "starSG", "roleSF", "pf", "c"]);

    // Folded #1 keeps their main seat (SG), not a flex wing.
    const folded = pyramidPositionTeamRows(swapOrder, (id) => swapPos.get(id), {
      dealMode: "secondary",
      apexInTopTeam: true,
      counts: [5],
    });
    expect(folded[0]!.entries.map((e) => e.playerId)).toEqual(["pg", "starSG", "roleSF", "pf", "c"]);

    // POS B fills a missing PG with the second SG via flex (after SG is locked).
    const order = ["sg1", "sg2", "sf", "pf", "c"];
    const pos = new Map([
      ["sg1", "SG"],
      ["sg2", "SG"],
      ["sf", "SF"],
      ["pf", "PF"],
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
    // POS A: no PG → four starters + leftover sg2. POS B: sg2 flexes into the PG hole.
    expect(posA[0]!.entries.map((e) => e.playerId)).toEqual(["sg1", "sf", "pf", "c", "sg2"]);
    expect(posB[0]!.entries.map((e) => e.playerId)).toEqual(["sg2", "sg1", "sf", "pf", "c"]);
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
    expect(defaultPyramidSave().seedVersion).toBe(25);
    expect(DEFAULT_PYRAMID_ORDER[9]).toBe("classic_gsw_2016_17_p01"); // Curry #10
    expect(DEFAULT_PYRAMID_ORDER[10]).toBe("classic_hou_1994_95_p05"); // Olajuwon #11
    expect(DEFAULT_PYRAMID_ORDER[14]).toBe("classic_cin_1963_64_p01"); // Oscar #15
    expect(DEFAULT_PYRAMID_ORDER[15]).toBe("classic_lal_1971_72_p01"); // West #16
    expect(DEFAULT_PYRAMID_ORDER[16]).toBe("classic_den_2022_23_p05"); // Jokic #17 (93 active)
    expect(DEFAULT_PYRAMID_ORDER[20]).toBe("classic_det_1988_89_p01"); // Isiah #21
    expect(DEFAULT_PYRAMID_ORDER[21]).toBe("classic_lal_1953_54_p05"); // Mikan #22
    expect(DEFAULT_PYRAMID_ORDER[23]).toBe("classic_phi_2000_01_p01"); // Iverson #24
    expect(DEFAULT_PYRAMID_ORDER[25]).toBe("classic_mia_2012_13_p02"); // Wade #26
    expect(DEFAULT_PYRAMID_ORDER[31]).toBe("classic_chi_2010_11_p01"); // Rose #32 (swapped w/ Baylor)
    expect(DEFAULT_PYRAMID_ORDER[32]).toBe("classic_lal_1971_72_p11"); // Baylor #33
    expect(DEFAULT_PYRAMID_ORDER[34]).toBe("classic_bos_1985_86_p04"); // McHale #35
    expect(DEFAULT_PYRAMID_ORDER[35]).toBe("classic_lal_1986_87_p03"); // Worthy #36
    expect(DEFAULT_PYRAMID_ORDER[39]).toBe("classic_phx_2004_05_p01"); // Nash #40
    expect(DEFAULT_PYRAMID_ORDER[40]).toBe("classic_okc_1995_96_p01"); // Payton #41
    expect(DEFAULT_PYRAMID_ORDER[48]).toBe("classic_mia_2012_13_p06"); // Ray Allen #49
    expect(DEFAULT_PYRAMID_ORDER[49]).toBe("classic_gsw_2016_17_p02"); // Klay #50
    expect(DEFAULT_PYRAMID_POOL[64 - 51]).toBe("classic_uta_1976_77_p02"); // Maravich #64
    expect(DEFAULT_PYRAMID_ORDER).not.toContain("classic_uta_1976_77_p02");
    expect(DEFAULT_PYRAMID_ORDER).not.toContain("classic_cha_1992_93_p05"); // Mourning → reserve
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_cha_1992_93_p05"); // Mourning → reserve
    expect(DEFAULT_PYRAMID_POOL).not.toContain("classic_gsw_2016_17_p02"); // Klay elevated
    expect(DEFAULT_PYRAMID_POOL).not.toContain("classic_mia_2012_13_p06"); // Ray elevated
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_lac_2013_14_p04"); // Blake → reserve
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_det_2003_04_p01"); // Billups
    expect(DEFAULT_PYRAMID_POOL).toContain("classic_det_2003_04_p05"); // Ben Wallace
    expect(DEFAULT_PYRAMID_POOL[112 - 51]).toBe("espn_6606"); // Lillard #112
    expect(DEFAULT_PYRAMID_POOL[126 - 51]).toBe("espn_4277905"); // Trae #126
    expect(DEFAULT_PYRAMID_POOL[144 - 51]).toBe("classic_bkn_2000_01_p13"); // Kenyon #144
    expect(DEFAULT_PYRAMID_POOL).not.toContain("classic_bos_1964_65_p04"); // Heinsohn replaced
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
    expect(stale.order).toContain("classic_lal_1953_54_p05"); // Mikan
    expect(stale.order).toContain("classic_chi_2010_11_p01"); // Rose MVP
    expect(stale.order[20]).toBe("classic_det_1988_89_p01"); // Isiah #21
    expect(stale.order[31]).toBe("classic_chi_2010_11_p01"); // Rose #32
    expect(stale.pool).toContain("classic_nyk_2011_12_p03"); // Carmelo → reserve
    expect(stale.order).toContain("classic_orl_1994_95_p01");
    expect(stale.order).toContain("classic_lal_2009_10_p02");
    expect(stale.pool).toContain("classic_okc_2011_12_p01"); // Westbrook → reserve
    expect(stale.pool).toContain("classic_lal_2009_10_p04"); // Pau → reserve
    expect(stale.pool).toContain("classic_tor_2000_01_p02"); // Vince → reserve
    expect(stale.pool).toContain("classic_det_2003_04_p01"); // Billups
    expect(stale.pool).toContain("classic_lal_2019_20_p05"); // Dwight
    expect(stale.seedVersion).toBe(25);
    expect(stale.order[9]).toBe("classic_gsw_2016_17_p01");
    expect(stale.order[10]).toBe("classic_hou_1994_95_p05");
  });
});
