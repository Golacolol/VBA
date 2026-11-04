import type { PositionCode, PlayerAttributes, PlayerPhysicalFacts, PlayerRecord, RatingOverride } from "../../data/schema";
import { clamp } from "../../core/math";

type WeightMap = Partial<Record<keyof PlayerAttributes, number>>;

/**
 * Position overall weights — DISPLAY / SUMMARY ONLY.
 * Must never be used as a gameplay multiplier.
 */
export const OVERALL_WEIGHTS: Record<string, WeightMap> = {
  PG: {
    passAccuracy: 0.16,
    ballHandle: 0.14,
    iq: 0.12,
    threePoint: 0.1,
    speed: 0.1,
    finishing: 0.08,
    midRange: 0.08,
    perimeterD: 0.08,
    clutch: 0.08,
    stamina: 0.06,
  },
  SG: {
    threePoint: 0.16,
    midRange: 0.12,
    finishing: 0.12,
    ballHandle: 0.1,
    speed: 0.1,
    freeThrow: 0.08,
    perimeterD: 0.08,
    iq: 0.08,
    clutch: 0.08,
    stamina: 0.08,
  },
  SF: {
    finishing: 0.12,
    threePoint: 0.1,
    midRange: 0.1,
    speed: 0.1,
    ballHandle: 0.1,
    perimeterD: 0.1,
    rebound: 0.08,
    vertical: 0.08,
    iq: 0.08,
    strength: 0.08,
    stamina: 0.06,
  },
  PF: {
    finishing: 0.12,
    rebound: 0.14,
    interiorD: 0.12,
    strength: 0.12,
    vertical: 0.1,
    midRange: 0.08,
    block: 0.08,
    iq: 0.08,
    stamina: 0.08,
    speed: 0.08,
  },
  C: {
    rebound: 0.16,
    interiorD: 0.16,
    block: 0.14,
    strength: 0.12,
    finishing: 0.12,
    vertical: 0.1,
    iq: 0.08,
    stamina: 0.06,
    freeThrow: 0.06,
  },
  GK: {
    gkReflexes: 0.22,
    gkDiving: 0.2,
    gkHandling: 0.18,
    gkPositioning: 0.18,
    gkKicking: 0.08,
    reactions: 0.08,
    composure: 0.06,
  },
  CB: {
    defensiveAwareness: 0.18,
    defending: 0.16,
    tackling: 0.14,
    strength: 0.12,
    heading: 0.1,
    jumping: 0.08,
    composure: 0.08,
    reactions: 0.06,
    pace: 0.04,
    acceleration: 0.02,
    passing: 0.02,
  },
  LB: {
    pace: 0.14,
    acceleration: 0.12,
    stamina: 0.12,
    defensiveAwareness: 0.12,
    tackling: 0.1,
    crossing: 0.1,
    passing: 0.08,
    control: 0.06,
    agility: 0.06,
    reactions: 0.05,
    strength: 0.03,
    attackingAwareness: 0.02,
  },
  RB: {
    pace: 0.14,
    acceleration: 0.12,
    stamina: 0.12,
    defensiveAwareness: 0.12,
    tackling: 0.1,
    crossing: 0.1,
    passing: 0.08,
    control: 0.06,
    agility: 0.06,
    reactions: 0.05,
    strength: 0.03,
    attackingAwareness: 0.02,
  },
  LWB: {
    pace: 0.15,
    acceleration: 0.12,
    stamina: 0.13,
    crossing: 0.12,
    defensiveAwareness: 0.1,
    tackling: 0.08,
    passing: 0.08,
    control: 0.06,
    attackingAwareness: 0.06,
    agility: 0.05,
    reactions: 0.05,
  },
  RWB: {
    pace: 0.15,
    acceleration: 0.12,
    stamina: 0.13,
    crossing: 0.12,
    defensiveAwareness: 0.1,
    tackling: 0.08,
    passing: 0.08,
    control: 0.06,
    attackingAwareness: 0.06,
    agility: 0.05,
    reactions: 0.05,
  },
  DM: {
    defensiveAwareness: 0.16,
    tackling: 0.14,
    defending: 0.12,
    passing: 0.12,
    stamina: 0.1,
    reactions: 0.08,
    strength: 0.08,
    composure: 0.06,
    control: 0.06,
    longPassing: 0.05,
    aggression: 0.03,
  },
  CM: {
    passing: 0.18,
    vision: 0.16,
    control: 0.12,
    stamina: 0.1,
    composure: 0.1,
    reactions: 0.08,
    longPassing: 0.08,
    dribbling: 0.06,
    defensiveAwareness: 0.06,
    attackingAwareness: 0.04,
    agility: 0.02,
  },
  AM: {
    vision: 0.16,
    passing: 0.14,
    control: 0.12,
    dribbling: 0.12,
    attackingAwareness: 0.12,
    composure: 0.1,
    longPassing: 0.06,
    shooting: 0.06,
    longShots: 0.05,
    agility: 0.04,
    reactions: 0.03,
  },
  RM: {
    pace: 0.14,
    acceleration: 0.1,
    passing: 0.12,
    dribbling: 0.12,
    crossing: 0.12,
    stamina: 0.1,
    control: 0.08,
    attackingAwareness: 0.08,
    vision: 0.06,
    defending: 0.04,
    agility: 0.04,
  },
  LM: {
    pace: 0.14,
    acceleration: 0.1,
    passing: 0.12,
    dribbling: 0.12,
    crossing: 0.12,
    stamina: 0.1,
    control: 0.08,
    attackingAwareness: 0.08,
    vision: 0.06,
    defending: 0.04,
    agility: 0.04,
  },
  RW: {
    pace: 0.14,
    acceleration: 0.12,
    dribbling: 0.14,
    control: 0.1,
    attackingAwareness: 0.1,
    crossing: 0.1,
    passing: 0.08,
    vision: 0.06,
    finishing: 0.06,
    agility: 0.05,
    stamina: 0.03,
    longShots: 0.02,
  },
  LW: {
    pace: 0.14,
    acceleration: 0.12,
    dribbling: 0.14,
    control: 0.1,
    attackingAwareness: 0.1,
    crossing: 0.1,
    passing: 0.08,
    vision: 0.06,
    finishing: 0.06,
    agility: 0.05,
    stamina: 0.03,
    longShots: 0.02,
  },
  ST: {
    finishing: 0.18,
    attackingAwareness: 0.14,
    shooting: 0.12,
    composure: 0.1,
    control: 0.1,
    pace: 0.08,
    acceleration: 0.06,
    shotPower: 0.06,
    heading: 0.06,
    strength: 0.05,
    dribbling: 0.05,
  },
};

