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
export type PyramidTierPatternId = "steps" | "odds" | "fib" | "positions" | "list";

export const PYRAMID_TIER_PATTERN_IDS = ["steps", "odds", "fib", "positions", "list"] as const;

/** Row widths per pattern; each sums to {@link PYRAMID_SIZE}. */
export const PYRAMID_TIER_PATTERNS: Record<PyramidTierPatternId, readonly number[]> = {
  /** 1, 2, 3 … 8, then remainder. */
  steps: PYRAMID_TIER_COUNTS,
  /** 1, 3, 5, 7 … then remainder. */
  odds: [1, 3, 5, 7, 9, 11, 14],
  /** Fibonacci rows: 1, then 2, then 3, then 5… remainder on the last row. */
  fib: [1, 2, 3, 5, 8, 13, 18],
  /**
   * #1 apex, then best available 5-man (one per position), then 10s
   * (two per position), then remainder — see {@link pyramidPositionTeamRows}.
   */
  positions: [1, 5, 10, 10, 10, 14],
  /**
   * Display-only marker for List (rendered as #1 apex + centred wrap in the hub).
   * Kept for pattern id completeness / sum checks.
   */
  list: [1, 49],
};

/**
 * 1-5-10 with #1 folded into the top five (no solo apex): 5 · 10 · 10 · 10 · 15.
 * Toggle via the 1-5-10 control — see {@link pyramidPositionTeamRows}.
 */
export const PYRAMID_POSITION_TEAM_COUNTS = [5, 10, 10, 10, 15] as const;

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
export const PYRAMID_SEED_VERSION = 7;

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
  "classic_dal_2010_11_p04", // 21 Dirk Nowitzki
  "classic_mia_2012_13_p02", // 22 Dwyane Wade
  "classic_phx_1992_93_p04", // 23 Charles Barkley
  "classic_uta_1997_98_p04", // 24 Karl Malone
  "classic_sas_1998_99_p05", // 25 David Robinson
  "classic_uta_1997_98_p01", // 26 John Stockton
  "classic_det_1988_89_p01", // 27 Isiah Thomas
  "classic_chi_1995_96_p03", // 28 Scottie Pippen
  "classic_sas_2013_14_p03", // 29 Kawhi Leonard
  "classic_phi_2000_01_p01", // 30 Allen Iverson
  "classic_nyk_1993_94_p05", // 31 Patrick Ewing
  "classic_okc_1995_96_p01", // 32 Gary Payton
  "classic_phx_2004_05_p01", // 33 Steve Nash
  "classic_hou_1994_95_p02", // 34 Clyde Drexler
  "classic_lal_1986_87_p03", // 35 James Worthy
  "classic_bos_1985_86_p04", // 36 Kevin McHale
  "classic_hou_2006_07_p02", // 37 Tracy McGrady
  "classic_lal_1971_72_p11", // 38 Elgin Baylor
  "classic_bos_1964_65_p03", // 39 John Havlicek
  "classic_tor_2000_01_p02", // 40 Vince Carter
  "classic_ind_1999_00_p02", // 41 Reggie Miller
  "classic_orl_1994_95_p01", // 42 Anfernee Hardaway (Magic 94/95)
  "classic_lal_2009_10_p04", // 43 Pau Gasol (Lakers 09/10)
  "classic_mia_2012_13_p06", // 44 Ray Allen
  "classic_bos_2007_08_p03", // 45 Paul Pierce
  "classic_uta_1976_77_p02", // 46 Pete Maravich
  "classic_hou_2018_19_p01", // 47 Chris Paul
  "classic_okc_2011_12_p01", // 48 Russell Westbrook
  "classic_hou_2018_19_p02", // 49 James Harden
  "classic_sac_2001_02_p04", // 50 Chris Webber
];

/**
 * Curated reserve 51–100 — elevate/swap into Top 50; excluded from Ring.
 * Ordered by peak overall (then name), not by club — avoids team clumps.
 */
