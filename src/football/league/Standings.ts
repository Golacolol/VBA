import type { Conference, FixtureRecord, TeamRecord } from "../../data/schema";
import { todayIso } from "../../data/leagueSchedule";

export interface TableRow {
  teamId: string;
  name: string;
  abbreviation: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

/**
 * NBA regular-season window for standings (excludes prior season + playoffs).
 * Season year Y runs roughly Oct Y → mid-Apr Y+1.
 */
export function nbaRegularSeasonRange(asOf: Date | string = new Date()): { start: string; endInclusive: string } {
  const iso = typeof asOf === "string" ? asOf.slice(0, 10) : todayIso(asOf);
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  // Jul–Sep = offseason after Finals → keep prior season's final table.
  // Oct–Dec = new season year; Jan–Jun = season that started previous Oct.
  const startYear = m >= 10 ? y : m >= 7 ? y - 1 : y - 1;
  return {
    start: `${startYear}-10-01`,
    endInclusive: `${startYear + 1}-04-15`,
  };
}

export function fixtureInNbaRegularSeason(
  date: string,
  asOf: Date | string = new Date(),
): boolean {
  const { start, endInclusive } = nbaRegularSeasonRange(asOf);
  const d = date.slice(0, 10);
  return d >= start && d <= endInclusive;
}

/** Standings / fixtures tab — NBA = both conferences combined. */
export type LeagueTabId = "NBA" | Conference;

export const LEAGUE_TABS: { id: LeagueTabId; label: string }[] = [
  { id: "NBA", label: "NBA" },
  { id: "EAST", label: "Eastern Conference" },
  { id: "WEST", label: "Western Conference" },
];

export function isLeagueTabId(v: unknown): v is LeagueTabId {
  return v === "NBA" || v === "EAST" || v === "WEST";
}

export function competitionForLeague(league: Conference): string {
  return league === "WEST" ? "Western Conference" : "Eastern Conference";
}

export function isEnglishLeagueCompetition(competition: string): boolean {
  return competition === "Eastern Conference" || competition === "Western Conference";
}

export function conferenceForTeam(team: TeamRecord | undefined): Conference {
  if (team?.conference === "EAST" || team?.conference === "WEST") return team.conference;
  if (team?.league === "EAST" || team?.league === "WEST") return team.league;
  return "EAST";
}

/** @deprecated Prefer conferenceForTeam */
export function leagueForTeam(team: TeamRecord | undefined): Conference {
  return conferenceForTeam(team);
}

export function standingsFor(
  fixtures: FixtureRecord[],
  teams: TeamRecord[],
  league: LeagueTabId,
  opts?: { asOf?: Date | string },
): TableRow[] {
  const asOf = opts?.asOf ?? new Date();
  const clubs = teams
    .filter(
      (t) =>
        t.teamType === "CURRENT_TEAM" &&
        (league === "NBA" || conferenceForTeam(t) === league),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = new Map<string, TableRow>();
  for (const club of clubs) {
    rows.set(club.id, emptyRow(club));
  }
  for (const fixture of fixtures) {
    if (!fixture.played) continue;
    // Prior season + playoffs inflate P into the 100s — keep current regular season only.
    if (!fixtureInNbaRegularSeason(fixture.date, asOf)) continue;
    // Tables count every game involving a listed club (not only intra-conference).
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home && !away) continue;
    const hs = fixture.homeScore ?? 0;
    const as = fixture.awayScore ?? 0;
    if (home) applyResult(home, hs, as);
    if (away) applyResult(away, as, hs);
  }
  return [...rows.values()].sort(compareTable);
}

function emptyRow(team: TeamRecord): TableRow {
  return {
    teamId: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
  };
}

function applyResult(row: TableRow, scored: number, conceded: number): void {
  row.played += 1;
  row.gf += scored;
  row.ga += conceded;
  row.gd = row.gf - row.ga;
  if (scored > conceded) {
    row.won += 1;
    row.pts += 1; // NBA: win = 1 (display as W-L; pts unused for sort primarily)
  } else if (scored < conceded) {
    row.lost += 1;
  } else {
    row.drawn += 1;
  }
}

function compareTable(a: TableRow, b: TableRow): number {
  if (b.won !== a.won) return b.won - a.won;
  if (a.lost !== b.lost) return a.lost - b.lost;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}
