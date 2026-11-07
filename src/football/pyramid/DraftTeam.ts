/**
 * Persist Pyramid Draft seats as User-group clubs for Team Select.
 * The Draft shell always sits on the Team dial; Era rolls User first, then CPU seats.
 * Incomplete User seats open Pyramid Draft from Play Next Fixture; completed seats
 * use the normal Formation panel.
 */
import type { LineupRecord, TeamMembership, TeamRecord } from "../../data/schema";
import type { GameDatabase } from "../../core/Database";
import {
  DRAFT_CPU_ID_PREFIX,
  DRAFT_DEFAULT_BADGE,
  DRAFT_DEFAULT_CLUB_NAME,
  DRAFT_DEFAULT_PRIMARY,
  DRAFT_DEFAULT_SECONDARY,
  DRAFT_LINEUP_ID,
  DRAFT_TEAM_ID,
  draftCpuTeamId,
  isDraftFamilyTeamId,
  MITEAM_FORMATION,
  type MiTeamRosterSlot,
  type MiTeamSave,
  type SaveManager,
} from "../../core/SaveManager";
import { DEFAULT_TEAM_ID } from "../constants";
import { miteamFillOrder, miteamXiSlots } from "../miteam/MiTeam";
import {
  DRAFT_ROSTER_SIZE,
  defaultDraftSave,
  normalizeDraftSave,
  type DraftSave,
  type DraftSeat,
} from "./draft";

/** Prefer a full human seat; otherwise any full seat once the board is done. */
export function completedDraftSeat(draft: DraftSave | null | undefined): DraftSeat | null {
  if (!draft?.seats?.length) return null;
  const full = draft.seats.filter((s) => s.roster.length >= DRAFT_ROSTER_SIZE);
  if (!full.length) return null;
  const human = full.find((s) => s.kind === "human");
  if (human) return human;
  if (draft.status !== "done") return null;
  return full[0] ?? null;
}

/**
 * True when the User Draft club is playable — either already saved, or a finished
 * Pyramid Draft seat can be promoted (no need to press START AS TEAM first).
 */
export function ensureDraftUserTeam(save: SaveManager, db: GameDatabase): boolean {
  if (draftTeamComplete(save)) {
    applyDraftTeamToDb(db, save);
    return true;
  }
  const seat = completedDraftSeat(save.data.pyramid?.draft);
  if (!seat) {
    applyDraftTeamToDb(db, save);
    return false;
  }
  return !!saveDraftSeatAsUserTeam(save, db, seat);
}

/** Seats driving the Draft Era dial (lobby defaults if Pyramid Draft not opened yet). */
export function draftSeatsForMenu(save: SaveManager): DraftSeat[] {
  const raw = save.data.pyramid?.draft;
  if (raw) return normalizeDraftSave(raw).seats;
  return defaultDraftSave().seats;
}

export function teamIdForDraftSeat(seat: DraftSeat, seatIndex: number): string {
  return seat.kind === "human" ? DRAFT_TEAM_ID : draftCpuTeamId(seatIndex);
}

export function draftTeamShell(
  clubName: string,
  badgeAsset?: string | null,
  opts?: { id?: string; historicSeason?: string },
): TeamRecord {
  const name = clubName.trim() || DRAFT_DEFAULT_CLUB_NAME;
  const crest = badgeAsset?.trim() || DRAFT_DEFAULT_BADGE;
  const primary = DRAFT_DEFAULT_PRIMARY;
  const secondary = DRAFT_DEFAULT_SECONDARY;
  const id = opts?.id ?? DRAFT_TEAM_ID;
  return {
    id,
    name: DRAFT_DEFAULT_CLUB_NAME,
    abbreviation: abbreviate(name),
    teamType: "CUSTOM_TEAM",
    custom: true,
    city: "User",
    primaryColor: primary,
    secondaryColor: secondary,
    badgeAsset: crest,
    franchiseId: DRAFT_TEAM_ID,
    defaultKit: {
      shirt: primary,
      shorts: secondary,
      socks: primary,
      trim: secondary,
      numberColor: secondary,
    },
    awayKit: {
      shirt: secondary,
      shorts: primary,
      socks: secondary,
      trim: primary,
      numberColor: primary,
    },
    goalkeeperKit: {
      shirt: "#C9A227",
      shorts: secondary,
      socks: "#C9A227",
      trim: secondary,
      numberColor: secondary,
    },
    defaultStadiumId: "vortex_arena",
    defaultFormation: MITEAM_FORMATION,
    historicSeason: opts?.historicSeason ?? "User",
  };
}

function abbreviate(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  return (letters + "DFT").slice(0, 3);
}

export function draftTeamComplete(save: SaveManager): boolean {
  return (save.data.draftTeam?.roster.length ?? 0) >= DRAFT_ROSTER_SIZE;
}

export function draftFamilyTeamComplete(db: GameDatabase, teamId: string): boolean {
  if (!isDraftFamilyTeamId(teamId)) return false;
  return db.getSquad(teamId).length >= DRAFT_ROSTER_SIZE;
}

function clearDraftFamilyFromDb(db: GameDatabase): void {
  const drop = new Set(
    [...db.teams.keys()].filter((id) => isDraftFamilyTeamId(id)),
  );
  for (const id of drop) db.teams.delete(id);
  db.memberships = db.memberships.filter((m) => !drop.has(m.teamId));
  db.lineups = db.lineups.filter((l) => !drop.has(l.teamId));
  if (drop.has(db.userTeamId)) db.userTeamId = DEFAULT_TEAM_ID;
}

