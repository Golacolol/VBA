/** NBA court (metres). Play space + arena shells use these. */
export const COURT_LENGTH = 28.65;
export const COURT_WIDTH = 15.24;
/** @deprecated Prefer COURT_LENGTH — alias so leftover Match code still compiles. */
export const PITCH_LENGTH = COURT_LENGTH;
/** @deprecated Prefer COURT_WIDTH. */
export const PITCH_WIDTH = COURT_WIDTH;
export const HALF_LENGTH = COURT_LENGTH / 2;
export const HALF_WIDTH = COURT_WIDTH / 2;

/** Lane / key (NBA). */
export const KEY_LENGTH = 5.79;
export const KEY_WIDTH = 4.88;
export const FREE_THROW_LINE = 4.57;
export const THREE_POINT_RADIUS = 7.24;
export const CENTER_CIRCLE_RADIUS = 1.83;
export const RESTRICTED_AREA_RADIUS = 1.22;
export const RIM_HEIGHT = 3.05;
export const RIM_RADIUS = 0.23;
export const BACKBOARD_WIDTH = 1.83;
export const BACKBOARD_HEIGHT = 1.07;

/** @deprecated Football remnants — unused on NBA courts. */
export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
export const GOAL_DEPTH = 2.0;
export const PENALTY_SPOT = 11;
export const PENALTY_AREA_LENGTH = 16.5;
export const PENALTY_AREA_WIDTH = 40.32;
export const SIX_YARD_LENGTH = 5.5;
export const SIX_YARD_WIDTH = 18.32;
export const CENTRE_CIRCLE_RADIUS = CENTER_CIRCLE_RADIUS;
export const CORNER_ARC_RADIUS = 1.0;

export const BALL_RADIUS = 0.12;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.98;
/**
 * Vertical acceleration for ball flight (game units/s²).
 * Slightly softer than a hard 18 so lofted balls / crosses hang for headers.
 */
export const BALL_GRAVITY = 15.4;
/** Coefficient of restitution for a football bounce. */
export const BALL_BOUNCE = 0.58;

export const POSSESSION_RANGE = 1.15;
export const TACKLE_RANGE = 1.05;
/** Soft engage radius — keep below sprint-close so stand-off remains viable. */
export const PRESS_RANGE = 7.2;

export const DEFAULT_HALF_SECONDS = 5 * 60;
export const DEFAULT_MATCH_DURATION = DEFAULT_HALF_SECONDS * 2;
export const DEFAULT_KICK_OFF_TIME = "15:00";
export const DEFAULT_TEAM_ID = "nba_bos";
export const MIN_MATCH_DURATION = 2 * 60;
export const MAX_MATCH_DURATION = 45 * 60;
export const HALF_TIME_PAUSE = 5;
export const PRE_MATCH_CARD_SECONDS = 5;
export const MATCH_CARD_FADE_SECONDS = 0.9;
export const MATCH_CARD_FADE_LEAD = 1.05;
export const HUD_CARD_RAISE_SECONDS = 20;
export const HUD_CARD_FADE_SECONDS = 0.9;
export const AUTOPLAY_IDLE_SECONDS = 60;
export const AUTOPLAY_NEXT_MATCH_HOLD = 5;
/** Delay before the simulate / take-over banner appears after kick-off. */
export const SIM_BANNER_DELAY_SECONDS = 5;
export const CELEBRATION_SECONDS = 3.6;

export const SPEED_BURST_SPEED_MUL = 1.34;
export const SPEED_BURST_SHOT_MUL = 1.28;
export const SPEED_BURST_DRAIN = 4.8;
export const SPEED_BURST_MIN_ENERGY = 0.2;

export function clampMatchDuration(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MATCH_DURATION;
  return Math.min(MAX_MATCH_DURATION, Math.max(MIN_MATCH_DURATION, Math.round(n)));
}

