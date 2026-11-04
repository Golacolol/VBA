import type { PositionCode, TeamRecord } from "../../data/schema";
import type { GameDatabase, SquadPlayer } from "../../core/Database";
import { isClassicMenuTeam } from "../../core/Database";
import { MITEAM_TEAM_ID } from "../../core/SaveManager";
import { conferenceForTeam } from "../league/Standings";
import {
  clubBaseName,
  classicClubIdentity,
  eraFromTeam,
  formatEraRoll,
} from "../../ui/menuTeamSelect";

export type MiTeamPoolFilter =
  | { kind: "all" }
  | { kind: "current" }
  | { kind: "league"; league: "EAST" | "WEST" }
  | { kind: "classic" }
  | { kind: "classic_league"; league: "EAST" | "WEST" }
  | { kind: "club"; teamId: string };

export const MITEAM_FILTER_LEAGUES = ["EAST", "WEST"] as const;

export const MITEAM_FILTER_LEAGUE_LABEL: Record<(typeof MITEAM_FILTER_LEAGUES)[number], string> = {
  EAST: "East",
  WEST: "West",
};

/** Line role for a formation slot — keeps packs inside Guard / Wing / Big. */
export type MiTeamSlotRole = "GUARD" | "WING" | "BIG";

/** Substitute packs (BENCH_1…) once the starting five is filled. */
export function isMiTeamBenchSlot(slot: string): boolean {
  return /^BENCH_\d+$/i.test(slot.trim());
}

/** Every basketball position a substitute pack may pull. */
export function allMiTeamPackPositions(): PositionCode[] {
  return ["PG", "SG", "SF", "PF", "C"];
}

export function slotPackRole(slot: string): MiTeamSlotRole {
  const s = slot.toUpperCase();
  if (s === "PG" || s === "SG") return "GUARD";
  if (s === "SF") return "WING";
  if (s === "PF" || s === "C") return "BIG";
  // Legacy football codes → nearest basketball line
  if (["RB", "RWB", "LB", "LWB", "RCB", "LCB", "CB", "GK"].includes(s)) return "BIG";
  if (["RST", "LST", "ST", "RW", "LW"].includes(s)) return "WING";
  return "GUARD";
}

/**
 * All position codes allowed when broadening within a line.
 * Kept in sync with the neighbor bands on positionsForSlot (SG includes SF, PF includes SF).
 */
export function positionsForRole(role: MiTeamSlotRole): PositionCode[] {
  if (role === "GUARD") return ["PG", "SG", "SF"];
  if (role === "WING") return ["SG", "SF", "PF"];
  return ["SF", "PF", "C"];
}

/**
 * Map formation slot ids to pack / placement positions.
 * Each court slot takes its own position plus adjacent ones on the 1–5 line:
 *   PG → PG, SG
 *   SG → PG, SG, SF
 *   SF → SG, SF, PF
 *   PF → SF, PF, C
 *   C  → PF, C
 * Bench slots pull from every basketball position.
 */
export function positionsForSlot(slot: string): PositionCode[] {
  const s = slot.toUpperCase();
  if (isMiTeamBenchSlot(s)) return allMiTeamPackPositions();
  if (s === "PG") return ["PG", "SG"];
  if (s === "SG") return ["PG", "SG", "SF"];
  if (s === "SF") return ["SG", "SF", "PF"];
  if (s === "PF") return ["SF", "PF", "C"];
  if (s === "C") return ["PF", "C"];
  // Unknown XI slot — any basketball position (never empty / football-only).
  return allMiTeamPackPositions();
}

/** True when a player's primary (or listed) position may occupy this MiTeam slot. */
export function positionFitsMiTeamSlot(
  slot: string,
  primaryPosition: string | null | undefined,
): boolean {
  if (!primaryPosition) return false;
  if (isMiTeamBenchSlot(slot)) return true;
  const pos = primaryPosition.toUpperCase() as PositionCode;
  return positionsForSlot(slot).includes(pos);
}

export function teamMatchesFilter(team: TeamRecord, filter: MiTeamPoolFilter): boolean {
  if (team.id === MITEAM_TEAM_ID) return false;
  if (filter.kind === "all") return true;
  if (filter.kind === "club") return team.id === filter.teamId;
  if (filter.kind === "current") return team.teamType === "CURRENT_TEAM";
  if (filter.kind === "classic") return isClassicMenuTeam(team);
  if (filter.kind === "classic_league") {
    return isClassicMenuTeam(team) && conferenceForTeam(team) === filter.league;
  }
  if (team.teamType !== "CURRENT_TEAM") return false;
  return conferenceForTeam(team) === filter.league;
}

/**
 * Collapse classic / current variants of the same person (e.g. Moses Malone
 * on Sixers + Hawks) so packs and drafts treat them as one card.
 */
export function playerIdentityKey(player: {
  id: string;
  name?: string;
  displayName?: string;
  appearance?: { fullName?: string | null } | null;
}): string {
  const raw =
    player.appearance?.fullName?.trim() ||
    player.displayName?.trim() ||
    player.name?.trim() ||
    player.id;
  return raw.toLowerCase().replace(/\s+/g, " ");
}

/** Identity keys for a set of player ids (covers all id variants of that name). */
export function identityKeysForPlayerIds(db: GameDatabase, ids: ReadonlySet<string>): Set<string> {
  const keys = new Set<string>();
  for (const id of ids) {
    const player = db.players.get(id);
    keys.add(player ? playerIdentityKey(player) : id);
  }
  return keys;
}

