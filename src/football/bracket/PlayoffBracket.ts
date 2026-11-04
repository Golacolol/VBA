/**
 * NBA playoff prediction bracket — seeded from current standings,
 * including the play-in (7–10), then R1 → Finals.
 *
 * Picks: ADV advances a team (WIN on Finals). Optional series score (e.g. 4–2), else blank.
 */

import type { TableRow } from "../league/Standings";

export type BracketRegionView = "full" | "east" | "west";

export type BracketConf = "east" | "west";

/** Stable match ids used for picks + dependency clearing. */
export type BracketMatchId =
  | `${BracketConf}-pi-78`
  | `${BracketConf}-pi-910`
  | `${BracketConf}-pi-8`
  | `${BracketConf}-r1-0`
  | `${BracketConf}-r1-1`
  | `${BracketConf}-r1-2`
  | `${BracketConf}-r1-3`
  | `${BracketConf}-sf-0`
  | `${BracketConf}-sf-1`
  | `${BracketConf}-f`
  | "finals";

/** Optional predicted series (or play-in) score — blank when omitted. */
export interface BracketSeriesScore {
  /** Games (or points) for the advanced / winning side. */
  winner: number;
  /** Games (or points) for the eliminated side. */
  loser: number;
}

export interface BracketSave {
  /** Predicted series winners keyed by {@link BracketMatchId}. */
  winners: Partial<Record<BracketMatchId, string>>;
  /** Optional scores keyed by match — omitted / partial = blank. */
  scores: Partial<Record<BracketMatchId, BracketSeriesScore>>;
  region: BracketRegionView;
}

export interface BracketMatchup {
  id: BracketMatchId;
  label: string;
  /** Higher seed / left slot. */
  a: string | null;
  /** Lower seed / right slot. */
  b: string | null;
  winner: string | null;
  score: BracketSeriesScore | null;
  /** Finals uses WIN; earlier rounds / play-in use ADV. */
  action: "adv" | "win";
}

export interface ConferenceBracket {
  conf: BracketConf;
  /** Seeds 1–10 from standings (index 0 = #1). */
  seeds: string[];
  playIn78: BracketMatchup;
  playIn910: BracketMatchup;
  playIn8: BracketMatchup;
  /** Resolved playoff 7-seed after play-in picks. */
  seed7: string | null;
  /** Resolved playoff 8-seed after play-in picks. */
  seed8: string | null;
  r1: BracketMatchup[];
  sf: BracketMatchup[];
  final: BracketMatchup;
}

export interface ResolvedBracket {
  east: ConferenceBracket;
  west: ConferenceBracket;
  finals: BracketMatchup;
}

export function blankBracketSave(): BracketSave {
  return { winners: {}, scores: {}, region: "full" };
}

export function isBracketRegionView(v: unknown): v is BracketRegionView {
  return v === "full" || v === "east" || v === "west";
}

function normalizeScore(raw: unknown): BracketSeriesScore | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { winner?: unknown; loser?: unknown };
  const winner = Number(o.winner);
  const loser = Number(o.loser);
  if (!Number.isFinite(winner) || !Number.isFinite(loser)) return null;
  if (winner < 0 || loser < 0) return null;
  return { winner: Math.round(winner), loser: Math.round(loser) };
}

export function normalizeBracketSave(raw: unknown): BracketSave {
  if (!raw || typeof raw !== "object") return blankBracketSave();
  const src = raw as Partial<BracketSave>;
  const winners: BracketSave["winners"] = {};
  if (src.winners && typeof src.winners === "object") {
    for (const [k, v] of Object.entries(src.winners)) {
      if (typeof k === "string" && typeof v === "string" && v.trim()) {
        winners[k as BracketMatchId] = v.trim();
      }
    }
  }
  const scores: BracketSave["scores"] = {};
  if (src.scores && typeof src.scores === "object") {
    for (const [k, v] of Object.entries(src.scores)) {
      const score = normalizeScore(v);
      if (score) scores[k as BracketMatchId] = score;
    }
  }
  return {
    winners,
    scores,
    region: isBracketRegionView(src.region) ? src.region : "full",
  };
}

/** Top N team ids from a conference table (already sorted). */
export function seedTeamIds(rows: TableRow[], count = 10): string[] {
  return rows.slice(0, count).map((r) => r.teamId);
}

function matchup(
  id: BracketMatchId,
  label: string,
  a: string | null,
  b: string | null,
  save: BracketSave,
  action: "adv" | "win" = "adv",
): BracketMatchup {
  const raw = save.winners[id] ?? null;
  const winner = raw && (raw === a || raw === b) ? raw : null;
  const score = winner ? save.scores[id] ?? null : null;
  return { id, label, a, b, winner, score, action };
}

