import { describe, expect, it } from "vitest";
import type { FixtureRecord, TeamRecord } from "../data/schema";
import {
  fixtureCountsForStandings,
  fixtureInNbaRegularSeason,
  nbaRegularSeasonRange,
  standingsFor,
} from "../football/league/Standings";

function club(id: string, conference: "EAST" | "WEST"): TeamRecord {
  return {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    teamType: "CURRENT_TEAM",
    primaryColor: "#333",
    secondaryColor: "#fff",
    defaultKit: { shirt: "#333", shorts: "#fff", socks: "#333" },
    goalkeeperKit: { shirt: "#111", shorts: "#111", socks: "#111" },
    defaultStadiumId: `${id}_arena`,
    defaultFormation: "BASKETBALL_5",
    conference,
    league: conference,
  };
}

function played(
  id: string,
  home: string,
  away: string,
  date: string,
  homeScore: number,
  awayScore: number,
): FixtureRecord {
  return {
    id,
    homeTeamId: home,
    awayTeamId: away,
    venueId: `${home}_arena`,
    competition: "Eastern Conference",
    date,
    time: "19:00",
    durationSeconds: 600,
    played: true,
    homeScore,
    awayScore,
  };
}

describe("nba regular season standings window", () => {
  it("bounds early November to opening night→mid-Apr (excludes preseason)", () => {
    expect(nbaRegularSeasonRange("2026-11-04")).toEqual({
      start: "2026-10-20",
      endInclusive: "2027-04-15",
    });
    expect(fixtureInNbaRegularSeason("2026-11-01", "2026-11-04")).toBe(true);
    expect(fixtureInNbaRegularSeason("2026-10-10", "2026-11-04")).toBe(false);
    expect(fixtureInNbaRegularSeason("2026-05-20", "2026-11-04")).toBe(false);
    expect(fixtureInNbaRegularSeason("2025-12-01", "2026-11-04")).toBe(false);
  });

  it("does not count prior-season, preseason, or playoff games toward played", () => {
    const teams = [club("nba_nyk", "EAST"), club("nba_bos", "EAST"), club("nba_gsw", "WEST")];
    const fixtures: FixtureRecord[] = [
      played("old", "nba_nyk", "nba_bos", "2025-12-01", 110, 100),
      played("pre", "nba_nyk", "nba_bos", "2026-10-10", 120, 100),
      {
        ...played("tagged-pre", "nba_nyk", "nba_bos", "2026-10-22", 99, 90),
        seasonPhase: "preseason",
      },
      played("playoff", "nba_nyk", "nba_bos", "2026-05-20", 105, 99),
      played("now-a", "nba_nyk", "nba_bos", "2026-10-25", 112, 108),
      played("now-b", "nba_nyk", "nba_gsw", "2026-11-01", 120, 115),
    ];
    expect(fixtureCountsForStandings(fixtures[1]!, "2026-11-04")).toBe(false);
    expect(fixtureCountsForStandings(fixtures[2]!, "2026-11-04")).toBe(false);
    const table = standingsFor(fixtures, teams, "EAST", { asOf: "2026-11-04" });
    const nyk = table.find((r) => r.teamId === "nba_nyk");
    expect(nyk).toMatchObject({ played: 2, won: 2, lost: 0 });
  });

  it("orders by winning percentage before raw wins", () => {
    const teams = [club("nba_hou", "WEST"), club("nba_mem", "WEST"), club("nba_por", "WEST")];
    const fixtures: FixtureRecord[] = [
      // HOU 3-1 (.750)
      played("h1", "nba_hou", "nba_por", "2026-10-22", 110, 100),
      played("h2", "nba_hou", "nba_por", "2026-10-23", 110, 100),
      played("h3", "nba_hou", "nba_por", "2026-10-24", 110, 100),
      played("h4", "nba_hou", "nba_por", "2026-10-25", 90, 100),
      // MEM 4-2 (.667) — more wins, worse pct
      played("m1", "nba_mem", "nba_por", "2026-10-22", 110, 100),
      played("m2", "nba_mem", "nba_por", "2026-10-23", 110, 100),
      played("m3", "nba_mem", "nba_por", "2026-10-24", 110, 100),
      played("m4", "nba_mem", "nba_por", "2026-10-25", 110, 100),
      played("m5", "nba_mem", "nba_por", "2026-10-26", 90, 100),
      played("m6", "nba_mem", "nba_por", "2026-10-27", 90, 100),
    ];
    const west = standingsFor(fixtures, teams, "WEST", { asOf: "2026-11-04" });
    expect(west.map((r) => r.teamId)).toEqual(["nba_hou", "nba_mem", "nba_por"]);
  });
});