export function poolCandidates(
  db: GameDatabase,
  options: {
    slot: string;
    filter: MiTeamPoolFilter;
    excludePlayerIds?: ReadonlySet<string>;
    /** When set, use this position list instead of positionsForSlot(slot). */
    positions?: readonly PositionCode[];
    /** Prefer primary-position matches (default true). */
    primaryOnly?: boolean;
  },
): SquadPlayer[] {
  const wanted = new Set(options.positions ?? positionsForSlot(options.slot));
  const primaryOnly = options.primaryOnly !== false;
  const exclude = options.excludePlayerIds ?? new Set<string>();
  const excludeKeys = identityKeysForPlayerIds(db, exclude);
  const primaryHits: SquadPlayer[] = [];
  const secondaryHits: SquadPlayer[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  for (const team of db.teams.values()) {
    if (!teamMatchesFilter(team, options.filter)) continue;
    for (const sp of db.getSquad(team.id)) {
      const key = playerIdentityKey(sp.player);
      if (exclude.has(sp.player.id) || excludeKeys.has(key) || seenIds.has(sp.player.id) || seenKeys.has(key)) {
        continue;
      }
      const pos = sp.player.primaryPosition;
      const secondary = sp.player.secondaryPositions ?? [];
      if (wanted.has(pos)) {
        seenIds.add(sp.player.id);
        seenKeys.add(key);
        primaryHits.push(sp);
        continue;
      }
      if (!primaryOnly && secondary.some((p) => wanted.has(p))) {
        seenIds.add(sp.player.id);
        seenKeys.add(key);
        secondaryHits.push(sp);
      }
    }
  }
  return primaryHits.length ? primaryHits : secondaryHits;
}

export function pickRandomForSlot(
  db: GameDatabase,
  options: { slot: string; filter: MiTeamPoolFilter; excludePlayerIds?: ReadonlySet<string> },
): SquadPlayer | null {
  // 1) Slot neighbor band (primary only).
  let pool = poolCandidates(db, { ...options, primaryOnly: true });
  // 2) Same neighbor band, allow secondary positions.
  if (!pool.length) pool = poolCandidates(db, { ...options, primaryOnly: false });
  // 3) XI only: widen to the slot's line role (still adjacent positions). Bench already has all.
  if (!pool.length && !isMiTeamBenchSlot(options.slot)) {
    const positions = positionsForRole(slotPackRole(options.slot));
    pool = poolCandidates(db, { ...options, positions, primaryOnly: true });
  }
  if (!pool.length && !isMiTeamBenchSlot(options.slot)) {
    const positions = positionsForRole(slotPackRole(options.slot));
    pool = poolCandidates(db, { ...options, positions, primaryOnly: false });
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Crest options for the MiTeam emblem picker (VORTEX + authored / pack crests). */
export function miteamCrestChoices(db: GameDatabase): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const add = (url: string, label: string) => {
    const u = url.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, label: label.trim() || "Crest" });
  };
  add("/vba-logo.png", "VORTEX");
  for (const team of db.teams.values()) {
    if (team.id === MITEAM_TEAM_ID) continue;
    const label = clubFilterLabel(team);
    const explicit = team.badgeAsset?.trim();
    if (explicit) {
      add(explicit, label);
      continue;
    }
    add(`/assets/crests/${team.id}.png`, label);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Dropdown label — Classic sides include era so repeats (e.g. Argyle eras) stay distinct. */
export function clubFilterLabel(team: TeamRecord): string {
  if (isClassicMenuTeam(team)) {
    const { label: base } = classicClubIdentity(team);
    const era = formatEraRoll(eraFromTeam(team));
    return era ? `${base} ${era}` : base;
  }
  return clubBaseName(team.name);
}

/** Clubs present in the current filterable pool (for dropdown). */
export function clubsInPool(db: GameDatabase): { teamId: string; label: string }[] {
  const out: { teamId: string; label: string }[] = [];
  for (const team of db.teams.values()) {
    if (team.id === MITEAM_TEAM_ID) continue;
    if (team.teamType === "CUSTOM_TEAM" && team.custom) continue;
    const squad = db.getSquad(team.id);
    if (!squad.length) continue;
    out.push({ teamId: team.id, label: clubFilterLabel(team) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function serializeFilter(filter: MiTeamPoolFilter): string {
  if (filter.kind === "all") return "all";
  if (filter.kind === "current") return "current";
  if (filter.kind === "classic") return "classic";
  if (filter.kind === "league") return `league:${filter.league}`;
  if (filter.kind === "classic_league") return `classic_league:${filter.league}`;
  return `club:${filter.teamId}`;
}

export function parseFilter(raw: string): MiTeamPoolFilter {
  if (!raw || raw === "all") return { kind: "all" };
  if (raw === "current") return { kind: "current" };
  if (raw === "classic") return { kind: "classic" };
  if (raw.startsWith("league:")) {
    const league = raw.slice(7);
    if ((MITEAM_FILTER_LEAGUES as readonly string[]).includes(league)) {
      return { kind: "league", league: league as (typeof MITEAM_FILTER_LEAGUES)[number] };
    }
  }
  if (raw.startsWith("classic_league:")) {
    const league = raw.slice("classic_league:".length);
    if ((MITEAM_FILTER_LEAGUES as readonly string[]).includes(league)) {
      return { kind: "classic_league", league: league as (typeof MITEAM_FILTER_LEAGUES)[number] };
    }
  }
  if (raw.startsWith("club:")) {
    const teamId = raw.slice(5);
    if (teamId) return { kind: "club", teamId };
  }
  return { kind: "all" };
}
