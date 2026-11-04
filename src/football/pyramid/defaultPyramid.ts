/** Pyramid Top 50 + reserve swap pool — curated defaults + layout helpers. */

import { normalizeDraftSave, type DraftSave } from "./draft";

export const PYRAMID_SIZE = 50;
/** Extra 50 who can be elevated into the Top 50 but hold no Ring position. */
export const PYRAMID_POOL_SIZE = 50;

/** Default row widths from apex (#1) to base — sums to 50 (steps pattern). */
export const PYRAMID_TIER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 14] as const;

/**
 * Mild width hint only — cells fill available row width; avoid shrinking
 * portraits when the shell still has free horizontal space.
 */
export const PYRAMID_TIER_SCALES = [1, 1, 1, 1, 1, 0.98, 0.96, 0.94, 0.9] as const;

/** Display-only tier shapes (rank order unchanged). */
export type PyramidTierPatternId = "steps" | "odds" | "fib" | "positions" | "positionsB" | "list";

export const PYRAMID_TIER_PATTERN_IDS = ["steps", "odds", "fib", "positions", "positionsB", "list"] as const;

/** Row widths per pattern; each sums to {@link PYRAMID_SIZE}. */
export const PYRAMID_TIER_PATTERNS: Record<PyramidTierPatternId, readonly number[]> = {
  /** 1, 2, 3 … 8, then remainder. */
  steps: PYRAMID_TIER_COUNTS,
  /** 1, 3, 5, 7 … then remainder. */
  odds: [1, 3, 5, 7, 9, 11, 14],
  /** Fibonacci rows: 1, then 2, then 3, then 5… remainder on the last row. */
  fib: [1, 2, 3, 5, 8, 13, 18],
  /**
   * POS A — #1 apex, then best available 5-man by primary position, then 10s
   * (two per position), then remainder — see {@link pyramidPositionTeamRows}.
   */
  positions: [1, 5, 10, 10, 10, 14],
  /**
   * POS B — same row widths as POS A, but seats use secondary / adjacent flex
   * (e.g. PF → SF or C; PG → PG or SG).
   */
  positionsB: [1, 5, 10, 10, 10, 14],
  /**
   * Display-only marker for List (rendered as #1 apex + centred wrap in the hub).
   * Kept for pattern id completeness / sum checks.
   */
  /** Single centred wrap — pattern unused by List renderer (all ranks in one flow). */
  list: [50],
};

/**
 * POS A/B with #1 folded into the top five (no solo apex): 5 · 10 · 10 · 10 · 15.
 * Toggle by re-clicking the active POS control — see {@link pyramidPositionTeamRows}.
 */
export const PYRAMID_POSITION_TEAM_COUNTS = [5, 10, 10, 10, 15] as const;

/** How POS layouts assign players to PG→C seats. */
export type PyramidPositionDealMode = "primary" | "secondary";

/**
 * Adjacent flex when a player has no authored secondary positions.
 * PG↔SG, wing continuum, PF↔SF/C — never PG as C.
 */
export const PYRAMID_POSITION_FLEX: Record<PyramidRingPosition, readonly PyramidRingPosition[]> = {
  PG: ["PG", "SG"],
  SG: ["SG", "PG", "SF"],
  SF: ["SF", "SG", "PF"],
  PF: ["PF", "SF", "C"],
  C: ["C", "PF"],
};

export function isPyramidTierPatternId(v: unknown): v is PyramidTierPatternId {
  return typeof v === "string" && (PYRAMID_TIER_PATTERN_IDS as readonly string[]).includes(v);
}

/** Soft per-row scale hints for a given tier-count list. */
export function pyramidTierScalesFor(counts: readonly number[]): number[] {
  if (counts === PYRAMID_TIER_COUNTS || (counts.length === PYRAMID_TIER_SCALES.length && counts.every((c, i) => c === PYRAMID_TIER_COUNTS[i]))) {
    return [...PYRAMID_TIER_SCALES];
  }
  const n = Math.max(1, counts.length);
  return counts.map((_, i) => Math.max(0.88, 1 - (i / n) * 0.12));
}

export type PyramidViewId = "pyramid" | "ring" | "jersey" | "draft";

/** Bump when curated Top 50 / reserve seed changes so saved pyramids refresh. */
export const PYRAMID_SEED_VERSION = 8;

