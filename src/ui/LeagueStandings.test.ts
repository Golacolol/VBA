import { describe, expect, it } from "vitest";
import type { FixtureRecord, TeamRecord } from "../data/schema";
import {
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
  it("bounds early November to the open season Oct→mid-Apr", () => {
    expect(nbaRegularSeasonRange("2026-11-04")).toEqual({
      start: "2026-10-01",
      endInclusive: "2027-04-15",
    });
    expect(fixtureInNbaRegularSeason("2026-11-01", "2026-11-04")).toBe(true);
    expect(fixtureInNbaRegularSeason("2026-05-20", "2026-11-04")).toBe(false);
    expect(fixtureInNbaRegularSeason("2025-12-01", "2026-11-04")).toBe(false);
  });

  it("does not count prior-season or playoff games toward played", () => {
    const teams = [club("nba_nyk", "EAST"), club("nba_bos", "EAST"), club("nba_gsw", "WEST")];
    const fixtures: FixtureRecord[] = [
      played("old", "nba_nyk", "nba_bos", "2025-12-01", 110, 100),
      played("playoff", "nba_nyk", "nba_bos", "2026-05-20", 105, 99),
      played("now-a", "nba_nyk", "nba_bos", "2026-10-25", 112, 108),
      played("now-b", "nba_nyk", "nba_gsw", "2026-11-01", 120, 115),
    ];
    const table = standingsFor(fixtures, teams, "EAST", { asOf: "2026-11-04" });
    const nyk = table.find((r) => r.teamId === "nba_nyk");
    expect(nyk).toMatchObject({ played: 2, won: 2, lost: 0 });
  });
});
