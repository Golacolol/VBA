import { describe, expect, it, beforeEach } from "vitest";
import { SaveManager, MITEAM_TEAM_ID, MITEAM_DEFAULT_CLUB_NAME } from "../../core/SaveManager";
import {
  applyMiTeamToDb,
  deleteMiTeam,
  ensureMiTeamSave,
  miteamFillOrder,
  nextEmptySlot,
  miTeamIdentityCustomized,
  placeMiTeamPlayerOnSlot,
  resolveMiTeamPlayerDisplay,
  restartMiTeam,
  setMiTeamBadge,
  setMiTeamColors,
  setMiTeamClubName,
  setMiTeamRoster,
  xiComplete,
} from "./MiTeam";
import type { GameDatabase } from "../../core/Database";
import type { PlayerRecord, TeamRecord } from "../../data/schema";

const memory = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memory.set(k, String(v));
  },
  removeItem: (k: string) => {
    memory.delete(k);
  },
  clear: () => memory.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true });

function stubDb(): GameDatabase {
  const players = new Map<string, PlayerRecord>();
  const teams = new Map<string, TeamRecord>();
  const addPlayer = (id: string, pos: PlayerRecord["primaryPosition"] = "SG") => {
    players.set(id, {
      id,
      name: id,
      displayName: id,
      primaryPosition: pos,
      secondaryPositions: [],
      overall: 75,
      finishing: 70,
      midRange: 70,
      threePoint: 70,
      freeThrow: 70,
      ballHandle: 70,
      passAccuracy: 70,
      perimeterD: 70,
      interiorD: 70,
      rebound: 70,
      steal: 70,
      block: 70,
      speed: 70,
      vertical: 70,
      strength: 70,
      stamina: 70,
      iq: 70,
      clutch: 70,
    });
  };
  const positions: PlayerRecord["primaryPosition"][] = ["PG", "SG", "SF", "PF", "C"];
  for (let i = 1; i <= 18; i++) addPlayer(`p${i}`, positions[(i - 1) % positions.length]!);
  const memberships: GameDatabase["memberships"] = [];
  const lineups: GameDatabase["lineups"] = [];
  const db = {
    players,
    teams,
    memberships,
    lineups,
    userTeamId: "plymouth_argyle_current",
    getTeam(teamId: string) {
      const t = teams.get(teamId);
      if (!t) throw new Error(`missing team ${teamId}`);
      return t;
    },
    getSquad(teamId: string) {
      return memberships
        .filter((m) => m.teamId === teamId)
        .map((m) => {
          const player = players.get(m.playerId)!;
          return {
            player,
            membership: m,
            attrs: player,
            overall: player.overall ?? 70,
            shirtNumber: m.shirtNumber,
          };
        });
    },
  } as unknown as GameDatabase;
  return db;
}