export type PyramidSave = {
  size: typeof PYRAMID_SIZE;
  /** Top 50 player ids; index 0 = rank #1. */
  order: string[];
  /** Reserve 50 — not ranked on the Ring; can swap into `order`. */
  pool: string[];
  view: PyramidViewId;
  /** Curated-seed generation; mismatch replaces order/pool with defaults. */
  seedVersion?: number;
  /** Jersey grid picks: shirt number (0–99 as string) → playerId. */
  jerseyChoice?: Record<string, string>;
  /** Optional snake draft board (You + AI seats). */
  draft?: DraftSave;
};

export const PYRAMID_RING_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type PyramidRingPosition = (typeof PYRAMID_RING_POSITIONS)[number];

/**
 * Curated all-time Top 50 (classic peak forms). Jordan #1.
 * Ids must exist in `public/data/players.json`.
 *
 * Order follows peak OVR bands, then resume/era tie-breaks — not pure sort
 * (e.g. Wilt/Russell stay ahead of later 95s). Post-Shaq 95s: Curry #10,
 * Olajuwon #11, Duncan #12. Jokic held at 93 while still active.
 * One form per player; new classic eras (e.g. Carmelo 90) land in their OVR band.
 */
export const DEFAULT_PYRAMID_ORDER: readonly string[] = [
  "classic_chi_1995_96_p02", // 1 Michael Jordan (99)
  "classic_mia_2012_13_p03", // 2 LeBron James (97)
  "classic_lal_1986_87_p05", // 3 Kareem Abdul-Jabbar (96)
  "classic_lal_1986_87_p01", // 4 Magic Johnson (96)
  "classic_bos_1985_86_p03", // 5 Larry Bird (96)
  "classic_lal_1971_72_p05", // 6 Wilt Chamberlain (95)
  "classic_bos_1964_65_p05", // 7 Bill Russell (95)
  "classic_lal_2009_10_p02", // 8 Kobe Bryant — 2009/10 kit #24 (not 2000/01 #8) (96)
  "classic_lal_2000_01_p05", // 9 Shaquille O'Neal (95)
  "classic_gsw_2016_17_p01", // 10 Stephen Curry (95)
  "classic_hou_1994_95_p05", // 11 Hakeem Olajuwon (95)
  "classic_sas_1998_99_p04", // 12 Tim Duncan (95)
  "classic_mil_2020_21_p03", // 13 Giannis Antetokounmpo (94)
  "classic_gsw_2016_17_p03", // 14 Kevin Durant (94)
  "classic_cin_1963_64_p01", // 15 Oscar Robertson (94)
  "classic_lal_1971_72_p01", // 16 Jerry West (93)
  "classic_den_2022_23_p05", // 17 Nikola Jokic (93 — active career)
  "classic_phi_1982_83_p03", // 18 Julius Erving (93)
  "classic_phi_1982_83_p05", // 19 Moses Malone (93)
  "classic_bos_2007_08_p04", // 20 Kevin Garnett (93)
  "classic_dal_2010_11_p04", // 21 Dirk Nowitzki (92)
  "classic_mia_2012_13_p02", // 22 Dwyane Wade (92)
  "classic_phx_1992_93_p04", // 23 Charles Barkley (92)
  "classic_uta_1997_98_p04", // 24 Karl Malone (92)
  "classic_sas_1998_99_p05", // 25 David Robinson (92)
  "classic_uta_1997_98_p01", // 26 John Stockton (91)
  "classic_det_1988_89_p01", // 27 Isiah Thomas (91)
  "classic_chi_1995_96_p03", // 28 Scottie Pippen (93)
  "classic_sas_2013_14_p03", // 29 Kawhi Leonard (92)
  "classic_lal_1971_72_p11", // 30 Elgin Baylor (92)
  "classic_phi_2000_01_p01", // 31 Allen Iverson (90)
  "classic_nyk_1993_94_p05", // 32 Patrick Ewing (90)
  "classic_okc_1995_96_p01", // 33 Gary Payton (90)
  "classic_phx_2004_05_p01", // 34 Steve Nash (91)
  "classic_hou_1994_95_p02", // 35 Clyde Drexler (90)
  "classic_lal_1986_87_p03", // 36 James Worthy (90)
  "classic_bos_1985_86_p04", // 37 Kevin McHale (90)
  "classic_hou_2006_07_p02", // 38 Tracy McGrady (90)
  "classic_bos_1964_65_p03", // 39 John Havlicek (91)
  "classic_orl_1994_95_p01", // 40 Anfernee Hardaway (91)
  "classic_hou_2018_19_p01", // 41 Chris Paul (91)
  "classic_sac_2001_02_p04", // 42 Chris Webber (91)
  "classic_was_2007_08_p01", // 43 Gilbert Arenas (91)
  "classic_det_1996_97_p03", // 44 Grant Hill (91)
  "classic_was_2016_17_p01", // 45 John Wall (91)
  "classic_cle_2015_16_p01", // 46 Kyrie Irving (91)
  "classic_uta_1976_77_p02", // 47 Pete Maravich (91)
  "classic_cha_1992_93_p05", // 48 Alonzo Mourning (90)
  "classic_lac_2013_14_p04", // 49 Blake Griffin (90)
  "classic_nyk_2011_12_p03", // 50 Carmelo Anthony (90)
];

