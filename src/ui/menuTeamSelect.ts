import type { Conference, TeamRecord } from "../data/schema";
import {
  DRAFT_CPU_ID_PREFIX,
  DRAFT_TEAM_ID,
  isDraftFamilyTeamId,
  MITEAM_TEAM_ID,
} from "../core/SaveManager";
import { conferenceForTeam } from "../football/league/Standings";

export type MenuTeamGroup = "USER" | Conference | "CLASSIC";

export interface MenuTeamOption {
  id: string;
  /** Short club label (no era) for the Team dial. */
  label: string;
  group: MenuTeamGroup;
  /**
   * Club identity for Classic era grouping (base name).
   */
  clubKey: string;
  /** Short roll label e.g. "91-92" or "Current". */
  eraLabel: string;
  /** Sort key for eras (season string). */
  eraSort: string;
}

const GROUP_ORDER: MenuTeamGroup[] = ["USER", "EAST", "WEST", "CLASSIC"];

/** Conference dial only — Classic eras hang under each franchise’s Era dial. */
export const MENU_TEAM_GROUPS: MenuTeamGroup[] = ["USER", "EAST", "WEST"];

export const MENU_TEAM_GROUP_LABEL: Record<MenuTeamGroup, string> = {
  USER: "User",
  EAST: "East",
  WEST: "West",
  CLASSIC: "Classic",
};

/**
 * Strip era suffixes: "Bulls — 1995/96" → "Bulls".
 */
export function clubBaseName(name: string): string {
  return name.split(/\s*[—–]\s*|\s+-\s+/)[0]!.trim();
}

export function classicClubIdentity(team: TeamRecord): { key: string; label: string } {
  const base = clubBaseName(team.name);
  return { key: base.toLowerCase(), label: base };
}

export function formatEraRoll(season: string | null | undefined): string {
  const raw = (season ?? "").trim();
  if (!raw) return "";
  const pair = /(\d{4})\s*[\/\-–]\s*(\d{2}|\d{4})\b/.exec(raw);
  if (pair) {
    const a = pair[1]!.slice(2);
    const b = pair[2]!.length === 4 ? pair[2]!.slice(2) : pair[2]!;
    return `${a}-${b}`;
  }
  const year = /(?:^|[—–\s])(\d{4})(?:\s|$)/.exec(raw);
  if (year) return year[1]!.slice(2);
  const decade = /^(\d{4})s$/i.exec(raw);
  if (decade) return `${decade[1]!.slice(2)}s`;
  if (/^\d{2}[\/\-–]\d{2}$/.test(raw)) return raw.replace(/[\/–]/g, "-");
  if (/^[A-Za-z0-9]{2,6}$/.test(raw) && !/^\d{4}$/.test(raw)) return raw.toUpperCase();
  return "";
}

export function eraFromTeam(team: TeamRecord): string {
  if (team.historicSeason?.trim()) return team.historicSeason.trim();
  const parts = team.name.split(/\s*[—–]\s*|\s+-\s+/);
  if (parts.length < 2) return "";
  const tail = parts.slice(1).join(" — ").trim();
  const m = /^(\d{4}(?:\s*[\/\-–]\s*\d{2,4})?|\d{4}s?)/.exec(tail);
  if (m) return m[1]!.replace(/\s+/g, "");
  if (/^[A-Za-z0-9]{2,6}$/.test(tail)) return tail;
  return "";
}

function isClassicTeam(team: TeamRecord): boolean {
  return (
    team.id.startsWith("classic_") ||
    team.teamType === "HISTORIC_TEAM" ||
    team.teamType === "HISTORIC_OPPONENT" ||
    team.teamType === "INTERNATIONAL" ||
    team.teamType === "LEGENDS_TEAM" ||
    team.teamType === "FANS_TEAM" ||
    !!team.fanTeam
  );
}

function isUserTeam(team: TeamRecord): boolean {
  return (
    team.id === MITEAM_TEAM_ID ||
    isDraftFamilyTeamId(team.id) ||
    (team.teamType === "CUSTOM_TEAM" && team.custom === true)
  );
}

function isSelectableClub(team: TeamRecord): boolean {
  if (isUserTeam(team)) return true;
  if (team.teamType === "CURRENT_TEAM") return true;
  if (isClassicTeam(team)) return true;
  return false;
}

function groupFor(team: TeamRecord): MenuTeamGroup {
  if (isUserTeam(team)) return "USER";
  // Historic sides use their franchise conference so Era rolls sit under East / West.
  return conferenceForTeam(team);
}

/** Franchise key so Current + Classic seasons share one Era dial. */
function clubKeyFor(team: TeamRecord): string {
  // Draft User + CPU seats share one Team dial entry; Era rolls User → CPU…
  if (isDraftFamilyTeamId(team.id)) return DRAFT_TEAM_ID;
  if (isUserTeam(team)) return team.id;
  const franchise = team.franchiseId?.trim();
  if (franchise) return franchise;
  if (team.teamType === "CURRENT_TEAM") return team.id;
  return classicClubIdentity(team).key;
}

