import type { GameDatabase } from "../../core/Database";
import type { FixtureRecord, TeamRecord } from "../../data/schema";
import { standingsFor } from "../league/Standings";
import type { PredictionWinner } from "./Predictions";

/** Roster OVR bump for home court — keeps favorites from flipping on tiny rating noise. */
export const HOME_COURT_STRENGTH = 2.4;
/** How strongly season win% pulls relative to roster OVR. */
export const WIN_PCT_WEIGHT = 10;

/** Sportsbook favorite when ESPN/DraftKings lines are on the fixture. */
export function favoriteFromOdds(fixture: FixtureRecord): PredictionWinner | null {
  if (fixture.oddsFavorite === "HOME" || fixture.oddsFavorite === "AWAY") {
    return fixture.oddsFavorite;
  }
  const homeMl = fixture.oddsMoneylineHome;
  const awayMl = fixture.oddsMoneylineAway;
  if (homeMl != null && awayMl != null && Number.isFinite(homeMl) && Number.isFinite(awayMl)) {
    if (homeMl === awayMl) return null;
    // American odds: the more negative (or smaller) price is the favorite.
    return homeMl < awayMl ? "HOME" : "AWAY";
  }
  if (typeof fixture.oddsSpread === "number" && Number.isFinite(fixture.oddsSpread) && fixture.oddsSpread !== 0) {
    return fixture.oddsSpread < 0 ? "HOME" : "AWAY";
  }
  return null;
}

/** Fallback model: roster strength + home court + season win%. */
export function favoriteFromModel(
  fixture: FixtureRecord,
  strengthOf: (teamId: string) => number,
  winPctOf?: (teamId: string) => number,
): PredictionWinner {
  const home =
    strengthOf(fixture.homeTeamId) +
    HOME_COURT_STRENGTH +
    (winPctOf?.(fixture.homeTeamId) ?? 0.5) * WIN_PCT_WEIGHT;
  const away =
    strengthOf(fixture.awayTeamId) + (winPctOf?.(fixture.awayTeamId) ?? 0.5) * WIN_PCT_WEIGHT;
  return home >= away ? "HOME" : "AWAY";
}

export function buildTeamWinPctMap(
  fixtures: FixtureRecord[],
  teams: TeamRecord[] | Iterable<TeamRecord>,
): Map<string, number> {
  const list = Array.isArray(teams) ? teams : [...teams];
  const rows = standingsFor(fixtures, list, "NBA");
  return new Map(rows.map((r) => [r.teamId, r.played > 0 ? r.won / r.played : 0.5]));
}

/**
 * Most likely winner: Vegas/DraftKings line when present, else roster + form model.
 * Does not auto-fill the user's pick — UI only.
 */
export function likelyWinner(
  fixture: FixtureRecord,
  db: Pick<GameDatabase, "teamStrength" | "fixtures" | "teams">,
  winPctMap?: Map<string, number>,
): PredictionWinner {
  const fromOdds = favoriteFromOdds(fixture);
  if (fromOdds) return fromOdds;
  const pct = winPctMap ?? buildTeamWinPctMap(db.fixtures, db.teams.values());
  return favoriteFromModel(
    fixture,
    (id) => db.teamStrength(id),
    (id) => pct.get(id) ?? 0.5,
  );
}