/**
 * Curated reserve 51–100 — elevate/swap into Top 50; excluded from Ring.
 * Ordered by peak overall (then name), not by club — avoids team clumps.
 * When classic eras add/remove high-OVR names, bump {@link PYRAMID_SEED_VERSION}.
 */
export const DEFAULT_PYRAMID_POOL: readonly string[] = [
  "classic_hou_2018_19_p02", // 51 James Harden (90)
  "classic_dal_2010_11_p01", // 52 Jason Kidd (90)
  "classic_atl_1990_91_p03", // 53 Dominique Wilkins (89)
  "classic_gsw_2016_17_p02", // 54 Klay Thompson (89)
  "classic_sas_2013_14_p02", // 55 Manu Ginobili (89)
  "classic_bos_2007_08_p03", // 56 Paul Pierce (89)
  "classic_mia_2012_13_p06", // 57 Ray Allen (89)
  "classic_ind_1999_00_p02", // 58 Reggie Miller (89)
  "classic_okc_2011_12_p01", // 59 Russell Westbrook (89)
  "classic_phx_2004_05_p05", // 60 Amar'e Stoudemire (88)
  "classic_was_2016_17_p02", // 61 Bradley Beal (88)
  "classic_mia_2012_13_p05", // 62 Chris Bosh (88)
  "classic_chi_1995_96_p04", // 63 Dennis Rodman (88)
  "classic_gsw_2016_17_p04", // 64 Draymond Green (88)
  "classic_cin_1963_64_p10", // 65 Jerry Lucas (88)
  "classic_cle_2015_16_p04", // 66 Kevin Love (88)
  "classic_cha_1992_93_p04", // 67 Larry Johnson (88)
  "classic_lal_2009_10_p04", // 68 Pau Gasol (88)
  "classic_dal_2010_11_p07", // 69 Peja Stojakovic (88)
  "classic_bos_1985_86_p05", // 70 Robert Parish (88)
  "classic_bos_1964_65_p02", // 71 Sam Jones (88)
  "classic_okc_1995_96_p04", // 72 Shawn Kemp (88)
  "classic_bkn_2000_01_p01", // 73 Stephon Marbury (88)
  "classic_sas_2013_14_p01", // 74 Tony Parker (88)
  "classic_tor_2000_01_p02", // 75 Vince Carter (88)
  "classic_hou_2006_07_p05", // 76 Yao Ming (88)
  "classic_bos_1985_86_p06", // 77 Bill Walton (87)
  "classic_den_2022_23_p01", // 78 Jamal Murray (87)
  "classic_gsw_2016_17_p06", // 79 Andre Iguodala (86)
  "classic_por_1999_00_p05", // 80 Arvydas Sabonis (86)
  "classic_ind_1999_00_p10", // 81 Chris Mullin (86)
  "classic_phi_2000_01_p05", // 82 Dikembe Mutombo (86)
  "classic_lal_1971_72_p02", // 83 Gail Goodrich (86)
  "classic_det_1988_89_p02", // 84 Joe Dumars (86)
  "classic_mil_2020_21_p01", // 85 Jrue Holiday (86)
  "classic_phx_1992_93_p01", // 86 Kevin Johnson (86)
  "classic_mil_2020_21_p02", // 87 Khris Middleton (86)
  "classic_lal_2009_10_p06", // 88 Lamar Odom (86)
  "classic_phi_1982_83_p01", // 89 Maurice Cheeks (86)
  "classic_sac_2001_02_p01", // 90 Mike Bibby (86)
  "classic_nyk_2011_12_p05", // 91 Tyson Chandler — Knicks form (86)
  "classic_bos_1985_86_p01", // 92 Dennis Johnson (85)
  "classic_por_1999_00_p04", // 93 Rasheed Wallace (85)
  "classic_lal_2009_10_p05", // 94 Andrew Bynum (84)
  "classic_lal_2000_01_p04", // 95 Horace Grant (84)
  "classic_uta_1997_98_p02", // 96 Jeff Hornacek (84)
  "classic_nyk_2011_12_p01", // 97 Jeremy Lin (84)
  "classic_lal_2009_10_p03", // 98 Metta World Peace (84)
  "classic_orl_1994_95_p02", // 99 Nick Anderson (84)
  "classic_chi_1995_96_p06", // 100 Toni Kukoc (84)
];