export const HALF_LENGTH_CHOICES: { minutes: number; seconds: number }[] = [
  { minutes: 3, seconds: 3 * 60 * 2 },
  { minutes: 5, seconds: 5 * 60 * 2 },
  { minutes: 10, seconds: 10 * 60 * 2 },
  { minutes: 15, seconds: 15 * 60 * 2 },
  { minutes: 20, seconds: 20 * 60 * 2 },
];

export function kickOffTimeChoices(): string[] {
  const times: string[] = [];
  for (let h = 12; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break;
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

export function normalizeKickOffTime(value: string | undefined, fallback = DEFAULT_KICK_OFF_TIME): string {
  const t = (value ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return fallback;
}

export type KickCountdownPhase = "days" | "hours" | "minutes" | "seconds";

/** Stored fixture tip-offs are UK wall-clock (Europe/London). */
export const FIXTURE_TIME_ZONE = "Europe/London";

function zonedParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const num = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((p) => p.type === type)?.value ?? "0";
    return Number(raw);
  };
  let hour = num("hour");
  if (hour === 24) hour = 0;
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour,
    minute: num("minute"),
  };
}

/** Absolute instant for a YYYY-MM-DD + HH:mm wall clock in `timeZone`. */
export function wallClockToDate(
  date: string,
  time: string,
  timeZone: string,
  now = new Date(),
): Date {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayFallback(now);
  const [y, mo, d] = iso.split("-").map(Number);
  const [hh, mm] = normalizeKickOffTime(time).split(":").map(Number);
  const targetUtcMs = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  let guess = targetUtcMs;
  for (let i = 0; i < 4; i++) {
    const seen = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0, 0);
    const delta = targetUtcMs - asUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

/** Tip-off Date from fixture calendar date + HH:MM in UK time. */
export function fixtureKickOffDate(date: string, time: string | undefined, now = new Date()): Date {
  return wallClockToDate(date, normalizeKickOffTime(time), FIXTURE_TIME_ZONE, now);
}

export function kickOffRemainingSeconds(date: string, time: string | undefined, now = new Date()): number {
  const kick = fixtureKickOffDate(date, time, now);
  return Math.max(0, Math.floor((kick.getTime() - now.getTime()) / 1000));
}

/** UK tip-off clock for menus / fixture lists (24-hour en-GB). */
export function formatFixtureTipOffUk(date: string, time: string | undefined): string {
  const kick = fixtureKickOffDate(date, time);
  return kick.toLocaleTimeString("en-GB", {
    timeZone: FIXTURE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** UK calendar label for a fixture tip-off (or noon UTC if no time). */
export function formatFixtureDateUk(date: string, time?: string): string {
  const kick = time != null && String(time).trim() !== ""
    ? fixtureKickOffDate(date, time)
    : new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayFallback(new Date())}T12:00:00Z`);
  if (Number.isNaN(kick.getTime())) return date;
  return kick.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: time != null && String(time).trim() !== "" ? FIXTURE_TIME_ZONE : "UTC",
  });
}

/**
 * Two-digit kick-off countdown:
 * - days (white) while more than 24 hours remain
 * - hours (gold) from 24 hours down through 61 minutes
 * - minutes (red) from 60 minutes down through 61 seconds
 * - seconds (green) for the last 60 seconds
 */
export function formatKickCountdown(remainingSeconds: number): { value: string; phase: KickCountdownPhase } {
  const s = Math.max(0, Math.floor(remainingSeconds));
  const day = 24 * 3600;
  if (s > day) {
    return { value: String(Math.floor(s / day)), phase: "days" };
  }
  if (s > 3600) {
    return { value: String(Math.floor(s / 3600)), phase: "hours" };
  }
  if (s > 60) {
    return { value: String(Math.floor(s / 60)), phase: "minutes" };
  }
  return { value: String(s), phase: "seconds" };
}

function todayFallback(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const ARGYLE_GREEN = 0x007a3d;
export const ARGYLE_GREEN_HEX = "#007a3d";
export const ARGYLE_WHITE = 0xf4f7f2;
