import { describe, expect, it } from "vitest";
import type { FixtureRecord } from "../../data/schema";
import {
  favoriteFromModel,
  favoriteFromOdds,
  HOME_COURT_STRENGTH,
  likelyWinner,
} from "./LikelyWinner";

function fix(extra: Partial<FixtureRecord> = {}): FixtureRecord {
  return {
    id: "f1",
    homeTeamId: "nba_bos",
    awayTeamId: "nba_nyk",
    venueId: "nba_bos_arena",
    competition: "Eastern Conference",
    date: "2026-11-07",
    time: "00:00",
    durationSeconds: 600,
    played: false,
    ...extra,
  };
}

describe("favoriteFromOdds", () => {
  it("uses explicit sportsbook favorite", () => {
    expect(favoriteFromOdds(fix({ oddsFavorite: "AWAY" }))).toBe("AWAY");
  });

  it("infers favorite from American moneylines", () => {
    expect(favoriteFromOdds(fix({ oddsMoneylineHome: -180, oddsMoneylineAway: 150 }))).toBe("HOME");
    expect(favoriteFromOdds(fix({ oddsMoneylineHome: 140, oddsMoneylineAway: -160 }))).toBe("AWAY");
  });

  it("infers favorite from home spread", () => {
    expect(favoriteFromOdds(fix({ oddsSpread: -5.5 }))).toBe("HOME");
    expect(favoriteFromOdds(fix({ oddsSpread: 3.5 }))).toBe("AWAY");
  });
});

describe("favoriteFromModel", () => {
  it("leans home when strengths are equal (home court)", () => {
    expect(favoriteFromModel(fix(), () => 80)).toBe("HOME");
  });

  it("picks the clearly stronger side", () => {
    const strength = (id: string) => (id === "nba_nyk" ? 90 : 70);
    expect(favoriteFromModel(fix(), strength)).toBe("AWAY");
    expect(90).toBeGreaterThan(70 + HOME_COURT_STRENGTH);
  });
});

describe("likelyWinner", () => {
  it("prefers odds over the roster model", () => {
    const fixture = fix({ oddsFavorite: "AWAY" });
    const db = {
      fixtures: [fixture],
      teams: new Map(),
      teamStrength: () => 99,
    };
    expect(likelyWinner(fixture, db)).toBe("AWAY");
  });
});