export function defaultPyramidSave(): PyramidSave {
  return {
    size: PYRAMID_SIZE,
    order: [...DEFAULT_PYRAMID_ORDER],
    pool: [...DEFAULT_PYRAMID_POOL],
    view: "pyramid",
    seedVersion: PYRAMID_SEED_VERSION,
  };
}

function isPyramidViewId(v: unknown): v is PyramidViewId {
  return v === "pyramid" || v === "ring" || v === "jersey" || v === "draft";
}

function pushUniqueIds(
  out: string[],
  seen: Set<string>,
  raw: unknown,
  knownIds?: ReadonlySet<string> | null,
  exclude?: ReadonlySet<string> | null,
): void {
  if (!Array.isArray(raw)) return;
  for (const id of raw) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (exclude?.has(trimmed)) continue;
    if (knownIds && !knownIds.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
}

/** Keep unique ids, prefer saved order, pad from default seed, trim to 50. */
export function normalizePyramidOrder(
  raw: unknown,
  knownIds?: ReadonlySet<string> | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  pushUniqueIds(out, seen, raw, knownIds);
  pushUniqueIds(out, seen, DEFAULT_PYRAMID_ORDER, knownIds);
  return out.slice(0, PYRAMID_SIZE);
}

/** Reserve pool — excludes anyone already in the Top 50 order. */
export function normalizePyramidPool(
  raw: unknown,
  order: readonly string[],
  knownIds?: ReadonlySet<string> | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>(order);
  pushUniqueIds(out, seen, raw, knownIds, new Set(order));
  pushUniqueIds(out, seen, DEFAULT_PYRAMID_POOL, knownIds, new Set(order));
  pushUniqueIds(out, seen, DEFAULT_PYRAMID_ORDER, knownIds, new Set(order));
  return out.slice(0, PYRAMID_POOL_SIZE);
}

export function normalizePyramidSave(
  raw: unknown,
  knownIds?: ReadonlySet<string> | null,
): PyramidSave {
  const o = raw && typeof raw === "object" ? (raw as Partial<PyramidSave>) : null;
  const view: PyramidViewId = isPyramidViewId(o?.view) ? o.view : "pyramid";
  // Stale curated seed (or first load) → install the current Top 50 / reserve.
  if (!o || o.seedVersion !== PYRAMID_SEED_VERSION) {
    return { ...defaultPyramidSave(), view };
  }
  const order = normalizePyramidOrder(o.order, knownIds);
  const jerseyChoice = normalizeJerseyChoice(o.jerseyChoice, knownIds);
  const draft = o.draft != null ? normalizeDraftSave(o.draft) : undefined;
  return {
    size: PYRAMID_SIZE,
    order,
    pool: normalizePyramidPool(o.pool, order, knownIds),
    view,
    seedVersion: PYRAMID_SEED_VERSION,
    ...(Object.keys(jerseyChoice).length ? { jerseyChoice } : {}),
    ...(draft ? { draft } : {}),
  };
}

/** Keep valid 0–99 → playerId picks; drop unknown ids. */
export function normalizeJerseyChoice(
  raw: unknown,
  knownIds?: ReadonlySet<string> | null,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 0 || n > 99) continue;
    if (typeof val !== "string" || !val.trim()) continue;
    const id = val.trim();
    if (knownIds && !knownIds.has(id)) continue;
    out[String(n)] = id;
  }
  return out;
}

export function ensurePyramidSave(
  save: { data: { pyramid?: PyramidSave | null }; save: () => void },
  knownIds?: ReadonlySet<string> | null,
): PyramidSave {
  const next = normalizePyramidSave(save.data.pyramid, knownIds);
  save.data.pyramid = next;
  return next;
}

