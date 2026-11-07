/** Pyramid Top 50 + reserve swap pool — curated defaults + layout helpers. */

import { normalizeBracketSave, type BracketSave } from "../bracket/PlayoffBracket";
import { normalizeDraftSave, type DraftSave } from "./draft";

export const PYRAMID_SIZE = 50;
/** Extra 99 who can be elevated into the Top 50 but hold no Ring position (#51–#149). */
export const PYRAMID_POOL_SIZE = 99;

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
 * PG↔SG, SG↔SF, SF↔PF, PF↔C — never PG as C, and never PF as SF
 * (that was stealing wing seats and starving C of bigs).
 */
export const PYRAMID_POSITION_FLEX: Record<PyramidRingPosition, readonly PyramidRingPosition[]> = {
  PG: ["PG", "SG"],
  SG: ["SG", "PG", "SF"],
  SF: ["SF", "SG", "PF"],
  PF: ["PF", "C"],
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

export type PyramidViewId = "pyramid" | "ring" | "jersey" | "draft" | "bracket";

/** Bump when curated Top 50 / reserve seed changes so saved pyramids refresh. */
export const PYRAMID_SEED_VERSION = 26;

export type PyramidSave = {
  size: typeof PYRAMID_SIZE;
  /** Top 50 player ids; index 0 = rank #1. */
  order: string[];
  /** Reserve 99 (#51–#149) — not ranked on the Ring; can swap into `order`. */
  pool: string[];
  view: PyramidViewId;
  /** Curated-seed generation; mismatch replaces order/pool with defaults. */
  seedVersion?: number;
  /** Jersey grid picks: shirt number (0–99 as string) → playerId. */
  jerseyChoice?: Record<string, string>;
  /** Optional snake draft board (You + AI seats). */
  draft?: DraftSave;
  /** Playoff prediction bracket (play-in through Finals). */
  bracket?: BracketSave;
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
  "classic_det_1988_89_p01", // 21 Isiah Thomas (91) — takes Rose's prior slot
  "classic_lal_1953_54_p05", // 22 George Mikan (92) — Minneapolis dynasty
  "classic_dal_2010_11_p04", // 23 Dirk Nowitzki (92)
  "classic_phi_2000_01_p01", // 24 Allen Iverson (90)
  "classic_phx_1992_93_p04", // 25 Charles Barkley (92)
  "classic_mia_2012_13_p02", // 26 Dwyane Wade (92)
  "classic_uta_1997_98_p04", // 27 Karl Malone (92)
  "classic_sas_1998_99_p05", // 28 David Robinson (92)
  "classic_uta_1997_98_p01", // 29 John Stockton (91)
  "classic_chi_1995_96_p03", // 30 Scottie Pippen (93)
  "classic_sas_2013_14_p03", // 31 Kawhi Leonard (92)
  "classic_chi_2010_11_p01", // 32 Derrick Rose (92) — swapped with Baylor
  "classic_lal_1971_72_p11", // 33 Elgin Baylor (92)
  "classic_nyk_1993_94_p05", // 34 Patrick Ewing (90)
  "classic_bos_1985_86_p04", // 35 Kevin McHale (90)
  "classic_lal_1986_87_p03", // 36 James Worthy (90)
  "classic_gsw_2016_17_p04", // 37 Draymond Green (90) — four-time champion / dynasty anchor
  "classic_hou_1994_95_p02", // 38 Clyde Drexler (90)
  "classic_hou_2006_07_p02", // 39 Tracy McGrady (90)
  "classic_phx_2004_05_p01", // 40 Steve Nash (91)
  "classic_okc_1995_96_p01", // 41 Gary Payton (90)
  "classic_bos_1964_65_p03", // 42 John Havlicek (91)
  "classic_orl_1994_95_p01", // 43 Anfernee Hardaway (91)
  "classic_mia_2012_13_p06", // 44 Ray Allen (89)
  "classic_hou_2018_19_p01", // 45 Chris Paul (91)
  "classic_sac_2001_02_p04", // 46 Chris Webber (91)
  "classic_det_1996_97_p03", // 47 Grant Hill (91)
  "classic_hou_2018_19_p02", // 48 James Harden (90)
  "classic_cle_2015_16_p01", // 49 Kyrie Irving (91)
  "classic_gsw_2016_17_p02", // 50 Klay Thompson (89) — dynasty sharpshooter; Mourning → reserve
];

/**
 * Curated reserve 51–149 — elevate/swap into Top 50; excluded from Ring.
 * Mix of classic peaks + current espn_* stars who miss the Top 50.
 * Classics at a given OVR sit ahead of same-band currents (room for both).
 * Ordered by overall band (then name within band). Bump {@link PYRAMID_SEED_VERSION} when this changes.
 */
export const DEFAULT_PYRAMID_POOL: readonly string[] = [

  // Elite currents outside Top 50
  "espn_4278073", // 51 Shai Gilgeous-Alexander (92)
  "espn_3945274", // 52 Luka Doncic (93)
  "espn_5104157", // 53 Victor Wembanyama (92)
  "espn_4594268", // 54 Anthony Edwards (91)
  "espn_3934672", // 55 Jalen Brunson (90)
  "classic_dal_2010_11_p01", // 56 Jason Kidd (90)
  "classic_lac_2013_14_p04", // 57 Blake Griffin (90)
  "classic_nyk_2011_12_p03", // 58 Carmelo Anthony (90)
  "classic_lal_2019_20_p04", // 59 Anthony Davis (90)
  "classic_cha_1992_93_p05", // 60 Alonzo Mourning (90) — edged from Top 50 by Klay
  // Classic 89s (Wall dropped to 88; Beal at 86)
  "classic_atl_1990_91_p03", // 61 Dominique Wilkins (89)
  "classic_sas_2013_14_p02", // 62 Manu Ginobili (89)
  "classic_bos_2007_08_p03", // 63 Paul Pierce (89)
  "classic_uta_1976_77_p02", // 64 Pete Maravich (91) — swapped with Ray Allen (→ #49)
  "classic_ind_1999_00_p02", // 65 Reggie Miller (89)
  "classic_okc_2011_12_p01", // 66 Russell Westbrook (89)
  // 88 band
  "classic_phx_2004_05_p05", // 67 Amar'e Stoudemire (88)
  "classic_det_2003_04_p01", // 68 Chauncey Billups (88)
  "classic_mia_2012_13_p05", // 69 Chris Bosh (88)
  "classic_chi_1995_96_p04", // 70 Dennis Rodman (88)
  "espn_3136193", // 71 Devin Booker (88)
  "espn_3908809", // 72 Donovan Mitchell (88)
  "classic_was_2007_08_p01", // 73 Gilbert Arenas (88)
  "espn_4065648", // 74 Jayson Tatum (88)
  "classic_cin_1963_64_p10", // 75 Jerry Lucas (88)
  "classic_was_2016_17_p01", // 76 John Wall (88)
  "classic_cle_2015_16_p04", // 77 Kevin Love (88)
  "classic_cha_1992_93_p04", // 78 Larry Johnson (88)
  "classic_lal_2009_10_p04", // 79 Pau Gasol (88)
  "classic_dal_2010_11_p07", // 80 Peja Stojakovic (88)
  "classic_bos_1985_86_p05", // 81 Robert Parish (88)
  "classic_bos_1964_65_p02", // 82 Sam Jones (88)
  "classic_okc_1995_96_p04", // 83 Shawn Kemp (88)
  "classic_bkn_2000_01_p01", // 84 Stephon Marbury (88)
  "classic_sas_2013_14_p01", // 85 Tony Parker (88)
  "classic_tor_2000_01_p02", // 86 Vince Carter (88)
  "classic_hou_2006_07_p05", // 87 Yao Ming (88)
  // 87 band
  "classic_det_2003_04_p05", // 88 Ben Wallace (87)
  "classic_bos_1985_86_p06", // 89 Bill Walton (87)
  "classic_lal_2019_20_p05", // 90 Dwight Howard (87)
  "classic_den_2022_23_p01", // 91 Jamal Murray (87)
  "espn_3059318", // 92 Joel Embiid (87)
  "espn_4396993", // 93 Tyrese Haliburton (87)
  // Classic 86s before same-OVR currents (Trae / Beal)
  "classic_gsw_2016_17_p06", // 94 Andre Iguodala (86)
  "classic_por_1999_00_p05", // 95 Arvydas Sabonis (86)
  "classic_ind_1999_00_p10", // 96 Chris Mullin (86)
  "classic_hou_2006_07_p09", // 97 Dikembe Mutombo (86)
  "classic_lal_1971_72_p02", // 98 Gail Goodrich (86)
  "classic_det_1988_89_p02", // 99 Joe Dumars (86)
  "classic_mil_2020_21_p01", // 100 Jrue Holiday (86)
  "classic_phx_1992_93_p01", // 101 Kevin Johnson (86)
  "classic_mil_2020_21_p02", // 102 Khris Middleton (86)
  "classic_lal_2009_10_p06", // 103 Lamar Odom (86)
  "classic_phi_1982_83_p01", // 104 Maurice Cheeks (86)
  "classic_sac_2001_02_p01", // 105 Mike Bibby (86)
  "classic_nyk_2011_12_p05", // 106 Tyson Chandler (86)
  "espn_4432166", // 107 Cade Cunningham (86)
  "espn_4279888", // 108 Ja Morant (86)
  "espn_4593803", // 109 Jalen Williams (86)
  "espn_3917376", // 110 Jaylen Brown (86)
  "espn_3136195", // 111 Karl-Anthony Towns (86)
  "espn_6606", // 112 Damian Lillard (84) — swapped with Trae
  "classic_was_2016_17_p02", // 113 Bradley Beal (86)
  // 85 band
  "espn_4066261", // 114 Bam Adebayo (85)
  "espn_4433255", // 115 Chet Holmgren (85)
  "espn_4066259", // 116 De'Aaron Fox (85)
  "classic_bos_1985_86_p01", // 117 Dennis Johnson (85)
  "espn_3155942", // 118 Domantas Sabonis (85)
  "espn_4432158", // 119 Evan Mobley (85)
  "espn_6430", // 120 Jimmy Butler III (85)
  "espn_4432573", // 121 Paolo Banchero (85)
  "classic_por_1999_00_p04", // 122 Rasheed Wallace (85)
  "espn_4431678", // 123 Tyrese Maxey (85)
  // 84 classics + currents
  "classic_was_2007_08_p04", // 124 Antawn Jamison (84)
  "classic_was_2007_08_p03", // 125 Caron Butler (84)
  "espn_4277905", // 126 Trae Young (86) — swapped with Lillard
  "espn_4396907", // 127 Darius Garland (84)
  "espn_3078576", // 128 Derrick White (84)
  "classic_sac_2001_02_p02", // 129 Doug Christie (84)
  "espn_4566434", // 130 Franz Wagner (84)
  "classic_lal_2000_01_p04", // 131 Horace Grant (84)
  "espn_4277961", // 132 Jaren Jackson Jr. (84)
  "classic_uta_1997_98_p02", // 133 Jeff Hornacek (84)
  "classic_phx_2004_05_p02", // 134 Joe Johnson (84)
  "espn_4432816", // 135 LaMelo Ball (84)
  "classic_lal_2009_10_p03", // 136 Metta World Peace (84)
  "espn_3149673", // 137 Pascal Siakam (84)
  "espn_4251", // 138 Paul George (84)
  "classic_det_2003_04_p02", // 139 Richard Hamilton (84)
  "espn_3032976", // 140 Rudy Gobert (84)
  "espn_4433134", // 141 Scottie Barnes (84)
  "classic_okc_2011_12_p04", // 142 Serge Ibaka (84)
  "espn_4871144", // 143 Alperen Sengun (84)
  "classic_bkn_2000_01_p13", // 144 Kenyon Martin (84) — Nets 2000/01; replaces Heinsohn
  "classic_chi_1995_96_p06", // 145 Toni Kukoc (84)
  "classic_sac_2001_02_p05", // 146 Vlade Divac (84)
  "espn_4395628", // 147 Zion Williamson (84)
  // Deep classic fill
  "classic_nyk_1993_94_p04", // 148 Anthony Mason (82)
  "classic_det_1988_89_p05", // 149 Bill Laimbeer (82)
  // Byron Scott dropped so Blake Griffin can sit in the 90 reserve band
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
  return v === "pyramid" || v === "ring" || v === "jersey" || v === "draft" || v === "bracket";
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
    const bracket = o?.bracket != null ? normalizeBracketSave(o.bracket) : undefined;
    return { ...defaultPyramidSave(), view, ...(bracket ? { bracket } : {}) };
  }
  const order = normalizePyramidOrder(o.order, knownIds);
  const jerseyChoice = normalizeJerseyChoice(o.jerseyChoice, knownIds);
  const draft = o.draft != null ? normalizeDraftSave(o.draft) : undefined;
  const bracket = o.bracket != null ? normalizeBracketSave(o.bracket) : undefined;
  return {
    size: PYRAMID_SIZE,
    order,
    pool: normalizePyramidPool(o.pool, order, knownIds),
    view,
    seedVersion: PYRAMID_SEED_VERSION,
    ...(Object.keys(jerseyChoice).length ? { jerseyChoice } : {}),
    ...(draft ? { draft } : {}),
    ...(bracket ? { bracket } : {}),
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
  entries: {
    rank: number;
    playerId: string;
    index: number;
    /** POS A/B lineup seat (PG→C); omitted on rank-only layouts. */
    seat?: PyramidRingPosition;
  }[];
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
 * POS B never lets a PF claim SF — keeps wings honest and frees bigs for C.
 */
export function pyramidEligiblePositions(
  primary: string | null | undefined,
  secondary: readonly string[] | null | undefined,
  mode: PyramidPositionDealMode = "primary",
): PyramidRingPosition[] {
  const prim = normalizeRingPosition(primary);
  if (mode === "primary") return [prim];
  const secs = (secondary ?? []).map((s) => normalizeRingPosition(s));
  const raw = secs.length
    ? [...new Set([prim, ...secs])]
    : [...(PYRAMID_POSITION_FLEX[prim] ?? [prim])];
  const seats = prim === "PF" ? raw.filter((p) => p !== "SF") : raw;
  return seats.length ? seats : [prim];
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
 * POS A — seat only by primary (a PF never takes SF while an SF remains).
 * POS B — still prefer every player’s main position first; only then fill holes
 * with secondary / adjacent flex (PG↔SG, SG↔SF, PF↔C — never PF as SF).
 *
 * Default keeps #1 alone at the apex. With `apexInTopTeam`, #1 seats in the top
 * five at their primary when possible; flex never steals #1 off their main seat
 * while that hole is open.
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

  /** Best remaining whose primary matches `pos`, or overall next by rank. */
  const takeBestPrimary = (pos?: PyramidRingPosition): Seat | null => {
    if (!remaining.length) return null;
    if (pos) {
      const i = remaining.findIndex((s) => s.pos === pos);
      if (i >= 0) return remaining.splice(i, 1)[0] ?? null;
      return null;
    }
    return remaining.shift() ?? null;
  };

  /**
   * POS B hole-fill: best remaining who is eligible for `pos`.
   * Never pull a player off their still-open primary seat into a flex spot
   * (stops SG↔SF / PG↔SG swaps when both holes are free).
   */
  const takeBestFlexForHole = (
    pos: PyramidRingPosition,
    placed: ReadonlyMap<PyramidRingPosition, Seat>,
  ): Seat | null => {
    const i = remaining.findIndex((s) => {
      if (!s.eligible.includes(pos)) return false;
      if (s.pos !== pos && !placed.has(s.pos)) return false;
      return true;
    });
    if (i < 0) return null;
    return remaining.splice(i, 1)[0] ?? null;
  };

  const takeBalancedRound = (): { seat: Seat; pos: PyramidRingPosition }[] => {
    if (dealMode === "primary") {
      const round: { seat: Seat; pos: PyramidRingPosition }[] = [];
      for (const pos of PYRAMID_RING_POSITIONS) {
        const seat = takeBestPrimary(pos);
        if (seat) round.push({ seat, pos });
      }
      return round;
    }
    // Pass 1 — lock each player's main position (incl. #1 when folded into the five).
    const placed = new Map<PyramidRingPosition, Seat>();
    for (const pos of PYRAMID_RING_POSITIONS) {
      const seat = takeBestPrimary(pos);
      if (seat) placed.set(pos, seat);
    }
    // Pass 2 — only then fill empty holes with flex / authored secondaries.
    for (const pos of PYRAMID_RING_POSITIONS) {
      if (placed.has(pos)) continue;
      const seat = takeBestFlexForHole(pos, placed);
      if (seat) placed.set(pos, seat);
    }
    return PYRAMID_RING_POSITIONS.flatMap((pos) => {
      const seat = placed.get(pos);
      return seat ? [{ seat, pos }] : [];
    });
  };

  const pushEntry = (
    entries: PyramidTierRow["entries"],
    seat: Seat,
    pos: PyramidRingPosition,
  ): void => {
    entries.push({
      rank: seat.rank,
      playerId: seat.playerId,
      index: seat.index,
      seat: pos,
    });
  };

  const fillTeamTier = (need: number, entries: PyramidTierRow["entries"]): void => {
    const fullRounds = Math.floor(need / PYRAMID_RING_POSITIONS.length);
    for (let r = 0; r < fullRounds; r++) {
      for (const { seat, pos } of takeBalancedRound()) {
        pushEntry(entries, seat, pos);
      }
    }
    while (entries.length < need) {
      const seat = takeBestPrimary();
      if (!seat) break;
      pushEntry(entries, seat, seat.pos);
    }
  };

  const rows: PyramidTierRow[] = [];
  for (let t = 0; t < counts.length; t++) {
    const need = counts[t]!;
    const entries: PyramidTierRow["entries"] = [];

    if (t === 0 && !apexInTopTeam && need === 1) {
      // Solo apex is current pyramid #1 (rank order), not re-picked by position.
      const apex = remaining.shift();
      if (apex) pushEntry(entries, apex, apex.pos);
    } else {
      fillTeamTier(need, entries);
    }

    if (entries.length) rows.push({ tier: t + 1, entries });
  }

  if (remaining.length) {
    rows.push({
      tier: rows.length + 1,
      entries: remaining.map((s) => ({
        rank: s.rank,
        playerId: s.playerId,
        index: s.index,
        seat: s.pos,
      })),
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
