import { beforeEach, describe, expect, it } from "vitest";
import type { GameDatabase } from "../../core/Database";
import type { PlayerRecord, TeamRecord } from "../../data/schema";
import { DRAFT_TEAM_ID, draftCpuTeamId, SaveManager } from "../../core/SaveManager";
import {
  applyDraftTeamToDb,
  draftFamilyTeamComplete,
  draftTeamComplete,
  ensureDraftUserTeam,
  saveDraftSeatAsUserTeam,
} from "./DraftTeam";
import { DRAFT_ROSTER_SIZE, createDraftSeat, draftSlots, defaultDraftSave } from "./draft";
import { buildMenuTeamOptions, erasForClub, uniqueClubsInGroup } from "../../ui/menuTeamSelect";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, String(v)),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
  },
  configurable: true,
});

function stubDb(): GameDatabase {
  const players = new Map<string, PlayerRecord>();
  const teams = new Map<string, TeamRecord>();
  const positions: PlayerRecord["primaryPosition"][] = ["PG", "SG", "SF", "PF", "C"];
  for (let i = 1; i <= DRAFT_ROSTER_SIZE; i++) {
    const pos = positions[(i - 1) % positions.length]!;
    players.set(`p${i}`, {
      id: `p${i}`,
      name: `P${i}`,
      displayName: `Player ${i}`,
      primaryPosition: pos,
      secondaryPositions: [],
      overall: 80,
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
  }
  const db = {
    players,
    teams,
    memberships: [] as GameDatabase["memberships"],
    lineups: [] as GameDatabase["lineups"],
    userTeamId: "nba_bos",
    getTeam(teamId: string) {
      const t = teams.get(teamId);
      if (!t) throw new Error(`missing team ${teamId}`);
      return t;
    },
    getSquad(teamId: string) {
      return db.memberships
        .filter((m) => m.teamId === teamId)
        .map((m) => {
          const player = players.get(m.playerId)!;
          return { player, membership: m, attrs: player, overall: player.overall ?? 70, shirtNumber: m.shirtNumber };
        });
    },
  };
  return db as unknown as GameDatabase;
}

function fullRoster() {
  return draftSlots().map((slot, i) => ({
    playerId: `p${i + 1}`,
    slot,
    shirtNumber: i + 1,
    sourceTeamId: null as string | null,
  }));
}

describe("DraftTeam", () => {
  let save: SaveManager;
  let db: GameDatabase;

  beforeEach(() => {
    memory.clear();
    save = new SaveManager();
    db = stubDb();
  });

  it("always registers a Draft shell for Team Select even without a roster", () => {
    save.data.draftTeam = null;
    applyDraftTeamToDb(db, save);
    expect(db.teams.has(DRAFT_TEAM_ID)).toBe(true);
    expect(db.getTeam(DRAFT_TEAM_ID).name).toBe("Draft");
    expect(db.getTeam(DRAFT_TEAM_ID).historicSeason).toBe("User");
    expect(draftTeamComplete(save)).toBe(false);
    expect(db.getSquad(DRAFT_TEAM_ID)).toHaveLength(0);
  });

  it("registers User + CPU seats on the Draft Era dial", () => {
    save.data.draftTeam = null;
    applyDraftTeamToDb(db, save);
    const options = buildMenuTeamOptions([...db.teams.values()]);
    expect(uniqueClubsInGroup(options, "USER").some((o) => o.id === DRAFT_TEAM_ID)).toBe(true);
    const eras = erasForClub(options, DRAFT_TEAM_ID);
    expect(eras[0]).toMatchObject({ id: DRAFT_TEAM_ID, eraLabel: "User" });
    expect(eras.slice(1).every((e) => e.eraLabel.startsWith("CPU"))).toBe(true);
    expect(eras.map((e) => e.label).every((l) => l === "Draft")).toBe(true);
  });

  it("fills CPU seat rosters from a completed Pyramid board", () => {
    const draft = defaultDraftSave(3);
    draft.status = "done";
    draft.seats[0]!.kind = "human";
    draft.seats[0]!.roster = fullRoster();
    draft.seats[1]!.roster = fullRoster();
    draft.seats[2]!.roster = fullRoster();
    save.data.pyramid = {
      size: 50,
      order: [],
      pool: [],
      view: "draft",
      seedVersion: 1,
      draft,
    };
    expect(ensureDraftUserTeam(save, db)).toBe(true);
    const cpu2 = draftCpuTeamId(1);
    expect(draftFamilyTeamComplete(db, cpu2)).toBe(true);
    expect(db.getSquad(cpu2)).toHaveLength(DRAFT_ROSTER_SIZE);
    expect(db.getTeam(cpu2).historicSeason).toBe("CPU 2");
  });

  it("saves a completed seat onto the Draft User club", () => {
    const seat = createDraftSeat(0, "human");
    seat.roster = fullRoster();
    const saved = saveDraftSeatAsUserTeam(save, db, seat);
    expect(saved?.roster).toHaveLength(DRAFT_ROSTER_SIZE);
    expect(draftTeamComplete(save)).toBe(true);
    expect(db.getSquad(DRAFT_TEAM_ID)).toHaveLength(DRAFT_ROSTER_SIZE);
    expect(db.lineups.find((l) => l.teamId === DRAFT_TEAM_ID)?.starters).toHaveLength(5);
  });

  it("promotes a finished Pyramid human seat so Play Next skips the draft board", () => {
    save.data.draftTeam = null;
    const draft = defaultDraftSave(2);
    draft.status = "done";
    draft.pickIndex = DRAFT_ROSTER_SIZE * 2;
    draft.seats[0]!.kind = "human";
    draft.seats[0]!.roster = fullRoster();
    save.data.pyramid = {
      size: 50,
      order: [],
      pool: [],
      view: "draft",
      seedVersion: 1,
      draft,
    };
    expect(ensureDraftUserTeam(save, db)).toBe(true);
    expect(draftTeamComplete(save)).toBe(true);
    expect(db.getSquad(DRAFT_TEAM_ID)).toHaveLength(DRAFT_ROSTER_SIZE);
  });
});
