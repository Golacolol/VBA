import { describe, expect, it } from "vitest";
import type { FixtureRecord } from "../../data/schema";
import {
  autoSelectPredictionFixtures,
  blankPredictions,
  ensurePredictionWeek,
  fixtureWinner,
  matchOutcome,
  maxPredictionWeekStart,
  normalizePredictions,
  predictionWeekStart,
  scoreWinnerPrediction,
  setAdminPredictionFixtures,
  shiftPredictionWeek,
  updatePredictionPick,
} from "./Predictions";

function fix(
  id: string,
  date: string,
  home: string,
  away: string,
  extra: Partial<FixtureRecord> = {},
): FixtureRecord {
  return {
    id,
    date,
    time: "00:00",
    durationSeconds: 600,
    homeTeamId: home,
    awayTeamId: away,
    venueId: "v",
    competition: "Eastern Conference",
    weather: "MILD",
    timeOfDay: "EVENING",
    played: false,
    ...extra,
  };
}

describe("prediction week calendar", () => {
  it("maps Sat–Thu to that Saturday and Friday to the next Saturday", () => {
    expect(predictionWeekStart("2026-09-12")).toBe("2026-09-12"); // Sat
    expect(predictionWeekStart("2026-09-15")).toBe("2026-09-12"); // Tue
    expect(predictionWeekStart("2026-09-17")).toBe("2026-09-12"); // Thu
    expect(predictionWeekStart("2026-09-18")).toBe("2026-09-19"); // Fri → next Sat
  });

  it("allows browsing current and next week only as the forward limit", () => {
    expect(maxPredictionWeekStart("2026-09-15")).toBe("2026-09-19");
    expect(shiftPredictionWeek("2026-09-12", 1)).toBe("2026-09-19");
  });
});

describe("prediction scoring", () => {
  it("awards a point for the correct winner only", () => {
    expect(scoreWinnerPrediction("HOME", 110, 98)).toBe(1);
    expect(scoreWinnerPrediction("AWAY", 110, 98)).toBe(0);
    expect(scoreWinnerPrediction("AWAY", 98, 110)).toBe(1);
    expect(scoreWinnerPrediction(null, 110, 98)).toBe(0);
    expect(scoreWinnerPrediction("HOME", 100, 100)).toBe(0);
    expect(fixtureWinner(110, 98)).toBe("HOME");
    expect(fixtureWinner(98, 110)).toBe("AWAY");
    expect(matchOutcome(100, 100)).toBe("DRAW");
  });
});

describe("prediction slate", () => {
  it("auto-selects ten East/West fixtures in the Sat–Thu window from Friday", () => {
    const weekStart = "2026-09-19";
    const fixtures = Array.from({ length: 14 }, (_, i) =>
      fix(`f${i}`, i < 10 ? "2026-09-19" : "2026-09-20", `h${i}`, `a${i}`, {
        official: true,
        competition: i % 2 ? "Western Conference" : "Eastern Conference",
      }),
    );
    const state = ensurePredictionWeek(blankPredictions(), fixtures, "2026-09-18"); // Friday
    const week = state.weeks.find((w) => w.weekStart === weekStart)!;
    expect(week.fixtureIds).toHaveLength(10);
    expect(week.adminSet).toBe(false);
  });

  it("ignores non-conference competitions when auto-selecting", () => {
    const fixtures = [
      fix("nba", "2026-09-19", "a", "b", { official: true }),
      fix("friendly", "2026-09-19", "c", "d", { official: true, competition: "Friendly" }),
    ];
    expect(autoSelectPredictionFixtures(fixtures, "2026-09-19")).toEqual(["nba"]);
  });

  it("lets admin set and re-set the slate", () => {
    let state = setAdminPredictionFixtures(blankPredictions(), "2026-09-19", ["a", "b", "c"]);
    expect(state.weeks[0]!.fixtureIds).toEqual(["a", "b", "c"]);
    expect(state.weeks[0]!.adminSet).toBe(true);
    state = setAdminPredictionFixtures(state, "2026-09-19", ["x", "y"]);
    expect(state.weeks[0]!.fixtureIds).toEqual(["x", "y"]);
  });

  it("locks picks so winner choice cannot change until unlocked", () => {
    let state = setAdminPredictionFixtures(blankPredictions(), "2026-09-19", ["f1"]);
    state = updatePredictionPick(state, "2026-09-19", "f1", { winner: "HOME", locked: true });
    state = updatePredictionPick(state, "2026-09-19", "f1", { winner: "AWAY" });
    expect(state.weeks[0]!.picks[0]).toMatchObject({ winner: "HOME", locked: true });
    state = updatePredictionPick(state, "2026-09-19", "f1", { locked: false, winner: "AWAY" });
    expect(state.weeks[0]!.picks[0]!.winner).toBe("AWAY");
  });

  it("prefers diverse official tips when auto-selecting", () => {
    const fixtures = [
      fix("1", "2026-09-19", "a", "b", { official: true }),
      fix("2", "2026-09-19", "a", "c", { official: true }),
      fix("3", "2026-09-20", "d", "e", { official: true }),
    ];
    const ids = autoSelectPredictionFixtures(fixtures, "2026-09-19");
    expect(ids[0]).toBe("1");
    expect(ids).toContain("3");
  });

  it("migrates legacy score picks into a winner", () => {
    const state = normalizePredictions({
      weeks: [
        {
          weekStart: "2026-09-19",
          fixtureIds: ["f1", "f2"],
          adminSet: true,
          picks: [
            { fixtureId: "f1", home: 2, away: 1, locked: true },
            { fixtureId: "f2", home: 0, away: 0, locked: false },
          ],
          scored: false,
          weekPoints: 0,
        },
      ],
      totalPoints: 0,
    });
    expect(state.weeks[0]!.picks[0]).toMatchObject({ winner: "HOME", locked: true });
    expect(state.weeks[0]!.picks[1]!.winner).toBeNull();
  });
});