export function movePyramidIndex(order: readonly string[], from: number, to: number): string[] {
  const n = order.length;
  if (n === 0) return [];
  const src = ((from % n) + n) % n;
  const dst = Math.max(0, Math.min(n - 1, to));
  if (src === dst) return [...order];
  const next = [...order];
  const [item] = next.splice(src, 1);
  if (!item) return [...order];
  next.splice(dst, 0, item);
  return next;
}

export function swapPyramidNeighbor(
  order: readonly string[],
  index: number,
  dir: -1 | 1,
): string[] {
  const j = index + dir;
  if (index < 0 || index >= order.length || j < 0 || j >= order.length) return [...order];
  const next = [...order];
  const a = next[index]!;
  next[index] = next[j]!;
  next[j] = a;
  return next;
}

export function swapPyramidWithPool(
  order: readonly string[],
  pool: readonly string[],
  orderIndex: number,
  poolIndex: number,
): { order: string[]; pool: string[] } {
  if (
    orderIndex < 0 ||
    orderIndex >= order.length ||
    poolIndex < 0 ||
    poolIndex >= pool.length
  ) {
    return { order: [...order], pool: [...pool] };
  }
  const nextOrder = [...order];
  const nextPool = [...pool];
  const a = nextOrder[orderIndex]!;
  nextOrder[orderIndex] = nextPool[poolIndex]!;
  nextPool[poolIndex] = a;
  return { order: nextOrder, pool: nextPool };
}

/** Elevate pool player into Top 50 by swapping with #50 (last ranked). */
export function elevatePoolToPyramid(
  order: readonly string[],
  pool: readonly string[],
  poolIndex: number,
): { order: string[]; pool: string[] } {
  if (!order.length) return { order: [...order], pool: [...pool] };
  return swapPyramidWithPool(order, pool, order.length - 1, poolIndex);
}

/** Place a DB player into a reserve slot (displaces whoever was there). */
export function placePlayerInPool(
  order: readonly string[],
  pool: readonly string[],
  playerId: string,
  poolIndex = pool.length - 1,
): string[] {
  const id = playerId.trim();
  if (!id || order.includes(id)) return [...pool];
  if (poolIndex < 0 || poolIndex >= pool.length) return [...pool];
  const existing = pool.indexOf(id);
  if (existing === poolIndex) return [...pool];
  const next = [...pool];
  if (existing >= 0) {
    const [item] = next.splice(existing, 1);
    next.splice(poolIndex, 0, item!);
    return next.slice(0, pool.length);
  }
  next[poolIndex] = id;
  return next;
}

export type PyramidTierRow = {
  tier: number;
  entries: { rank: number; playerId: string; index: number }[];
};

export function pyramidTierRows(
  order: readonly string[],
  counts: readonly number[] = PYRAMID_TIER_COUNTS,
): PyramidTierRow[] {
  const rows: PyramidTierRow[] = [];
  let cursor = 0;
  for (let t = 0; t < counts.length; t++) {
    const count = counts[t]!;
    const entries: PyramidTierRow["entries"] = [];
    for (let i = 0; i < count && cursor < order.length; i++) {
      entries.push({ rank: cursor + 1, playerId: order[cursor]!, index: cursor });
      cursor += 1;
    }
    if (entries.length) rows.push({ tier: t + 1, entries });
  }
  // Safety: any leftover ranks after a bad counts array still render.
  if (cursor < order.length) {
    const entries: PyramidTierRow["entries"] = [];
    while (cursor < order.length) {
      entries.push({ rank: cursor + 1, playerId: order[cursor]!, index: cursor });
      cursor += 1;
    }
    rows.push({ tier: rows.length + 1, entries });
  }
  return rows;
}

export type PyramidRingSlot = {
  playerId: string;
  rank: number;
  index: number;
  position: PyramidRingPosition;
  /** Degrees on the orbit (0 = top). */
  angleDeg: number;
  /** 0 = near center, 1 = outer rim — within that position's rings. */
  radiusT: number;
  /** Card size vs base ring card (outer rings shrink). */
  scale: number;
};

