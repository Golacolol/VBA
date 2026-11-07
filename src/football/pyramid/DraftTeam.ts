/**
 * Persist a completed Pyramid Draft seat as a User club (alongside MiTeam).
 * The Draft shell always sits in Team Select. Incomplete rosters open Pyramid Draft
 * from Play Next Fixture; a completed seat uses the normal Formation panel.
 */
import type { LineupRecord, TeamMembership, TeamRecord } from "../../data/schema";
import type { GameDatabase } from "../../core/Database";
import {
  DRAFT_DEFAULT_BADGE,
  DRAFT_DEFAULT_CLUB_NAME,
  DRAFT_DEFAULT_PRIMARY,
  DRAFT_DEFAULT_SECONDARY,
  DRAFT_LINEUP_ID,
  DRAFT_TEAM_ID,
  MITEAM_FORMATION,
  type MiTeamRosterSlot,
  type MiTeamSave,
  type SaveManager,
} from "../../core/SaveManager";
import { DEFAULT_TEAM_ID } from "../constants";
import { miteamFillOrder, miteamXiSlots } from "../miteam/MiTeam";
import { DRAFT_ROSTER_SIZE, type DraftSeat } from "./draft";

export function draftTeamShell(
  clubName: string,
  badgeAsset?: string | null,
): TeamRecord {
  const name = clubName.trim() || DRAFT_DEFAULT_CLUB_NAME;
  const crest = badgeAsset?.trim() || DRAFT_DEFAULT_BADGE;
  const primary = DRAFT_DEFAULT_PRIMARY;
  const secondary = DRAFT_DEFAULT_SECONDARY;
  return {
    id: DRAFT_TEAM_ID,
    name,
    abbreviation: abbreviate(name),
    teamType: "CUSTOM_TEAM",
    custom: true,
    city: "User",
    primaryColor: primary,
    secondaryColor: secondary,
    badgeAsset: crest,
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
    historicSeason: "Draft",
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

export function removeDraftTeamFromDb(db: GameDatabase): void {
  db.teams.delete(DRAFT_TEAM_ID);
  db.memberships = db.memberships.filter((m) => m.teamId !== DRAFT_TEAM_ID);
  db.lineups = db.lineups.filter((l) => l.teamId !== DRAFT_TEAM_ID);
  if (db.userTeamId === DRAFT_TEAM_ID) db.userTeamId = DEFAULT_TEAM_ID;
}

/**
 * Always register the Draft User club in the DB so it appears on the Team dial.
 * Memberships / lineup only fill when a completed seat has been saved.
 */
export function applyDraftTeamToDb(db: GameDatabase, save: SaveManager): void {
  const dt = save.data.draftTeam;
  const shell = draftTeamShell(
    dt?.clubName ?? DRAFT_DEFAULT_CLUB_NAME,
    dt?.badgeAsset ?? DRAFT_DEFAULT_BADGE,
  );
  db.teams.set(DRAFT_TEAM_ID, shell);

  const memberships: TeamMembership[] = [];
  const starters: LineupRecord["starters"] = [];
  const xiSlots = new Set(miteamXiSlots(MITEAM_FORMATION));
  const usedShirts = new Set<number>();
  const roster = draftTeamComplete(save) ? dt!.roster : [];

  for (const row of roster) {
    if (!db.players.has(row.playerId)) continue;
    let shirt = Math.max(1, Math.min(99, Math.round(row.shirtNumber)));
    while (usedShirts.has(shirt)) shirt = (shirt % 99) + 1;
    usedShirts.add(shirt);
    const isXi = xiSlots.has(row.slot);
    memberships.push({
      playerId: row.playerId,
      teamId: DRAFT_TEAM_ID,
      shirtNumber: shirt,
      squadRole: isXi ? "FIRST_TEAM" : "BENCH",
    });
    if (isXi) starters.push({ playerId: row.playerId, slot: row.slot });
  }

  db.memberships = db.memberships.filter((m) => m.teamId !== DRAFT_TEAM_ID).concat(memberships);
  db.lineups = db.lineups
    .filter((l) => l.teamId !== DRAFT_TEAM_ID)
    .concat({
      id: DRAFT_LINEUP_ID,
      teamId: DRAFT_TEAM_ID,
      formation: MITEAM_FORMATION,
      starters,
    });
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
