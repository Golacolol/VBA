import { describe, expect, it } from "vitest";
import type { TeamRecord } from "../data/schema";
import {
  buildMenuTeamOptions,
  clubBaseName,
  erasForClub,
  findTeamOption,
  formatEraRoll,
  oppositionRollIndex,
  oppositionRollLabel,
  oppositionRollOptions,
  secondaryDialLabel,
  teamsInGroup,
  uniqueClubsInGroup,
} from "./menuTeamSelect";

function team(partial: Partial<TeamRecord> & Pick<TeamRecord, "id" | "name">): TeamRecord {
  return {
    abbreviation: "X",
    shortName: partial.name,
    defaultStadiumId: "ground",
    primaryColor: "#000",
    secondaryColor: "#fff",
    defaultKit: { shirt: "#000", shorts: "#fff", socks: "#000" },
    teamType: "CURRENT_TEAM",
    ...partial,
  } as TeamRecord;
}

describe("menuTeamSelect", () => {
  it("strips era suffixes from classic display names", () => {
    expect(clubBaseName("Chicago Bulls — 1995/96")).toBe("Chicago Bulls");
    expect(clubBaseName("Lakers — 1986/87")).toBe("Lakers");
  });

  it("formats season rolls as short dates, never nicknames", () => {
    expect(formatEraRoll("2004/05")).toBe("04-05");
    expect(formatEraRoll("1991/92")).toBe("91-92");
    expect(formatEraRoll("2000")).toBe("00");
    expect(formatEraRoll("2021-22")).toBe("21-22");
  });

  it("groups current franchises by East / West conference", () => {
    const options = buildMenuTeamOptions([
      team({ id: "nba_bos", name: "Boston Celtics", conference: "EAST", league: "EAST", teamType: "CURRENT_TEAM" }),
      team({ id: "nba_lal", name: "Los Angeles Lakers", conference: "WEST", league: "WEST", teamType: "CURRENT_TEAM" }),
      team({
        id: "classic_bulls_1995_96",
        name: "Chicago Bulls — 1995/96",
        teamType: "HISTORIC_TEAM",
        historicSeason: "1995/96",
        franchiseId: "nba_chi",
        conference: "EAST",
      }),
      team({
        id: "nba_chi",
        name: "Chicago Bulls",
        conference: "EAST",
        league: "EAST",
        teamType: "CURRENT_TEAM",
      }),
    ]);

    expect(findTeamOption(options, "nba_bos")).toMatchObject({ label: "Boston Celtics", group: "EAST" });
    expect(findTeamOption(options, "nba_lal")).toMatchObject({ label: "Los Angeles Lakers", group: "WEST" });
    expect(findTeamOption(options, "classic_bulls_1995_96")).toMatchObject({
      label: "Chicago Bulls",
      group: "EAST",
      clubKey: "nba_chi",
      eraLabel: "95-96",
    });
    expect(secondaryDialLabel(findTeamOption(options, "nba_bos")!)).toBe("East");
    expect(secondaryDialLabel(findTeamOption(options, "nba_lal")!)).toBe("West");
    expect(uniqueClubsInGroup(options, "EAST").map((o) => o.label).sort()).toEqual([
      "Boston Celtics",
      "Chicago Bulls",
    ]);
  });

  it("builds a continuous opposition roll across conferences, excluding the user club", () => {
    const options = buildMenuTeamOptions([
      team({ id: "nba_bos", name: "Boston Celtics", conference: "EAST", league: "EAST", teamType: "CURRENT_TEAM" }),
      team({ id: "nba_nyk", name: "New York Knicks", conference: "EAST", league: "EAST", teamType: "CURRENT_TEAM" }),
      team({ id: "nba_lal", name: "Los Angeles Lakers", conference: "WEST", league: "WEST", teamType: "CURRENT_TEAM" }),
      team({
        id: "classic_bulls_1995_96",
        name: "Chicago Bulls — 1995/96",
        teamType: "HISTORIC_TEAM",
        historicSeason: "1995/96",
        franchiseId: "nba_chi",
        conference: "EAST",
      }),
      team({
        id: "nba_chi",
        name: "Chicago Bulls",
        conference: "EAST",
        league: "EAST",
        teamType: "CURRENT_TEAM",
      }),
    ]);
    const roll = oppositionRollOptions(options, "nba_bos");
    expect(new Set(roll.map((o) => o.id))).toEqual(
      new Set(["nba_nyk", "nba_lal", "classic_bulls_1995_96", "nba_chi"]),
    );
    expect(roll).toHaveLength(4);
    expect(oppositionRollIndex(roll, "nba_lal")).toBeGreaterThanOrEqual(0);
    expect(oppositionRollLabel(roll.find((o) => o.id === "classic_bulls_1995_96")!)).toBe(
      "Chicago Bulls 95-96",
    );
    // Current first, then historic eras — linked by franchiseId.
    expect(erasForClub(options, "nba_chi").map((o) => o.id)).toEqual([
      "nba_chi",
      "classic_bulls_1995_96",
    ]);
    expect(erasForClub(options, "nba_chi")[0]!.eraLabel).toBe("Current");
  });
});