/** Alias legacy football codes; basketball positions map to themselves. */
const POSITION_ALIAS: Record<string, string> = {
  CDM: "DM",
  CAM: "AM",
  CF: "ST",
  RCB: "CB",
  LCB: "CB",
  RST: "ST",
  LST: "ST",
  LAM: "AM",
  RAM: "AM",
  LCM: "CM",
  RCM: "CM",
  G: "C",
  F: "SF",
};

export type InferredAttrKey =
  | "midRange"
  | "freeThrow"
  | "steal"
  | "block"
  | "vertical"
  | "clutch"
  | "acceleration"
  | "agility"
  | "balance"
  | "crossing"
  | "heading"
  | "penalties"
  | "setPieces"
  | "aggression"
  | "form"
  | "concentration"
  | "attackingAwareness"
  | "reactions"
  | "defensiveAwareness"
  | "tackling"
  | "jumping";

export interface ResolveResult {
  attrs: PlayerAttributes;
  /** Attribute keys filled from compatibility defaults (not authored). */
  inferred: InferredAttrKey[];
}

function roundStat(n: number): number {
  return Math.round(clamp(n, 1, 100));
}

function blend(...parts: number[]): number {
  const vals = parts.filter((n) => Number.isFinite(n));
  if (!vals.length) return 60;
  return roundStat(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? roundStat(v) : roundStat(fallback);
}

/**
 * Resolve authored basketball attributes; dual-write football mirrors for Match stub.
 * Explicit values always win. Inferred keys are reported for diagnostics.
 */
export function resolveAttributesDetailed(
  player: PlayerRecord | (Partial<PlayerAttributes> & { primaryPosition?: PositionCode }),
): ResolveResult {
  const inferred: InferredAttrKey[] = [];
  const take = <K extends InferredAttrKey>(key: K, fallback: number): number => {
    const raw = (player as PlayerAttributes)[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return roundStat(raw);
    inferred.push(key);
    return roundStat(fallback);
  };

  const finishing = num(player.finishing ?? player.shooting, 60);
  const midRange = take("midRange", num(player.midRange ?? player.longShots, finishing));
  const threePoint = num(player.threePoint ?? player.longShots, midRange);
  const freeThrow = take("freeThrow", num(player.freeThrow ?? player.penalties, blend(finishing, midRange)));
  const ballHandle = num(player.ballHandle ?? player.dribbling ?? player.control, 60);
  const passAccuracy = num(player.passAccuracy ?? player.passing, 60);
  const perimeterD = num(player.perimeterD ?? player.defending, 60);
  const interiorD = num(player.interiorD ?? player.defending, perimeterD);
  const rebound = num(player.rebound ?? player.jumping ?? player.heading, 60);
  const steal = take("steal", blend(perimeterD, ballHandle));
  const block = take("block", blend(interiorD, rebound));
  const speed = num(player.speed ?? player.pace, 60);
  const vertical = take("vertical", num(player.vertical ?? player.jumping, blend(rebound, speed)));
  const strength = num(player.strength, 60);
  const stamina = num(player.stamina, 60);
  const iq = num(player.iq ?? player.vision ?? player.composure, 60);
  const clutch = take("clutch", num(player.clutch ?? player.composure, iq));

  // Football mirrors (Match stub / legacy UI)
  const pace = speed;
  const passing = passAccuracy;
  const longPassing = passAccuracy;
  const vision = iq;
  const control = ballHandle;
  const dribbling = ballHandle;
  const shooting = blend(finishing, midRange);
  const shotPower = blend(finishing, strength);
  const longShots = threePoint;
  const defending = blend(perimeterD, interiorD);
  const composure = clutch;

  const attrs: PlayerAttributes = {
    finishing,
    midRange,
    threePoint,
    freeThrow,
    ballHandle,
    passAccuracy,
    perimeterD,
    interiorD,
    rebound,
    steal,
    block,
    speed,
    vertical,
    strength,
    stamina,
    iq,
    clutch,
    pace,
    passing,
    longPassing,
    vision,
    control,
    dribbling,
    shooting,
    shotPower,
    longShots,
    defending,
    composure,
    acceleration: take("acceleration", pace),
    agility: take("agility", blend(ballHandle, speed)),
    balance: take("balance", blend(strength, ballHandle)),
    crossing: take("crossing", passAccuracy),
    heading: take("heading", rebound),
    penalties: take("penalties", freeThrow),
    setPieces: take("setPieces", freeThrow),
    aggression: take("aggression", blend(interiorD, strength)),
    form: take("form", clutch),
    concentration: take("concentration", iq),
    attackingAwareness: take("attackingAwareness", blend(iq, finishing)),
    reactions: take("reactions", blend(iq, speed)),
    defensiveAwareness: take("defensiveAwareness", blend(perimeterD, interiorD)),
    tackling: take("tackling", steal),
    jumping: take("jumping", vertical),
  };

  return { attrs, inferred };
}

export function resolveAttributes(player: PlayerRecord | (Partial<PlayerAttributes> & { primaryPosition?: PositionCode })): PlayerAttributes {
  return resolveAttributesDetailed(player).attrs;
}

/** Players still relying on inferred defaults for one or more V1 fields. */
export function playersWithInferredDefaults(players: Iterable<PlayerRecord>): { id: string; name: string; inferred: InferredAttrKey[] }[] {
  const out: { id: string; name: string; inferred: InferredAttrKey[] }[] = [];
  for (const p of players) {
    const { inferred } = resolveAttributesDetailed(p);
    if (inferred.length) out.push({ id: p.id, name: p.name, inferred });
  }
  return out;
}

export function applyOverride(base: PlayerAttributes, override?: RatingOverride): PlayerAttributes {
  if (!override) return { ...base };
  const next = { ...base };
  for (const key of Object.keys(override) as (keyof RatingOverride)[]) {
    if (key === "overall") continue;
    const value = override[key];
    if (typeof value === "number") {
      (next as Record<string, number | undefined>)[key] = roundStat(value);
    }
  }
  return next;
}

function attr(source: PlayerAttributes, key: keyof PlayerAttributes): number {
  const value = source[key];
  if (typeof value === "number") return value;
  // Basketball → football mirror fallbacks
  if (key === "speed" && typeof source.pace === "number") return source.pace;
  if (key === "passAccuracy" && typeof source.passing === "number") return source.passing;
  if (key === "ballHandle" && typeof source.dribbling === "number") return source.dribbling;
  if (key === "threePoint" && typeof source.longShots === "number") return source.longShots;
  if (key === "iq" && typeof source.vision === "number") return source.vision;
  if (key === "clutch" && typeof source.composure === "number") return source.composure;
  if (key === "perimeterD" && typeof source.defending === "number") return source.defending;
  if (key === "interiorD" && typeof source.defending === "number") return source.defending;
  if (key === "rebound" && typeof source.jumping === "number") return source.jumping;
  if (key === "vertical" && typeof source.jumping === "number") return source.jumping;
  if (key === "form" || key === "concentration") return source.clutch ?? source.composure ?? 60;
  if (String(key).startsWith("gk")) return source.clutch ?? source.composure ?? 60;
  return 60;
}

/** Clutch blended with form + focus for pressure / decision feel. */
export function effectiveComposure(attrs: PlayerAttributes): number {
  const base = attrs.clutch ?? attrs.composure ?? 60;
  const form = attrs.form ?? base;
  const focus = attrs.concentration ?? attrs.iq ?? base;
  return roundStat(base * 0.55 + form * 0.25 + focus * 0.2);
}

/** Six display axes for the formation hex / comparison chart (not gameplay multipliers). */
/** Top spoke is rim/finishing (dunks + paint); SHT stays jump shooting. */
export const PROFILE_AXIS_IDS = ["rim", "defence", "playmaking", "athleticism", "iq", "shooting"] as const;
export type ProfileAxisId = (typeof PROFILE_AXIS_IDS)[number];

export const PROFILE_AXIS_LABELS: Record<ProfileAxisId, string> = {
  rim: "Rim",
  defence: "Defence",
  playmaking: "Playmaking",
  athleticism: "Athleticism",
  iq: "IQ",
  shooting: "Shooting",
};

/** Compact hex tags — RIM sits at the top of the radar. */
export const PROFILE_AXIS_SHORT: Record<ProfileAxisId, string> = {
  rim: "RIM",
  defence: "DEF",
  playmaking: "PLY",
  athleticism: "ATH",
  iq: "IQ",
  shooting: "SHT",
};

export type ProfileAxes = Record<ProfileAxisId, number>;

/**
 * Full radar spokes — basketball gameplay attributes.
 */
export const PROFILE_ATTR_SPOKES: ReadonlyArray<{
  key: keyof PlayerAttributes;
  short: string;
  label: string;
  /** Keeper-only — omitted unless they have GK ratings set. */
  gk?: boolean;
}> = [
  /** Paint / dunk / layup finishing — dunk ability is Finishing + Vertical, not a separate attr. */
  { key: "finishing", short: "FIN", label: "Finishing" },
  { key: "midRange", short: "MID", label: "Mid-Range" },
  { key: "threePoint", short: "3PT", label: "Three-Point" },
  { key: "freeThrow", short: "FT", label: "Free Throw" },
  { key: "ballHandle", short: "HND", label: "Ball Handle" },
  { key: "passAccuracy", short: "PAS", label: "Pass Accuracy" },
  { key: "perimeterD", short: "PRD", label: "Perimeter D" },
  { key: "interiorD", short: "INT", label: "Interior D" },
  { key: "rebound", short: "REB", label: "Rebound" },
  { key: "steal", short: "STL", label: "Steal" },
  { key: "block", short: "BLK", label: "Block" },
  { key: "speed", short: "SPD", label: "Speed" },
  { key: "acceleration", short: "ACC", label: "Acceleration" },
  { key: "vertical", short: "VRT", label: "Vertical" },
  { key: "strength", short: "STR", label: "Strength" },
  { key: "stamina", short: "STA", label: "Stamina" },
  { key: "iq", short: "IQ", label: "Basketball IQ" },
  { key: "clutch", short: "CLT", label: "Clutch" },
];

export type ProfileAttrSpoke = {
  key: keyof PlayerAttributes;
  short: string;
  label: string;
  value: number;
};

/** Live spoke list for the full radar — length tracks PROFILE_ATTR_SPOKES (+ GK when relevant). */
export function listProfileAttrSpokes(attrs: PlayerAttributes): ProfileAttrSpoke[] {
  const includeGk = PROFILE_ATTR_SPOKES.some(
    (s) => s.gk && typeof attrs[s.key] === "number" && Number.isFinite(attrs[s.key] as number),
  );
  const out: ProfileAttrSpoke[] = [];
  for (const s of PROFILE_ATTR_SPOKES) {
    if (s.gk && !includeGk) continue;
    out.push({
      key: s.key,
      short: s.short,
      label: s.label,
      value: attr(attrs, s.key),
    });
  }
  return out;
}

function weightedMean(attrs: PlayerAttributes, parts: { key: keyof PlayerAttributes; w: number }[]): number {
  let sum = 0;
  let total = 0;
  for (const { key, w } of parts) {
    sum += attr(attrs, key) * w;
    total += w;
  }
  return Math.round(clamp(sum / Math.max(1e-6, total), 1, 100));
}

/**
 * Six overalls from basketball attrs — Rim / Defence / Playmaking / Athleticism / IQ / Shooting.
 * Rim = finishing + vertical (dunks/paint); Shooting = jumpers + FT. Display only.
 */
export function deriveProfileAxes(attrs: PlayerAttributes): ProfileAxes {
  return {
    rim: weightedMean(attrs, [
      { key: "finishing", w: 0.55 },
      { key: "vertical", w: 0.25 },
      { key: "strength", w: 0.12 },
      { key: "clutch", w: 0.08 },
    ]),
    defence: weightedMean(attrs, [
      { key: "perimeterD", w: 0.28 },
      { key: "interiorD", w: 0.28 },
      { key: "steal", w: 0.16 },
      { key: "block", w: 0.16 },
      { key: "rebound", w: 0.12 },
    ]),
    playmaking: weightedMean(attrs, [
      { key: "passAccuracy", w: 0.4 },
      { key: "ballHandle", w: 0.35 },
      { key: "iq", w: 0.25 },
    ]),
    athleticism: weightedMean(attrs, [
      { key: "speed", w: 0.28 },
      { key: "acceleration", w: 0.16 },
      { key: "vertical", w: 0.22 },
      { key: "strength", w: 0.18 },
      { key: "stamina", w: 0.16 },
    ]),
    iq: weightedMean(attrs, [
      { key: "iq", w: 0.45 },
      { key: "clutch", w: 0.3 },
      { key: "passAccuracy", w: 0.15 },
      { key: "perimeterD", w: 0.1 },
    ]),
    shooting: weightedMean(attrs, [
      { key: "threePoint", w: 0.4 },
      { key: "midRange", w: 0.35 },
      { key: "freeThrow", w: 0.25 },
    ]),
  };
}

/**
 * Display/summary overall only — NEVER multiply into gameplay systems.
 */
export function deriveOverall(position: PositionCode | string, attrs: PlayerAttributes): number {
  const key = POSITION_ALIAS[position] ?? position;
  const weights = OVERALL_WEIGHTS[key] ?? OVERALL_WEIGHTS.CM;
  let sum = 0;
  let weightTotal = 0;
  for (const [attrKey, weight] of Object.entries(weights)) {
    if (!weight) continue;
    sum += attr(attrs, attrKey as keyof PlayerAttributes) * weight;
    weightTotal += weight;
  }
  return Math.round(clamp(sum / Math.max(1e-6, weightTotal), 1, 100));
}

export function passStatForDistance(attrs: PlayerAttributes, _distance: number): number {
  return attrs.passAccuracy ?? attrs.passing ?? 60;
}

export function crossingStat(attrs: PlayerAttributes): number {
  return attrs.passAccuracy ?? attrs.passing ?? 60;
}

export function normalizePreferredFoot(foot?: string | null): "L" | "R" {
  if (!foot) return "R";
  const f = foot.toLowerCase();
  if (f === "l" || f === "left") return "L";
  return "R";
}

export function normalizePreferredHand(hand?: string | null): "L" | "R" {
  if (!hand) return "R";
  const h = hand.toLowerCase();
  if (h === "l" || h === "left") return "L";
  return "R";
}

export interface AttributeValidationIssue {
  field: string;
  message: string;
  value: unknown;
}

/** Validate ratings 1–100 and sensible physical facts. */
export function validatePlayerAttributes(
  player: Partial<PlayerAttributes> & PlayerPhysicalFacts & { id?: string },
): AttributeValidationIssue[] {
  const issues: AttributeValidationIssue[] = [];
  const ratingKeys: (keyof PlayerAttributes)[] = [
    "finishing", "midRange", "threePoint", "freeThrow", "ballHandle", "passAccuracy",
    "perimeterD", "interiorD", "rebound", "steal", "block",
    "speed", "acceleration", "vertical", "strength", "stamina", "iq", "clutch",
    // Football mirrors (optional)
    "pace", "passing", "longPassing", "vision", "control", "dribbling", "shooting",
    "shotPower", "longShots", "heading", "penalties", "setPieces", "defending",
    "defensiveAwareness", "tackling", "jumping", "aggression", "composure",
    "form", "concentration", "attackingAwareness", "reactions", "agility", "balance", "crossing",
  ];
  for (const key of ratingKeys) {
    const v = player[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 1 || v > 100) {
      issues.push({ field: key, message: "rating must be 1–100", value: v });
    }
  }
  if (player.heightCm !== undefined) {
    // NBA range: ~5'7"–7'7"
    if (typeof player.heightCm !== "number" || player.heightCm < 165 || player.heightCm > 235) {
      issues.push({ field: "heightCm", message: "expected 165–235 cm", value: player.heightCm });
    }
  }
  if (player.weightKg !== undefined) {
    if (typeof player.weightKg !== "number" || player.weightKg < 70 || player.weightKg > 160) {
      issues.push({ field: "weightKg", message: "expected 70–160 kg", value: player.weightKg });
    }
  }
  if (player.preferredHand !== undefined) {
    const h = String(player.preferredHand).toLowerCase();
    if (!["l", "r", "left", "right"].includes(h)) {
      issues.push({ field: "preferredHand", message: "expected L/R/left/right", value: player.preferredHand });
    }
  }
  if (player.preferredFoot !== undefined) {
    const f = String(player.preferredFoot).toLowerCase();
    if (!["l", "r", "left", "right"].includes(f)) {
      issues.push({ field: "preferredFoot", message: "expected L/R/left/right", value: player.preferredFoot });
    }
  }
  return issues;
}

/** Map measured height (cm) onto the procedural mesh heightScale (198cm ≈ 1.0 for NBA). */
export function heightScaleFromCm(heightCm?: number): number {
  if (heightCm === undefined || !Number.isFinite(heightCm)) return 1;
  const t = (heightCm - 185) / 45;
  return clamp(0.9 + t * 0.28, 0.86, 1.22);
}

/** BMI-ish build label from height + weight (falls back to height-only bands). */
export function bodyTypeFromPhysical(
  heightCm?: number,
  weightKg?: number,
): "lean" | "standard" | "stocky" {
  if (weightKg != null && Number.isFinite(weightKg) && heightCm != null && heightCm > 0) {
    const bmi = weightKg / (heightCm / 100) ** 2;
    if (bmi < 21.2) return "lean";
    if (bmi > 24.8) return "stocky";
    return "standard";
  }
  if (heightCm != null && Number.isFinite(heightCm)) {
    if (heightCm <= 175) return "lean";
    if (heightCm >= 188) return "stocky";
  }
  return "standard";
}

/**
 * Continuous XZ girth for the procedural mesh.
 * Prefer BMI when both height and weight exist; otherwise body-type buckets.
 */
export function bodyWidthFromPhysical(
  heightCm?: number,
  weightKg?: number,
  bodyType?: "lean" | "standard" | "stocky" | string,
): number {
  if (weightKg != null && Number.isFinite(weightKg) && heightCm != null && heightCm > 0) {
    const bmi = weightKg / (heightCm / 100) ** 2;
    // ~20 → lean (0.9), ~23 → standard (1.0), ~27 → stocky (1.12)
    const t = (bmi - 20) / 7;
    return clamp(0.9 + t * 0.22, 0.86, 1.14);
  }
  const type = bodyType ?? bodyTypeFromPhysical(heightCm, weightKg);
  if (type === "stocky") return 1.1;
  if (type === "lean") return 0.92;
  return 1;
}

/** Sync appearance heightScale / bodyType / bodyWidth from measured physical facts. */
export function applyPhysicalToAppearance<T extends {
  heightScale?: number;
  bodyType?: "lean" | "standard" | "stocky" | string;
  bodyWidth?: number;
}>(
  appearance: T,
  heightCm?: number | null,
  weightKg?: number | null,
): T {
  const next = { ...appearance };
  const h = heightCm == null || !Number.isFinite(heightCm) ? undefined : heightCm;
  const w = weightKg == null || !Number.isFinite(weightKg) ? undefined : weightKg;
  if (h != null) next.heightScale = heightScaleFromCm(h);
  if (w != null || h != null) {
    // Weight drives build when present; height-only only fills a missing bodyType.
    if (w != null) next.bodyType = bodyTypeFromPhysical(h, w);
    else if (next.bodyType == null) next.bodyType = bodyTypeFromPhysical(h, w);
    next.bodyWidth = bodyWidthFromPhysical(h, w, next.bodyType as string | undefined);
  }
  return next;
}

/** Soft contact mass factor from weight + strength (1 = average). */
export function contactMassFactor(attrs: PlayerAttributes, weightKg?: number): number {
  const w = weightKg ?? 75;
  const weightTerm = clamp((w - 70) / 40, -0.2, 0.25);
  const strengthTerm = (stat01Safe(attrs.strength) - 0.5) * 0.35;
  return clamp(1 + weightTerm + strengthTerm, 0.75, 1.35);
}

function stat01Safe(n: number): number {
  return clamp(n / 100, 0, 1);
}

/** Aerial reach index (not heading accuracy). */
export function aerialReachIndex(attrs: PlayerAttributes, heightCm?: number): number {
  const h = heightCm ?? 180;
  const heightTerm = clamp((h - 170) / 40, 0, 1);
  return clamp(
    heightTerm * 0.35 + stat01Safe(attrs.jumping ?? 60) * 0.4 + stat01Safe(attrs.reactions ?? 60) * 0.25,
    0,
    1,
  );
}