function buildConference(conf: BracketConf, seeds: string[], save: BracketSave): ConferenceBracket {
  const s = (n: number) => seeds[n - 1] ?? null;
  const playIn78 = matchup(`${conf}-pi-78`, "Play-In · 7 vs 8", s(7), s(8), save);
  const playIn910 = matchup(`${conf}-pi-910`, "Play-In · 9 vs 10", s(9), s(10), save);

  // 7-seed = winner of 7v8. Loser faces 9/10 winner for the 8-seed.
  const seed7 = playIn78.winner;
  const loser78 =
    playIn78.winner && playIn78.a && playIn78.b
      ? playIn78.winner === playIn78.a
        ? playIn78.b
        : playIn78.a
      : null;
  const winner910 = playIn910.winner;
  const playIn8 = matchup(`${conf}-pi-8`, "Play-In · 8-seed", loser78, winner910, save);
  const seed8 = playIn8.winner;

  // Standard NBA first-round pairing (winners: 1/8 vs 4/5, 2/7 vs 3/6).
  const r1: BracketMatchup[] = [
    matchup(`${conf}-r1-0`, "1 vs 8", s(1), seed8, save),
    matchup(`${conf}-r1-1`, "4 vs 5", s(4), s(5), save),
    matchup(`${conf}-r1-2`, "3 vs 6", s(3), s(6), save),
    matchup(`${conf}-r1-3`, "2 vs 7", s(2), seed7, save),
  ];
  const sf: BracketMatchup[] = [
    matchup(`${conf}-sf-0`, "Conf. Semis", r1[0]!.winner, r1[1]!.winner, save),
    matchup(`${conf}-sf-1`, "Conf. Semis", r1[3]!.winner, r1[2]!.winner, save),
  ];
  const final = matchup(`${conf}-f`, "Conf. Finals", sf[0]!.winner, sf[1]!.winner, save);
  return {
    conf,
    seeds,
    playIn78,
    playIn910,
    playIn8,
    seed7,
    seed8,
    r1,
    sf,
    final,
  };
}

export function resolveBracket(
  eastSeeds: string[],
  westSeeds: string[],
  save: BracketSave,
): ResolvedBracket {
  const east = buildConference("east", eastSeeds, save);
  const west = buildConference("west", westSeeds, save);
  const finals = matchup("finals", "NBA Finals", east.final.winner, west.final.winner, save, "win");
  return { east, west, finals };
}

/** Downstream match ids that must clear when an earlier pick changes. */
const DEPENDENTS: Record<string, BracketMatchId[]> = {
  "east-pi-78": ["east-pi-8", "east-r1-0", "east-r1-3", "east-sf-0", "east-sf-1", "east-f", "finals"],
  "east-pi-910": ["east-pi-8", "east-r1-0", "east-sf-0", "east-sf-1", "east-f", "finals"],
  "east-pi-8": ["east-r1-0", "east-sf-0", "east-f", "finals"],
  "east-r1-0": ["east-sf-0", "east-f", "finals"],
  "east-r1-1": ["east-sf-0", "east-f", "finals"],
  "east-r1-2": ["east-sf-1", "east-f", "finals"],
  "east-r1-3": ["east-sf-1", "east-f", "finals"],
  "east-sf-0": ["east-f", "finals"],
  "east-sf-1": ["east-f", "finals"],
  "east-f": ["finals"],
  "west-pi-78": ["west-pi-8", "west-r1-0", "west-r1-3", "west-sf-0", "west-sf-1", "west-f", "finals"],
  "west-pi-910": ["west-pi-8", "west-r1-0", "west-sf-0", "west-sf-1", "west-f", "finals"],
  "west-pi-8": ["west-r1-0", "west-sf-0", "west-f", "finals"],
  "west-r1-0": ["west-sf-0", "west-f", "finals"],
  "west-r1-1": ["west-sf-0", "west-f", "finals"],
  "west-r1-2": ["west-sf-1", "west-f", "finals"],
  "west-r1-3": ["west-sf-1", "west-f", "finals"],
  "west-sf-0": ["west-f", "finals"],
  "west-sf-1": ["west-f", "finals"],
  "west-f": ["finals"],
  finals: [],
};

function clearMatch(winners: BracketSave["winners"], scores: BracketSave["scores"], id: BracketMatchId): void {
  delete winners[id];
  delete scores[id];
}

/**
 * ADV / WIN — set or clear a matchup winner. Tap same team again → clear.
 * Downstream picks + scores that no longer make sense are wiped so the tree adjusts.
 */
export function setBracketWinner(
  save: BracketSave,
  matchId: BracketMatchId,
  teamId: string | null,
): BracketSave {
  const winners = { ...save.winners };
  const scores = { ...save.scores };
  const prev = winners[matchId] ?? null;
  if (!teamId || prev === teamId) {
    clearMatch(winners, scores, matchId);
  } else {
    winners[matchId] = teamId;
    delete scores[matchId]; // new ADV/WIN → blank optional score
  }
  for (const dep of DEPENDENTS[matchId] ?? []) {
    clearMatch(winners, scores, dep);
  }
  return { ...save, winners, scores };
}

/** Optional series score for a match that already has an ADV/WIN pick. Blank clears. */
export function setBracketScore(
  save: BracketSave,
  matchId: BracketMatchId,
  score: BracketSeriesScore | null,
): BracketSave {
  if (!save.winners[matchId]) {
    const scores = { ...save.scores };
    delete scores[matchId];
    return { ...save, scores };
  }
  const scores = { ...save.scores };
  if (!score) delete scores[matchId];
  else scores[matchId] = score;
  return { ...save, scores };
}

export function setBracketRegion(save: BracketSave, region: BracketRegionView): BracketSave {
  return { ...save, region };
}

export function clearBracketWinners(save: BracketSave): BracketSave {
  return { ...save, winners: {}, scores: {} };
}

export function formatBracketScore(score: BracketSeriesScore | null | undefined): string {
  if (!score) return "";
  return `${score.winner}–${score.loser}`;
}

export function isPlayInMatch(id: BracketMatchId): boolean {
  return id.includes("-pi-");
}