describe("MiTeam save / shell", () => {
  let save: SaveManager;
  let db: GameDatabase;

  beforeEach(() => {
    localStorage.clear();
    save = new SaveManager();
    db = stubDb();
  });

  it("creates default save and prefers PG first in fill order", () => {
    const mt = ensureMiTeamSave(save);
    expect(mt.clubName).toBe(MITEAM_DEFAULT_CLUB_NAME);
    expect(mt.roster).toEqual([]);
    expect(miteamFillOrder()[0]).toBe("PG");
    expect(miteamFillOrder().slice(0, 5)).toEqual(["PG", "SG", "SF", "PF", "C"]);
    expect(nextEmptySlot([])).toBe("PG");
  });

  it("applies roster into DB memberships and lineup", () => {
    ensureMiTeamSave(save);
    const slots = miteamFillOrder().slice(0, 5);
    setMiTeamRoster(
      save,
      db,
      slots.map((slot, i) => ({ playerId: `p${i + 1}`, slot, shirtNumber: i + 1 })),
    );
    expect(xiComplete(save.data.miteam!.roster)).toBe(true);
    expect(db.teams.has(MITEAM_TEAM_ID)).toBe(true);
    expect(db.memberships.filter((m) => m.teamId === MITEAM_TEAM_ID)).toHaveLength(5);
    const lineup = db.lineups.find((l) => l.teamId === MITEAM_TEAM_ID);
    expect(lineup?.starters).toHaveLength(5);
    expect(lineup?.formation).toBe("BASKETBALL_5");
  });

  it("restart clears roster but keeps club name and badge; delete removes shell", () => {
    ensureMiTeamSave(save);
    save.data.miteam!.clubName = "Silver City";
    setMiTeamBadge(save, db, "/assets/emblems/nba_bos.svg");
    setMiTeamRoster(save, db, [{ playerId: "p1", slot: "PG", shirtNumber: 1 }]);
    restartMiTeam(save);
    applyMiTeamToDb(db, save);
    expect(save.data.miteam!.clubName).toBe("Silver City");
    expect(save.data.miteam!.badgeAsset).toBe("/assets/emblems/nba_bos.svg");
    expect(save.data.miteam!.roster).toEqual([]);
    expect(db.teams.get(MITEAM_TEAM_ID)?.badgeAsset).toBe("/assets/emblems/nba_bos.svg");
    deleteMiTeam(save, db);
    expect(save.data.miteam).toBeNull();
    expect(db.teams.has(MITEAM_TEAM_ID)).toBe(false);
  });

  it("round-trips miteam through SaveManager load", () => {
    ensureMiTeamSave(save);
    setMiTeamRoster(save, db, [{ playerId: "p1", slot: "PG", shirtNumber: 1 }]);
    save.save();
    const again = new SaveManager();
    expect(again.data.miteam?.roster).toHaveLength(1);
    expect(again.data.miteam?.roster[0]?.slot).toBe("PG");
  });

  it("swaps a bench player onto adjacent court slots only", () => {
    const roster = [
      { playerId: "p1", slot: "PG", shirtNumber: 1 },
      { playerId: "p2", slot: "SG", shirtNumber: 8 },
      { playerId: "p3", slot: "BENCH_1", shirtNumber: 12 }, // SF
    ];
    const pos = (id: string) => db.players.get(id)?.primaryPosition ?? null;

    // SF may occupy SG (neighbor band).
    const swapped = placeMiTeamPlayerOnSlot(roster, "p3", "SG", pos);
    expect(swapped?.find((r) => r.playerId === "p3")?.slot).toBe("SG");
    expect(swapped?.find((r) => r.playerId === "p2")?.slot).toBe("BENCH_1");
    // SF may not occupy PG (only PG/SG).
    expect(placeMiTeamPlayerOnSlot(roster, "p3", "PG", pos)).toBeNull();
    // SG may occupy PG.
    const ontoPg = placeMiTeamPlayerOnSlot(
      [
        { playerId: "p1", slot: "PG", shirtNumber: 1 },
        { playerId: "p2", slot: "BENCH_1", shirtNumber: 8 },
      ],
      "p2",
      "PG",
      pos,
    );
    expect(ontoPg?.find((r) => r.playerId === "p2")?.slot).toBe("PG");
  });

  it("uses origin club looks until MiTeam identity is customized", () => {
    const mt = ensureMiTeamSave(save);
    db.teams.set("origin_club", {
      id: "origin_club",
      name: "Origin FC",
      abbreviation: "ORI",
      teamType: "CURRENT_TEAM",
      city: "Origin",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      badgeAsset: "/assets/crests/origin.png",
      defaultKit: { shirt: "#112233", shorts: "#fff", socks: "#112233" },
      awayKit: { shirt: "#445566", shorts: "#112233", socks: "#445566" },
      goalkeeperKit: { shirt: "#C9A227", shorts: "#445566", socks: "#C9A227" },
      defaultStadiumId: "vortex_arena",
      defaultFormation: "BASKETBALL_5",
    } as import("../../data/schema").TeamRecord);
    db.memberships.push({
      playerId: "p2",
      teamId: "origin_club",
      shirtNumber: 8,
      squadRole: "FIRST_TEAM",
    });
    setMiTeamRoster(save, db, [{ playerId: "p2", slot: "LCM", shirtNumber: 8, sourceTeamId: "origin_club" }]);
    expect(miTeamIdentityCustomized(mt)).toBe(false);
    const look = resolveMiTeamPlayerDisplay(db, mt, "p2", "origin_club");
    expect(look.teamColor).toBe("#112233");
    expect(look.teamName).toBe("Origin FC");

    setMiTeamClubName(save, db, "Silver City");
    expect(miTeamIdentityCustomized(save.data.miteam)).toBe(true);
    const shellLook = resolveMiTeamPlayerDisplay(db, save.data.miteam!, "p2", "origin_club");
    expect(shellLook.teamName).toBe("Silver City");
    setMiTeamColors(save, db, { primaryColor: null, secondaryColor: null });
  });
});