function applySeatRosterToDb(
  db: GameDatabase,
  teamId: string,
  roster: readonly MiTeamRosterSlot[],
): void {
  const memberships: TeamMembership[] = [];
  const starters: LineupRecord["starters"] = [];
  const xiSlots = new Set(miteamXiSlots(MITEAM_FORMATION));
  const usedShirts = new Set<number>();

  for (const row of roster) {
    if (!db.players.has(row.playerId)) continue;
    let shirt = Math.max(1, Math.min(99, Math.round(row.shirtNumber)));
    while (usedShirts.has(shirt)) shirt = (shirt % 99) + 1;
    usedShirts.add(shirt);
    const isXi = xiSlots.has(row.slot);
    memberships.push({
      playerId: row.playerId,
      teamId,
      shirtNumber: shirt,
      squadRole: isXi ? "FIRST_TEAM" : "BENCH",
    });
    if (isXi) starters.push({ playerId: row.playerId, slot: row.slot });
  }

  db.memberships = db.memberships.filter((m) => m.teamId !== teamId).concat(memberships);
  db.lineups = db.lineups
    .filter((l) => l.teamId !== teamId)
    .concat({
      id: teamId === DRAFT_TEAM_ID ? DRAFT_LINEUP_ID : `${teamId}_lineup`,
      teamId,
      formation: MITEAM_FORMATION,
      starters,
    });
}

/**
 * Register Draft + CPU seats on the Team / Era dials.
 * Memberships fill for completed seats (User from draftTeam, CPUs from Pyramid seats).
 */
export function applyDraftTeamToDb(db: GameDatabase, save: SaveManager): void {
  clearDraftFamilyFromDb(db);
  const seats = draftSeatsForMenu(save);
  const dt = save.data.draftTeam;

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]!;
    const teamId = teamIdForDraftSeat(seat, i);
    const era =
      seat.kind === "human"
        ? "User"
        : seat.name.trim() || `CPU ${i + 1}`;
    const shell = draftTeamShell(
      DRAFT_DEFAULT_CLUB_NAME,
      dt?.badgeAsset ?? DRAFT_DEFAULT_BADGE,
      { id: teamId, historicSeason: era },
    );
    if (teamId === DRAFT_TEAM_ID && dt?.clubName?.trim()) {
      shell.abbreviation = abbreviate(dt.clubName);
    }
    db.teams.set(teamId, shell);

    let roster: MiTeamRosterSlot[] = [];
    if (teamId === DRAFT_TEAM_ID && draftTeamComplete(save)) {
      roster = dt!.roster;
    } else if (seat.roster.length >= DRAFT_ROSTER_SIZE) {
      roster = seat.roster.map((r) => ({
        playerId: r.playerId,
        slot: r.slot,
        shirtNumber: r.shirtNumber,
        sourceTeamId: r.sourceTeamId ?? null,
      }));
    }
    applySeatRosterToDb(db, teamId, roster);
  }

  // Ensure User shell exists even if seats somehow empty.
  if (!db.teams.has(DRAFT_TEAM_ID)) {
    db.teams.set(
      DRAFT_TEAM_ID,
      draftTeamShell(dt?.clubName ?? DRAFT_DEFAULT_CLUB_NAME, dt?.badgeAsset ?? DRAFT_DEFAULT_BADGE),
    );
    applySeatRosterToDb(db, DRAFT_TEAM_ID, draftTeamComplete(save) ? dt!.roster : []);
  }
}

/** Snapshot a completed draft seat into the User "Draft" club. */
export function saveDraftSeatAsUserTeam(
  save: SaveManager,
  db: GameDatabase,
  seat: DraftSeat,
  opts?: { clubName?: string },
): MiTeamSave | null {
  if (seat.roster.length < DRAFT_ROSTER_SIZE) return null;
  const order = new Set(miteamFillOrder());
  const roster: MiTeamRosterSlot[] = seat.roster
    .filter((r) => order.has(r.slot) && db.players.has(r.playerId))
    .map((r) => ({
      playerId: r.playerId,
      slot: r.slot,
      shirtNumber: Math.max(1, Math.min(99, Math.round(r.shirtNumber))),
      sourceTeamId: r.sourceTeamId ?? null,
    }));
  if (roster.length < DRAFT_ROSTER_SIZE) return null;
  const rawName = (opts?.clubName ?? seat.name)?.trim() || DRAFT_DEFAULT_CLUB_NAME;
  const clubName = rawName === "You" ? DRAFT_DEFAULT_CLUB_NAME : rawName;
  const next: MiTeamSave = {
    teamId: DRAFT_TEAM_ID,
    clubName,
    badgeAsset: DRAFT_DEFAULT_BADGE,
    primaryColor: DRAFT_DEFAULT_PRIMARY,
    secondaryColor: DRAFT_DEFAULT_SECONDARY,
    roster,
    nextFixtureId: null,
  };
  save.data.draftTeam = next;
  save.save();
  applyDraftTeamToDb(db, save);
  return next;
}

export { DRAFT_CPU_ID_PREFIX, draftCpuTeamId, isDraftFamilyTeamId };