/**
 * Flat team list for the main-menu dials.
 */
export function buildMenuTeamOptions(teams: TeamRecord[]): MenuTeamOption[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const options: MenuTeamOption[] = [];
  for (const team of teams) {
    if (!isSelectableClub(team)) continue;
    const group = groupFor(team);
    const clubKey = clubKeyFor(team);
    const franchise = byId.get(clubKey);
    const base =
      franchise && franchise.teamType === "CURRENT_TEAM"
        ? clubBaseName(franchise.name)
        : classicClubIdentity(team).label;
    const historic = isClassicTeam(team) && !isUserTeam(team);
    const eraRaw = historic || group === "USER" ? eraFromTeam(team) : "";
    const draftFamily = isDraftFamilyTeamId(team.id);
    const draftCpu = team.id.startsWith(DRAFT_CPU_ID_PREFIX);
    const cpuNum = draftCpu ? Number(team.id.slice(DRAFT_CPU_ID_PREFIX.length)) || 0 : 0;
    options.push({
      id: team.id,
      label: draftFamily ? "Draft" : base,
      group,
      clubKey,
      eraLabel: draftFamily
        ? team.id === DRAFT_TEAM_ID
          ? "User"
          : (team.historicSeason?.trim() || eraRaw || `CPU ${cpuNum}`)
        : historic
          ? formatEraRoll(eraRaw) || formatEraRoll(team.name) || "Classic"
          : group === "USER"
            ? formatEraRoll(eraRaw) || "25-26"
            : "Current",
      eraSort: draftFamily
        ? team.id === DRAFT_TEAM_ID
          ? "0_user"
          : `1_cpu_${String(cpuNum).padStart(2, "0")}`
        : historic
          ? eraRaw || team.name
          : "9999/99",
    });
  }
  return options.sort((a, b) => {
    const gi = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (gi) return gi;
    const club = a.label.localeCompare(b.label);
    if (club) return club;
    return b.eraSort.localeCompare(a.eraSort);
  });
}

export function teamsInGroup(options: MenuTeamOption[], group: MenuTeamGroup): MenuTeamOption[] {
  return options.filter((o) => o.group === group);
}

export function uniqueClubsInGroup(options: MenuTeamOption[], group: MenuTeamGroup): MenuTeamOption[] {
  const seen = new Set<string>();
  const out: MenuTeamOption[] = [];
  for (const opt of teamsInGroup(options, group)) {
    if (seen.has(opt.clubKey)) continue;
    seen.add(opt.clubKey);
    // Prefer the Current / newest era as the Team dial representative.
    const eras = erasForClub(options, opt.clubKey);
    out.push(eras[0] ?? opt);
  }
  return out;
}

export function erasForClub(options: MenuTeamOption[], clubKey: string): MenuTeamOption[] {
  const list = options.filter((o) => o.clubKey === clubKey);
  // Draft: User first, then CPU seats in seat order.
  if (clubKey === DRAFT_TEAM_ID) {
    return list.sort((a, b) => a.eraSort.localeCompare(b.eraSort));
  }
  // Newest / Current first so Era dials default to the live squad.
  return list.sort((a, b) => b.eraSort.localeCompare(a.eraSort));
}

export function findTeamOption(options: MenuTeamOption[], teamId: string): MenuTeamOption | undefined {
  return options.find((o) => o.id === teamId);
}

export function secondaryDialLabel(option: MenuTeamOption): string {
  return MENU_TEAM_GROUP_LABEL[option.group];
}

export function oppositionRollLabel(option: MenuTeamOption): string {
  if (option.eraLabel && option.eraLabel !== "Current" && option.eraLabel !== "—") {
    return `${option.label} ${option.eraLabel}`;
  }
  return option.label;
}

export function oppositionRollOptions(
  options: MenuTeamOption[],
  userTeamId: string,
): MenuTeamOption[] {
  const user = findTeamOption(options, userTeamId);
  const userKey = user?.clubKey ?? userTeamId;
  const seen = new Set<string>();
  return options.filter((o) => {
    if (o.id === userTeamId) return false;
    // Draft User ↔ Draft CPU share a clubKey but are distinct opposition sides.
    if (userKey === DRAFT_TEAM_ID && o.clubKey === DRAFT_TEAM_ID) {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    }
    if (o.clubKey === userKey) return false;
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

export function oppositionRollIndex(
  roll: MenuTeamOption[],
  oppositionTeamId: string,
): number {
  const exact = roll.findIndex((o) => o.id === oppositionTeamId);
  if (exact >= 0) return exact;
  const opt = findTeamOption(roll, oppositionTeamId);
  if (!opt) return 0;
  const byClub = roll.findIndex((o) => o.clubKey === opt.clubKey);
  return Math.max(0, byClub);
}