export function normalizeRingPosition(raw: string | undefined | null): PyramidRingPosition {
  const p = (raw ?? "").toUpperCase();
  if (p === "PG" || p === "SG" || p === "SF" || p === "PF" || p === "C") return p;
  // Basketball secondaries / football leftovers → nearest ring wedge.
  if (p === "G" || p === "PG/SG") return "PG";
  if (p === "F" || p === "SF/PF") return "SF";
  if (p === "FC" || p === "PF/C") return "PF";
  return "SF";
}

/**
 * Seat eligibility for POS A (primary only) or POS B (authored secondaries, else adjacent flex).
 */
export function pyramidEligiblePositions(
  primary: string | null | undefined,
  secondary: readonly string[] | null | undefined,
  mode: PyramidPositionDealMode = "primary",
): PyramidRingPosition[] {
  const prim = normalizeRingPosition(primary);
  if (mode === "primary") return [prim];
  const secs = (secondary ?? []).map((s) => normalizeRingPosition(s));
  if (secs.length) return [...new Set([prim, ...secs])];
  // No authored secondary — allow adjacent flex (PF→SF/C, PG→SG, …).
  return [...(PYRAMID_POSITION_FLEX[prim] ?? [prim])];
}

export type PyramidPositionTeamOpts = {
  /**
   * When true, fold pyramid #1 into the first balanced five (no solo apex row).
   * When false (default), #1 stays alone on top and teams deal from #2 onward.
   */
  apexInTopTeam?: boolean;
  counts?: readonly number[];
  /** POS A = primary; POS B = secondary / adjacent flex. */
  dealMode?: PyramidPositionDealMode;
  /** Required for POS B when dealing from authored secondaries. */
  secondaryOf?: (playerId: string) => readonly string[] | null | undefined;
};

/**
 * POS A / POS B display: deal players into balanced “best available” lineups
 * (PG→C), greedy by rank. Tier of 5 → one each; tier of 10 → two each;
 * other widths take as many full five-man rounds as fit, then leftover by rank.
 *
 * POS A seats by primary only. POS B seats by secondary positions when authored,
 * otherwise adjacent flex (PF→SF/C, PG→PG/SG, never PG as C).
 *
 * Default keeps #1 alone at the apex. With `apexInTopTeam`, #1 seats in the top
 * five at an eligible position and the remaining teams reshuffle from what’s left.
 */
export function pyramidPositionTeamRows(
  order: readonly string[],
  positionOf: (playerId: string) => string | undefined | null,
  countsOrOpts: readonly number[] | PyramidPositionTeamOpts = PYRAMID_TIER_PATTERNS.positions,
): PyramidTierRow[] {
  const opts: PyramidPositionTeamOpts = Array.isArray(countsOrOpts)
    ? { counts: countsOrOpts }
    : countsOrOpts;
  const apexInTopTeam = opts.apexInTopTeam === true;
  const dealMode: PyramidPositionDealMode = opts.dealMode === "secondary" ? "secondary" : "primary";
  const counts =
    opts.counts ??
    (apexInTopTeam ? PYRAMID_POSITION_TEAM_COUNTS : PYRAMID_TIER_PATTERNS.positions);

  type Seat = {
    rank: number;
    playerId: string;
    index: number;
    pos: PyramidRingPosition;
    eligible: PyramidRingPosition[];
  };
  const remaining: Seat[] = order.map((playerId, index) => {
    const primary = positionOf(playerId);
    const secondary = opts.secondaryOf?.(playerId);
    return {
      playerId,
      rank: index + 1,
      index,
      pos: normalizeRingPosition(primary),
      eligible: pyramidEligiblePositions(primary, secondary, dealMode),
    };
  });

  const takeBest = (pos?: PyramidRingPosition): Seat | null => {
    if (!remaining.length) return null;
    if (pos) {
      // Prefer a natural primary match, then any eligible flex/secondary.
      let i = remaining.findIndex((s) => s.pos === pos);
      if (i < 0) i = remaining.findIndex((s) => s.eligible.includes(pos));
      if (i >= 0) return remaining.splice(i, 1)[0] ?? null;
    }
    return remaining.shift() ?? null;
  };

  const takeBalancedRound = (): Seat[] => {
    const round: Seat[] = [];
    for (const pos of PYRAMID_RING_POSITIONS) {
      const seat = takeBest(pos);
      if (seat) round.push(seat);
    }
    return round;
  };

  const fillTeamTier = (need: number, entries: PyramidTierRow["entries"]): void => {
    const fullRounds = Math.floor(need / PYRAMID_RING_POSITIONS.length);
    for (let r = 0; r < fullRounds; r++) {
      for (const seat of takeBalancedRound()) {
        entries.push({ rank: seat.rank, playerId: seat.playerId, index: seat.index });
      }
    }
    while (entries.length < need) {
      const seat = takeBest();
      if (!seat) break;
      entries.push({ rank: seat.rank, playerId: seat.playerId, index: seat.index });
    }
  };

  const rows: PyramidTierRow[] = [];
  for (let t = 0; t < counts.length; t++) {
    const need = counts[t]!;
    const entries: PyramidTierRow["entries"] = [];

    if (t === 0 && !apexInTopTeam && need === 1) {
      // Solo apex is current pyramid #1 (rank order), not re-picked by position.
      const apex = remaining.shift();
      if (apex) entries.push({ rank: apex.rank, playerId: apex.playerId, index: apex.index });
    } else {
      fillTeamTier(need, entries);
    }

    if (entries.length) rows.push({ tier: t + 1, entries });
  }

  if (remaining.length) {
    rows.push({
      tier: rows.length + 1,
      entries: remaining.map((s) => ({ rank: s.rank, playerId: s.playerId, index: s.index })),
    });
  }
  return rows;
}