export const DEFAULT_PYRAMID_POOL: readonly string[] = [
  "classic_dal_2010_11_p01", // 51 Jason Kidd (90)
  "classic_atl_1990_91_p03", // 52 Dominique Wilkins (89)
  "classic_gsw_2016_17_p02", // 53 Klay Thompson (89)
  "classic_sas_2013_14_p02", // 54 Manu Ginobili (89)
  "classic_phx_2004_05_p05", // 55 Amar'e Stoudemire (88)
  "classic_mia_2012_13_p05", // 56 Chris Bosh (88)
  "classic_chi_1995_96_p04", // 57 Dennis Rodman (88)
  "classic_gsw_2016_17_p04", // 58 Draymond Green (88)
  "classic_cin_1963_64_p10", // 59 Jerry Lucas (88)
  "classic_cha_1992_93_p04", // 60 Larry Johnson (88)
  "classic_bos_1985_86_p05", // 61 Robert Parish (88)
  "classic_bos_1964_65_p02", // 62 Sam Jones (88)
  "classic_okc_1995_96_p04", // 63 Shawn Kemp (88)
  "classic_bkn_2000_01_p01", // 64 Stephon Marbury (88)
  "classic_sas_2013_14_p01", // 65 Tony Parker (88)
  "classic_hou_2006_07_p05", // 66 Yao Ming (88)
  "classic_bos_1985_86_p06", // 67 Bill Walton (87)
  "classic_den_2022_23_p01", // 68 Jamal Murray (87)
  "classic_gsw_2016_17_p06", // 69 Andre Iguodala (86)
  "classic_phi_2000_01_p05", // 70 Dikembe Mutombo (86)
  "classic_det_1988_89_p02", // 71 Joe Dumars (86)
  "classic_mil_2020_21_p01", // 72 Jrue Holiday (86)
  "classic_phx_1992_93_p01", // 73 Kevin Johnson (86)
  "classic_mil_2020_21_p02", // 74 Khris Middleton (86)
  "classic_lal_2009_10_p06", // 75 Lamar Odom (86)
  "classic_phi_1982_83_p01", // 76 Maurice Cheeks (86)
  "classic_bos_1985_86_p01", // 77 Dennis Johnson (85)
  "classic_lal_2009_10_p05", // 78 Andrew Bynum (84)
  "classic_lal_2000_01_p04", // 79 Horace Grant (84)
  "classic_uta_1997_98_p02", // 80 Jeff Hornacek (84)
  "classic_lal_2009_10_p03", // 81 Metta World Peace (84)
  "classic_orl_1994_95_p02", // 82 Nick Anderson (84)
  "classic_chi_1995_96_p06", // 83 Toni Kukoc (84)
  "classic_nyk_1993_94_p04", // 84 Anthony Mason (82)
  "classic_det_1988_89_p05", // 85 Bill Laimbeer (82)
  "classic_mil_2020_21_p05", // 86 Brook Lopez (82)
  "classic_lal_1986_87_p02", // 87 Byron Scott (82)
  "classic_phx_1992_93_p02", // 88 Dan Majerle (82)
  "classic_bos_1985_86_p02", // 89 Danny Ainge (82)
  "classic_orl_1994_95_p03", // 90 Dennis Scott (82)
  "classic_dal_2010_11_p02", // 91 Jason Terry (82)
  "classic_hou_1994_95_p01", // 92 Kenny Smith (82)
  "classic_bos_2007_08_p01", // 93 Rajon Rondo (82)
  "classic_chi_1995_96_p01", // 94 Ron Harper (82)
  "classic_dal_2010_11_p03", // 95 Shawn Marion (82)
  "classic_dal_2010_11_p05", // 96 Tyson Chandler (82)
  "classic_nyk_1993_94_p02", // 97 John Starks (80)
  "classic_lal_2000_01_p06", // 98 Robert Horry (80)
  "classic_lal_2000_01_p01", // 99 Derek Fisher (79)
  "classic_hou_1994_95_p06", // 100 Sam Cassell (74)
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

export type PyramidPositionTeamOpts = {
  /**
   * When true, fold pyramid #1 into the first balanced five (no solo apex row).
   * When false (default), #1 stays alone on top and teams deal from #2 onward.
   */
  apexInTopTeam?: boolean;
  counts?: readonly number[];
};

/**
 * 1-5-10 display: deal players into balanced “best available” lineups by primary
 * position (PG→C), greedy by rank. Tier of 5 → one each; tier of 10 → two each;
 * other widths take as many full five-man rounds as fit, then leftover by rank.
 *
 * Default keeps #1 alone at the apex. With `apexInTopTeam`, #1 seats in the top
 * five at their position and the remaining teams reshuffle from what’s left.
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
  const counts =
    opts.counts ??
    (apexInTopTeam ? PYRAMID_POSITION_TEAM_COUNTS : PYRAMID_TIER_PATTERNS.positions);

  type Seat = { rank: number; playerId: string; index: number; pos: PyramidRingPosition };
  const remaining: Seat[] = order.map((playerId, index) => ({
    playerId,
    rank: index + 1,
    index,
    pos: normalizeRingPosition(positionOf(playerId)),
  }));

  const takeBest = (pos?: PyramidRingPosition): Seat | null => {
    if (!remaining.length) return null;
    if (pos) {
      const i = remaining.findIndex((s) => s.pos === pos);
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
