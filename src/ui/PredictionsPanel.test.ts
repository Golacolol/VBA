import { describe, expect, it } from "vitest";
import type { GameDatabase } from "../core/Database";
import type { FixtureRecord, TeamRecord } from "../data/schema";
import { predictionsPanelHtml } from "./PredictionsPanel";
import type { PredictionsState } from "../football/predictions/Predictions";

function team(id: string, name: string, abbr: string): TeamRecord {
  return {
    id,
    name,
    abbreviation: abbr,
    primaryColor: "#111111",
    secondaryColor: "#eeeeee",
    badgeAsset: `/assets/emblems/${id}.svg`,
    defaultStadiumId: `${id}_arena`,
    defaultFormation: "BASKETBALL_5",
    teamType: "CURRENT_TEAM",
    conference: "EAST",
  } as TeamRecord;
}

describe("PredictionsPanel", () => {
  it("renders emblems and winner pick controls instead of score spins", () => {
    const home = team("nba_bos", "Boston Celtics", "BOS");
    const away = team("nba_nyk", "New York Knicks", "NYK");
    const fixture = {
      id: "f1",
      homeTeamId: home.id,
      awayTeamId: away.id,
      venueId: "nba_bos_arena",
      competition: "Eastern Conference",
      date: "2026-09-19",
      time: "00:00",
      played: false,
    } as FixtureRecord;
    const state: PredictionsState = {
      totalPoints: 0,
      weeks: [
        {
          weekStart: "2026-09-19",
          fixtureIds: ["f1"],
          adminSet: true,
          picks: [{ fixtureId: "f1", winner: "HOME", locked: false }],
          scored: false,
          weekPoints: 0,
        },
      ],
    };
    const db = {
      fixtures: [fixture],
      teams: new Map([
        [home.id, home],
        [away.id, away],
      ]),
      teamStrength: (id: string) => (id === home.id ? 88 : 80),
    } as unknown as GameDatabase;

    const html = predictionsPanelHtml(db, state, "predict", "2026-09-19", "2026-09-15");
    expect(html).not.toContain("Pick who wins");
    expect(html).toContain("PREDICT");
    expect(html).toContain('data-pred="hints"');
    expect(html).toContain('data-pred-winner="HOME"');
    expect(html).toContain('data-pred-winner="AWAY"');
    expect(html).toContain("pred-crest");
    expect(html).toContain("/assets/emblems/nba_bos.svg");
    expect(html).toContain("/assets/emblems/nba_nyk.svg");
    expect(html).toContain("BOS");
    expect(html).toContain("NYK");
    expect(html).not.toContain("model-fav");
    expect(html).not.toContain("data-pred-spin");
    expect(html).not.toContain("Exact score");

    const hinted = predictionsPanelHtml(db, state, "predict", "2026-09-19", "2026-09-15", undefined, true);
    expect(hinted).toContain("pred-hint-btn on");
    expect(hinted).toContain("model-fav");
  });
});