/** Cards per ring in a position wedge — 1 on the inner, then 2, then up to 3. */
function ringCapacity(ring: number): number {
  if (ring <= 0) return 1;
  if (ring === 1) return 2;
  return 3;
}

/**
 * Place ranks 2..N on five position wedges around #1.
 * Per position: best ranks nearest the centre; outer rings take more abreast and
 * step farther out so layers 3–4 stay readable instead of stacking on top of each other.
 */
export function buildPyramidRingSlots(
  order: readonly string[],
  positionOf: (playerId: string) => string | undefined | null,
): { centerId: string | null; slots: PyramidRingSlot[] } {
  if (!order.length) return { centerId: null, slots: [] };
  const centerId = order[0] ?? null;
  const byPos: Record<PyramidRingPosition, { playerId: string; rank: number; index: number }[]> = {
    PG: [],
    SG: [],
    SF: [],
    PF: [],
    C: [],
  };
  for (let i = 1; i < order.length; i++) {
    const id = order[i]!;
    const pos = normalizeRingPosition(positionOf(id));
    byPos[pos].push({ playerId: id, rank: i + 1, index: i });
  }
  const slots: PyramidRingSlot[] = [];
  const wedge = 360 / PYRAMID_RING_POSITIONS.length;
  for (let w = 0; w < PYRAMID_RING_POSITIONS.length; w++) {
    const pos = PYRAMID_RING_POSITIONS[w]!;
    // Best overall ranks first within the wedge.
    const group = [...byPos[pos]].sort((a, b) => a.rank - b.rank);
    const n = group.length;
    if (!n) continue;
    const mid = w * wedge + wedge / 2 - 90;
    let ringsNeeded = 0;
    let left = n;
    while (left > 0) {
      left -= Math.min(ringCapacity(ringsNeeded), left);
      ringsNeeded += 1;
    }
    const ringDenom = Math.max(1, ringsNeeded - 1);
    let cursor = 0;
    for (let ring = 0; ring < ringsNeeded; ring++) {
      const capacity = ringCapacity(ring);
      const take = Math.min(capacity, n - cursor);
      // Even radial steps 0…1; single-ring wedges sit mid-band.
      const radiusT = ringsNeeded <= 1 ? 0.42 : ring / ringDenom;
      // Mild shrink — prefer spacing over crushing outer cards.
      const scale = Math.max(0.5, 1 - ring * 0.09);
      // Angular fan within the wedge; grows on outer rings.
      const fan = (wedge * 0.32) * (0.9 + ring * 0.14);
      for (let j = 0; j < take; j++) {
        const entry = group[cursor + j]!;
        let angleDeg = mid;
        if (take === 2) {
          angleDeg = mid + (j === 0 ? -fan : fan);
        } else if (take >= 3) {
          const t = take === 1 ? 0 : (j / (take - 1)) * 2 - 1; // -1 … +1
          angleDeg = mid + t * fan;
        }
        slots.push({
          playerId: entry.playerId,
          rank: entry.rank,
          index: entry.index,
          position: pos,
          angleDeg,
          radiusT,
          scale,
        });
      }
      cursor += take;
    }
  }
  return { centerId, slots };
}
