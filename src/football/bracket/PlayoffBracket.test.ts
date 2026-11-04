import { describe, expect, it } from "vitest";
import type { TableRow } from "../league/Standings";
import {
  blankBracketSave,
  clearBracketWinners,
  formatBracketScore,
  normalizeBracketSave,
  resolveBracket,
  seedTeamIds,
  setBracketScore,
  setBracketWinner,
} from "./PlayoffBracket";

function row(teamId: string): TableRow {
  return {
    teamId,
    name: teamId,
    abbreviation: teamId.slice(-3).toUpperCase(),
    played: 8,
    won: 5,
    drawn: 0,
    lost: 3,
    gf: 100,
    ga: 90,
    gd: 10,
    pts: 5,
  };
}

const EAST = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10"].map(row);
const WEST = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10"].map(row);

describe("PlayoffBracket", () => {
  it("seeds top 10 from standings", () => {
    expect(seedTeamIds(EAST, 10)).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
      "e5",
      "e6",
      "e7",
      "e8",
      "e9",
      "e10",
    ]);
  });

  it("fills play-in then first round 7/8 from ADV picks", () => {
    let save = blankBracketSave();
    save = setBracketWinner(save, "east-pi-78", "e7");
    save = setBracketWinner(save, "east-pi-910", "e9");
    save = setBracketWinner(save, "east-pi-8", "e9");
    const resolved = resolveBracket(seedTeamIds(EAST), seedTeamIds(WEST), save);
    expect(resolved.east.seed7).toBe("e7");
    expect(resolved.east.seed8).toBe("e9");
    expect(resolved.east.r1[0]).toMatchObject({ a: "e1", b: "e9", label: "1 vs 8" });
    expect(resolved.east.r1[3]).toMatchObject({ a: "e2", b: "e7", label: "2 vs 7" });
    expect(resolved.finals.action).toBe("win");
    expect(resolved.east.r1[0]!.action).toBe("adv");
  });

  it("stores optional series score and clears with ADV swap", () => {
    let save = setBracketWinner(blankBracketSave(), "east-r1-0", "e1");
    save = setBracketScore(save, "east-r1-0", { winner: 4, loser: 2 });
    expect(formatBracketScore(save.scores["east-r1-0"])).toBe("4–2");
    expect(resolveBracket(seedTeamIds(EAST), seedTeamIds(WEST), save).east.r1[0]!.score).toEqual({
      winner: 4,
      loser: 2,
    });
    save = setBracketWinner(save, "east-pi-8", "e8");
    expect(save.winners["east-r1-0"]).toBeUndefined();
    expect(save.scores["east-r1-0"]).toBeUndefined();
  });

  it("tap same ADV again clears the pick and score", () => {
    let save = setBracketWinner(blankBracketSave(), "west-r1-1", "w4");
    save = setBracketScore(save, "west-r1-1", { winner: 4, loser: 1 });
    save = setBracketWinner(save, "west-r1-1", "w4");
    expect(save.winners["west-r1-1"]).toBeUndefined();
    expect(save.scores["west-r1-1"]).toBeUndefined();
  });

  it("normalizes and clears winners + scores", () => {
    expect(
      normalizeBracketSave({
        winners: { "east-f": "e1" },
        scores: { "east-f": { winner: 4, loser: 3 } },
        region: "east",
      }),
    ).toEqual({
      winners: { "east-f": "e1" },
      scores: { "east-f": { winner: 4, loser: 3 } },
      region: "east",
    });
    expect(clearBracketWinners(normalizeBracketSave({ winners: { finals: "w1" }, region: "west" }))).toEqual({
      winners: {},
      scores: {},
      region: "west",
    });
  });
});
