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
  preferredPredictionViewWeek,
  predictionWeekEnd,
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
  it("maps Sat–Fri to that Saturday (Friday night tips stay in the live week)", () => {
    expect(predictionWeekStart("2026-09-12")).toBe("2026-09-12"); // Sat
    expect(predictionWeekStart("2026-09-15")).toBe("2026-09-12"); // Tue
    expect(predictionWeekStart("2026-09-17")).toBe("2026-09-12"); // Thu
    expect(predictionWeekStart("2026-09-18")).toBe("2026-09-12"); // Fri
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
  it("auto-selects ten East/West fixtures in the Sat–Fri window once the deadline hits", () => {
    const weekStart = "2026-09-19";
    const fixtures = Array.from({ length: 14 }, (_, i) =>
      fix(`f${i}`, i < 10 ? "2026-09-19" : "2026-09-20", `h${i}`, `a${i}`, {
        official: true,
        competition: i % 2 ? "Western Conference" : "Eastern Conference",
      }),
    );
    // Deadline for Sat 19th is Fri 18th — also still inside the prior Sat–Fri week.
    const state = ensurePredictionWeek(blankPredictions(), fixtures, "2026-09-18", weekStart);
    const week = state.weeks.find((w) => w.weekStart === weekStart)!;
    expect(week.fixtureIds).toHaveLength(10);
    expect(week.adminSet).toBe(false);
    expect(predictionWeekEnd(weekStart)).toBe("2026-09-25");
  });

  it("drops pruned fixture ids and refills from the live ESPN slate", () => {
    const fixtures = Array.from({ length: 12 }, (_, i) =>
      fix(`nba_result_${i}`, "2026-09-19", `h${i}`, `a${i}`, { official: true }),
    );
    const stale = setAdminPredictionFixtures(blankPredictions(), "2026-09-19", [
      "nba_fix_gone_1",
      "nba_fix_gone_2",
      "nba_result_0",
    ]);
    // Force non-admin so ensure can refill after reconcile voids the admin lock.
    stale.weeks[0]!.adminSet = false;
    stale.weeks[0]!.fixtureIds = [
      "nba_fix_gone_1",
      "nba_fix_gone_2",
      "nba_result_0",
      "nba_fix_gone_3",
      "nba_fix_gone_4",
      "nba_fix_gone_5",
      "nba_fix_gone_6",
      "nba_fix_gone_7",
      "nba_fix_gone_8",
      "nba_fix_gone_9",
    ];
    stale.weeks[0]!.picks = stale.weeks[0]!.fixtureIds.map((fixtureId) => ({
      fixtureId,
      winner: null,
      locked: false,
    }));
    const state = ensurePredictionWeek(stale, fixtures, "2026-09-20", "2026-09-19");
    const week = state.weeks.find((w) => w.weekStart === "2026-09-19")!;
    expect(week.fixtureIds).toHaveLength(10);
    expect(week.fixtureIds.every((id) => id.startsWith("nba_result_"))).toBe(true);
    expect(week.fixtureIds).toContain("nba_result_0");
  });

  it("refreshes an auto slate when every tip is already finalled", () => {
    const played = Array.from({ length: 10 }, (_, i) =>
      fix(`old${i}`, "2026-09-19", `h${i}`, `a${i}`, {
        official: true,
        played: true,
        homeScore: 100,
        awayScore: 90,
      }),
    );
    const fresh = Array.from({ length: 8 }, (_, i) =>
      fix(`new${i}`, "2026-09-24", `x${i}`, `y${i}`, { official: true, played: false }),
    );
    let state = setAdminPredictionFixtures(
      blankPredictions(),
      "2026-09-19",
      played.map((f) => f.id),
    );
    state.weeks[0]!.adminSet = false;
    state = ensurePredictionWeek(state, [...played, ...fresh], "2026-09-24", "2026-09-19");
    const week = state.weeks.find((w) => w.weekStart === "2026-09-19")!;
    expect(week.fixtureIds.filter((id) => id.startsWith("new"))).toHaveLength(8);
    expect(week.fixtureIds).toHaveLength(10);
  });

  it("prefers next week when the live window has no unplayed tips", () => {
    const fixtures = [
      fix("done", "2026-09-19", "a", "b", {
        official: true,
        played: true,
        homeScore: 110,
        awayScore: 100,
      }),
    ];
    expect(preferredPredictionViewWeek(fixtures, "2026-09-22")).toBe("2026-09-26");
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
