import { describe, expect, it } from "vitest";
import { GameDatabase } from "../../core/Database";
import { SaveManager } from "../../core/SaveManager";
import {
  clubFilterLabel,
  isMiTeamBenchSlot,
  parseFilter,
  pickRandomForSlot,
  playerIdentityKey,
  poolCandidates,
  positionsForRole,
  positionsForSlot,
  serializeFilter,
  slotPackRole,
  teamMatchesFilter,
} from "./MiTeamPool";
import type { TeamRecord } from "../../data/schema";

function team(partial: Partial<TeamRecord> & { id: string }): TeamRecord {
  return {
    name: partial.name ?? partial.id,
    abbreviation: "TST",
    teamType: partial.teamType ?? "CURRENT_TEAM",
    primaryColor: "#fff",
    secondaryColor: "#000",
    defaultKit: { shirt: "#fff", shorts: "#000", socks: "#fff" },
    goalkeeperKit: { shirt: "#ff0", shorts: "#000", socks: "#ff0" },
    defaultStadiumId: "td_garden",
    defaultFormation: "BASKETBALL_5",
    ...partial,
  };
}

describe("MiTeamPool", () => {
  it("maps basketball slots to own position plus adjacent ones", () => {
    expect(positionsForSlot("PG")).toEqual(["PG", "SG"]);
    expect(positionsForSlot("SG")).toEqual(["PG", "SG", "SF"]);
    expect(positionsForSlot("SF")).toEqual(["SG", "SF", "PF"]);
    expect(positionsForSlot("PF")).toEqual(["SF", "PF", "C"]);
    expect(positionsForSlot("C")).toEqual(["PF", "C"]);
    expect(positionsForSlot("PG")).not.toContain("GK");
    expect(positionsForSlot("C")).not.toContain("GK");
    expect(slotPackRole("PG")).toBe("GUARD");
    expect(slotPackRole("SF")).toBe("WING");
    expect(slotPackRole("C")).toBe("BIG");
    expect(positionsForRole("GUARD")).toEqual(["PG", "SG", "SF"]);
    expect(positionsForRole("WING")).toEqual(["SG", "SF", "PF"]);
    expect(positionsForRole("BIG")).toEqual(["SF", "PF", "C"]);
  });

  it("treats substitute slots as any-position packs", () => {
    expect(isMiTeamBenchSlot("BENCH_1")).toBe(true);
    expect(isMiTeamBenchSlot("BENCH_8")).toBe(true);
    expect(isMiTeamBenchSlot("PG")).toBe(false);
    const bench = positionsForSlot("BENCH_1");
    expect(bench).toEqual(["PG", "SG", "SF", "PF", "C"]);
    expect(bench).not.toContain("GK");
    expect(bench.length).toBeGreaterThan(positionsForSlot("PG").length);
  });

  it("serializes and parses pool filters", () => {
    expect(serializeFilter({ kind: "all" })).toBe("all");
    expect(serializeFilter({ kind: "current" })).toBe("current");
    expect(parseFilter("classic")).toEqual({ kind: "classic" });
    expect(parseFilter("current")).toEqual({ kind: "current" });
    expect(parseFilter("league:EAST")).toEqual({ kind: "league", league: "EAST" });
    expect(parseFilter("classic_league:WEST")).toEqual({ kind: "classic_league", league: "WEST" });
    expect(parseFilter("league:LA_LIGA")).toEqual({ kind: "all" });
    expect(parseFilter("club:nba_bos")).toEqual({ kind: "club", teamId: "nba_bos" });
  });

  it("filters teams by conference / classic / club", () => {
    const east = team({ id: "nba_bos", conference: "EAST", league: "EAST", teamType: "CURRENT_TEAM" });
    const classic = team({ id: "classic_x", teamType: "HISTORIC_TEAM", conference: "WEST" });
    expect(teamMatchesFilter(east, { kind: "league", league: "EAST" })).toBe(true);
    expect(teamMatchesFilter(east, { kind: "league", league: "WEST" })).toBe(false);
    expect(teamMatchesFilter(east, { kind: "current" })).toBe(true);
    expect(teamMatchesFilter(classic, { kind: "current" })).toBe(false);
    expect(teamMatchesFilter(classic, { kind: "classic" })).toBe(true);
    expect(teamMatchesFilter(classic, { kind: "classic_league", league: "WEST" })).toBe(true);
    expect(teamMatchesFilter(classic, { kind: "classic_league", league: "EAST" })).toBe(false);
    expect(teamMatchesFilter(east, { kind: "club", teamId: "nba_bos" })).toBe(true);
    expect(teamMatchesFilter(team({ id: "miteam_user", teamType: "CUSTOM_TEAM", custom: true }), { kind: "all" })).toBe(
      false,
    );
  });

  it("excludes already-owned identity variants from pack pulls", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const phi = "classic_phi_1982_83_p05";
    const atl = "classic_atl_1990_91_p05";
    expect(db.players.has(phi)).toBe(true);
    expect(db.players.has(atl)).toBe(true);
    expect(playerIdentityKey(db.players.get(phi)!)).toBe(playerIdentityKey(db.players.get(atl)!));

    const pool = poolCandidates(db, {
      slot: "C",
      filter: { kind: "classic" },
      excludePlayerIds: new Set([phi]),
    });
    expect(pool.some((sp) => sp.player.id === atl || sp.player.id === phi)).toBe(false);

    for (let i = 0; i < 24; i++) {
      const pick = pickRandomForSlot(db, {
        slot: "C",
        filter: { kind: "classic" },
        excludePlayerIds: new Set([phi]),
      });
      expect(pick?.player.id).not.toBe(phi);
      expect(pick?.player.id).not.toBe(atl);
    }
  });

  it("labels classic clubs with eras so repeats stay distinct", () => {
    const a = team({
      id: "classic_chi_1995_96",
      name: "Chicago Bulls — 1995/96",
      teamType: "HISTORIC_TEAM",
      historicSeason: "1995/96",
    });
    const b = team({
      id: "classic_chi_1997_98",
      name: "Chicago Bulls — 1997/98",
      teamType: "HISTORIC_TEAM",
      historicSeason: "1997/98",
    });
    const current = team({
      id: "nba_chi",
      name: "Chicago Bulls",
      teamType: "CURRENT_TEAM",
      conference: "EAST",
      league: "EAST",
    });
    expect(clubFilterLabel(a)).toBe("Chicago Bulls 95-96");
    expect(clubFilterLabel(b)).toBe("Chicago Bulls 97-98");
    expect(clubFilterLabel(current)).toBe("Chicago Bulls");
  });
});
