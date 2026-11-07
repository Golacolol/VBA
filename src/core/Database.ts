import type {
  AdvertisingBoardRecord,
  FixtureRecord,
  LineupRecord,
  PlayerRecord,
  StadiumRecord,
  StoryRecord,
  TeamMembership,
  TeamRecord,
} from "../data/schema";
import { applyOverride, deriveOverall, resolveAttributes } from "../football/players/PlayerStats";
import type { SaveManager } from "./SaveManager";
import { DEFAULT_TEAM_ID } from "../football/constants";
import { applyMiTeamToDb } from "../football/miteam/MiTeam";
import { applyDraftTeamToDb } from "../football/pyramid/DraftTeam";
import { nextFixtureForTeam, todayIso } from "../data/leagueSchedule";
import { applyTacticsToLineup, type TeamTacticsSave } from "../football/teams/TeamTactics";
import { loadAssetPackManifest, resolvePlayerPortraitUrl } from "../data/AssetPack";
import playersData from "../../public/data/players.json";
import teamsData from "../../public/data/teams.json";
import membershipsData from "../../public/data/teamMemberships.json";
import lineupsData from "../../public/data/lineups.json";
import fixturesData from "../../public/data/fixtures.json";
import stadiumsData from "../../public/data/stadiums.json";
import advertisingData from "../../public/data/advertising.json";
import storiesData from "../../public/data/stories.json";

export interface SquadPlayer {
  player: PlayerRecord;
  membership: TeamMembership;
  attrs: PlayerRecord;
  overall: number;
  shirtNumber: number;
}

export class GameDatabase {
  players = new Map<string, PlayerRecord>();
  teams = new Map<string, TeamRecord>();
  memberships: TeamMembership[] = [];
  lineups: LineupRecord[] = [];
  fixtures: FixtureRecord[] = [];
  stadiums = new Map<string, StadiumRecord>();
  advertising: AdvertisingBoardRecord[] = [];
  stories: StoryRecord[] = [];
  userTeamId = DEFAULT_TEAM_ID;
  private attractIndex = 0;
  private fixtureTemplate: FixtureRecord | null = null;
  /** Seeded NBA schedule restored by resetFixturesBaseline. */
  private fixtureBaseline: FixtureRecord[] = [];
  /** Stable casual opponent for Classic sides (no league calendar). */
  private classicFriendlyAwayByHome = new Map<string, string>();

  static async load(save: SaveManager): Promise<GameDatabase> {
    const db = new GameDatabase();
    const players = playersData as PlayerRecord[];
    const teams = teamsData as TeamRecord[];
    const memberships = membershipsData as TeamMembership[];
    const lineups = lineupsData as LineupRecord[];
    const fixtures = fixturesData as FixtureRecord[];
    const stadiums = stadiumsData as StadiumRecord[];
    const advertising = advertisingData as AdvertisingBoardRecord[];
    const stories = storiesData as StoryRecord[];

    for (const p of players) db.players.set(p.id, p);
    for (const t of teams) {
      if (!t.conference && (t.league === "EAST" || t.league === "WEST")) {
        t.conference = t.league;
      }
      db.teams.set(t.id, t);
    }
    db.memberships = memberships;
    db.lineups = lineups;
    db.fixtureTemplate = fixtures[0] ?? null;
    db.fixtureBaseline = fixtures.map((f) => ({ ...f }));
    db.fixtures = fixtures.map((f) => ({ ...f }));
    for (const s of stadiums) db.stadiums.set(s.id, s);
    db.advertising = advertising;
    db.stories = stories;
    db.applySave(save);
    await db.applyAssetPack();
    return db;
  }

  /**
   * Apply asset-pack manifest mappings only (avoids mass 404s for missing files).
   * Drop-in convention paths are still tried at render time via Portrait helpers
   * when a player/team id is known and the file exists.
   */
  private async applyAssetPack(): Promise<void> {
    const pack = await loadAssetPackManifest();
    for (const [id, url] of Object.entries(pack.players ?? {})) {
      const player = this.players.get(id);
      if (!player || player.appearance?.portraitAsset) continue;
      player.appearance = { ...player.appearance, portraitAsset: url };
    }
    for (const [id, url] of Object.entries(pack.crests ?? {})) {
      const team = this.teams.get(id);
      if (!team || team.badgeAsset) continue;
      team.badgeAsset = url;
    }
    // Convention fallbacks for records that still have nothing set.
    for (const player of this.players.values()) {
      if (player.appearance?.portraitAsset) continue;
      const resolved = resolvePlayerPortraitUrl(player.id, null);
      // Only use pack fallback pool here — not every conventional path (404 spam).
      if (resolved && (pack.fallbackPortraits ?? []).includes(resolved)) {
        player.appearance = { ...player.appearance, portraitAsset: resolved };
      }
    }
  }

  private applySave(save: SaveManager): void {
    for (const p of save.data.players as PlayerRecord[]) {
      if (!p?.id) continue;
      const authored = this.players.get(p.id);
      // Classic seed identity wins when a save still holds a replaced player
      // (e.g. Eddie Gill → Kenyon Martin on the same classic_* id).
      if (
        authored &&
        String(authored.id).startsWith("classic_") &&
        (authored.displayName || "") !== (p.displayName || "")
      ) {
        this.players.set(p.id, { ...authored });
        continue;
      }
      const merged: PlayerRecord = { ...(authored ?? p), ...p };
      // Stale localStorage players can omit portraitAsset (e.g. new classic eras first
      // loaded before headshots were wired), or still hold CDN silhouettes. Prefer the
      // authored local PNG rather than wiping / keeping a weak remote URL.
      const savePort = p.appearance?.portraitAsset?.trim() || null;
      const authoredPort = authored?.appearance?.portraitAsset?.trim() || null;
      if (authoredPort && shouldPreferAuthoredPortrait(authoredPort, savePort)) {
        merged.appearance = {
          ...(authored?.appearance ?? {}),
          ...(p.appearance ?? {}),
          portraitAsset: authoredPort,
        };
      }
      this.players.set(p.id, merged);
    }
    for (const t of save.data.teams as TeamRecord[]) {
      if (!t?.id) continue;
      if (!t.conference && (t.league === "EAST" || t.league === "WEST")) t.conference = t.league;
      this.teams.set(t.id, { ...(this.teams.get(t.id) ?? t), ...t });
    }
    if (save.data.memberships.length) {
      for (const raw of save.data.memberships as TeamMembership[]) {
        if (!raw?.playerId || !raw?.teamId) continue;
        // Keep seeded classic era rosters (ids reshuffle / names replace across refreshes).
        if (String(raw.teamId).startsWith("classic_")) continue;
        const i = this.memberships.findIndex((m) => m.teamId === raw.teamId && m.playerId === raw.playerId);
        if (i >= 0) this.memberships[i] = { ...this.memberships[i], ...raw };
        else this.memberships.push(raw);
      }
    }
    const savedTeam = (save.data.settings as { defaultTeamId?: string }).defaultTeamId;
    if (savedTeam && this.teams.has(savedTeam)) this.userTeamId = savedTeam;
    else if (!this.teams.has(this.userTeamId) && this.teams.has(DEFAULT_TEAM_ID)) {
      this.userTeamId = DEFAULT_TEAM_ID;
    }
    if (save.data.settings.leagueProgression && save.data.playedListedFixture && save.data.fixtures.length) {
      this.applyCareerFixtures(save.data.fixtures as FixtureRecord[]);
    } else {
      this.overlayUserFixtureResults(save.data.fixtures as FixtureRecord[]);
    }
    if (save.data.advertising.length) {
      this.advertising = (save.data.advertising as AdvertisingBoardRecord[]).map((rec) =>
        rec.label === "NBA" ? { ...rec, label: "VBA" } : rec,
      );
    }
    this.applyTeamTactics(save.data.teamTactics ?? {});
    applyMiTeamToDb(this, save);
    applyDraftTeamToDb(this, save);
  }

  /** Overlay persisted formation / play-style / USER tactics onto authored lineups. */
  applyTeamTactics(tacticsByTeam: Record<string, TeamTacticsSave>): void {
    for (const [teamId, tactics] of Object.entries(tacticsByTeam)) {
      if (!tactics?.starters?.length || !this.teams.has(teamId)) continue;
      // Classic era starters are authored; stale saves can hide seed replacements.
      if (String(teamId).startsWith("classic_")) continue;
      const lineup = this.lineups.find((l) => l.teamId === teamId);
      if (!lineup) continue;
      applyTacticsToLineup(lineup, tactics);
    }
  }

  /** Restore the seeded NBA schedule (casual baseline). */
  resetFixturesBaseline(): void {
    this.fixtures = this.fixtureBaseline.map((f) => ({ ...f }));
  }

  /** Restore played / simulated flags from a saved career season. */
  applyCareerFixtures(saved: FixtureRecord[]): void {
    if (!saved?.length) return;
    const byId = new Map(saved.filter((f) => f?.id).map((f) => [f.id, f]));
    this.fixtures = this.fixtures.map((fixture) => {
      const hit = byId.get(fixture.id);
      if (!hit) return fixture;
      // Official calendar scores always win over career catch-up / stale saves.
      if (fixture.official && fixture.played) {
        return fixture;
      }
      return {
        ...fixture,
        played: !!hit.played,
        homeScore: hit.homeScore,
        awayScore: hit.awayScore,
        simulated: hit.simulated,
      };
    });
  }

  private overlayUserFixtureResults(saved: FixtureRecord[]): void {
    if (!saved?.length) return;
    const userPlayed = new Map<string, FixtureRecord>();
    for (const fixture of saved) {
      if (!fixture?.played || fixture.simulated !== false) continue;
      userPlayed.set(`${fixture.competition}|${fixture.homeTeamId}|${fixture.awayTeamId}`, fixture);
    }
    if (!userPlayed.size) return;
    this.fixtures = this.fixtures.map((fixture) => {
      const played = userPlayed.get(`${fixture.competition}|${fixture.homeTeamId}|${fixture.awayTeamId}`);
      if (!played || fixture.played) return fixture;
      return {
        ...fixture,
        played: true,
        homeScore: played.homeScore,
        awayScore: played.awayScore,
        simulated: false,
      };
    });
  }

  getPlayer(id: string): PlayerRecord {
    const p = this.players.get(id);
    if (!p) throw new Error(`Unknown player ${id}`);
    return p;
  }

  getTeam(id: string): TeamRecord {
    const t = this.teams.get(id);
    if (!t) throw new Error(`Unknown team ${id}`);
    return t;
  }

  getStadium(id: string): StadiumRecord {
    const s =
      this.stadiums.get(id) ??
      this.stadiums.get("vortex_arena") ??
      this.stadiums.get("nba_bos_arena") ??
      [...this.stadiums.values()][0];
    if (!s) throw new Error(`Unknown stadium ${id}`);
    return s;
  }

  membershipsForTeam(teamId: string): TeamMembership[] {
    return this.memberships.filter((m) => m.teamId === teamId && (m.to === null || m.to === undefined));
  }

  membershipsForPlayer(playerId: string): TeamMembership[] {
    return this.memberships.filter((m) => m.playerId === playerId);
  }

  resolveSquadPlayer(membership: TeamMembership): SquadPlayer {
    const player = this.getPlayer(membership.playerId);
    const attrs = applyOverride(resolveAttributes(player), membership.ratingOverride);
    // Prefer membership override, then authored peak `player.overall` (classic / Pyramid),
    // then live derive — so Heat LeBron stays ~97 instead of collapsing to a role-player band.
    const authored =
      typeof membership.ratingOverride?.overall === "number"
        ? membership.ratingOverride.overall
        : typeof player.overall === "number"
          ? player.overall
          : null;
    const overall = authored ?? deriveOverall(player.primaryPosition, attrs);
    return {
      player,
      membership,
      attrs: { ...player, ...attrs, overall },
      overall,
      shirtNumber: membership.shirtNumber,
    };
  }

  getSquad(teamId: string): SquadPlayer[] {
    return this.membershipsForTeam(teamId)
      .filter((m) => this.players.has(m.playerId))
      .map((m) => this.resolveSquadPlayer(m));
  }

  getLineup(id: string | undefined, teamId: string): LineupRecord {
    const found = this.lineups.find((l) => l.id === id && l.teamId === teamId) ?? this.lineups.find((l) => l.teamId === teamId);
    if (!found) throw new Error(`No lineup for team ${teamId}`);
    return found;
  }

  defaultLineupId(teamId: string): string | undefined {
    return this.lineups.find((l) => l.teamId === teamId)?.id;
  }

  getStartingSquad(lineup: LineupRecord): SquadPlayer[] {
    const out: SquadPlayer[] = [];
    for (const slot of lineup.starters) {
      if (!this.players.has(slot.playerId)) continue;
      const membership =
        this.memberships.find((m) => m.teamId === lineup.teamId && m.playerId === slot.playerId) ??
        ({
          playerId: slot.playerId,
          teamId: lineup.teamId,
          shirtNumber: 0,
          squadRole: "FIRST_TEAM",
        } satisfies TeamMembership);
      out.push(this.resolveSquadPlayer(membership));
    }
    return out;
  }

  nextFixture(teamId = this.userTeamId, skipPlayed = false): FixtureRecord {
    const listed = nextFixtureForTeam(this.fixtures, teamId, todayIso(), { skipPlayed });
    if (listed) return listed;
    return this.friendlyFor(teamId);
  }

  teamStrength(teamId: string): number {
    try {
      const lineup = this.getLineup(this.defaultLineupId(teamId), teamId);
      const xi = this.getStartingSquad(lineup);
      if (!xi.length) return 70;
      return xi.reduce((sum, p) => sum + p.overall, 0) / xi.length;
    } catch {
      return 70;
    }
  }

  private classicOpponentIds(homeId: string): string[] {
    return [...this.teams.values()]
      .filter((t) => t.id !== homeId && isClassicMenuTeam(t))
      .map((t) => t.id);
  }

  /** Pick (and cache) another Classic side for menu friendlies — never the league template default. */
  private resolveClassicFriendlyAway(homeId: string): string {
    const pool = this.classicOpponentIds(homeId);
    const cached = this.classicFriendlyAwayByHome.get(homeId);
    if (cached && pool.includes(cached)) return cached;
    if (!pool.length) {
      const base = this.fixtureTemplate ?? this.fixtures[0];
      return cycleAttractOpponent(
        [...this.teams.values()].map((t) => t.id),
        homeId,
        0,
        base?.awayTeamId,
      );
    }
    const awayId = pool[Math.floor(Math.random() * pool.length)]!;
    this.classicFriendlyAwayByHome.set(homeId, awayId);
    return awayId;
  }

  private friendlyAwayFallback(homeId: string, preferredAwayId?: string): string {
    const home = this.teams.get(homeId);
    if (home && isClassicMenuTeam(home)) return this.resolveClassicFriendlyAway(homeId);
    return cycleAttractOpponent(
      [...this.teams.values()].map((t) => t.id),
      homeId,
      0,
      preferredAwayId,
    );
  }

  private friendlyFor(teamId: string): FixtureRecord {
    const base = this.fixtureTemplate ?? this.fixtures[0];
    const homeId = this.teams.has(teamId) ? teamId : DEFAULT_TEAM_ID;
    const awayId = this.friendlyAwayFallback(homeId, base?.awayTeamId);
    return this.friendlyVs(homeId, awayId);
  }

  /** One-off home friendly against a chosen opposition (menu opposition dial). */
  friendlyVs(homeTeamId: string, awayTeamId: string): FixtureRecord {
    const base = this.fixtureTemplate ?? this.fixtures[0];
    const homeId = this.teams.has(homeTeamId) ? homeTeamId : DEFAULT_TEAM_ID;
    const awayId =
      this.teams.has(awayTeamId) && awayTeamId !== homeId
        ? awayTeamId
        : this.friendlyAwayFallback(homeId, base?.awayTeamId);
    const home = this.getTeam(homeId);
    return {
      ...(base ?? {
        id: "friendly",
        homeTeamId: homeId,
        awayTeamId: awayId,
        venueId: home.defaultStadiumId,
        competition: "Friendly",
        date: todayIso(),
        time: "15:00",
        durationSeconds: 600,
      }),
      id: `friendly_${homeId}_${awayId}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeLineupId: this.defaultLineupId(homeId) ?? base?.homeLineupId,
      awayLineupId: this.defaultLineupId(awayId) ?? base?.awayLineupId,
      venueId: home.defaultStadiumId,
      competition: "Friendly",
      date: todayIso(),
    };
  }

  currentAttractFixture(durationSeconds: number): FixtureRecord {
    const base = this.fixtures[0];
    const homeId = this.teams.has(this.userTeamId) ? this.userTeamId : this.teams.has(DEFAULT_TEAM_ID) ? DEFAULT_TEAM_ID : base.homeTeamId;
    const awayId = cycleAttractOpponent(
      [...this.teams.values()].map((t) => t.id),
      homeId,
      this.attractIndex,
      base.awayTeamId,
    );
    const home = this.getTeam(homeId);
    return {
      ...base,
      id: `sim_${awayId}_${this.attractIndex}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeLineupId: this.defaultLineupId(homeId) ?? base.homeLineupId,
      awayLineupId: this.defaultLineupId(awayId) ?? base.awayLineupId,
      venueId: home.defaultStadiumId,
      durationSeconds,
    };
  }

  randomSimulatorFixture(durationSeconds: number): FixtureRecord {
    const base = this.fixtures[0];
    const homeId = this.teams.has(this.userTeamId) ? this.userTeamId : this.teams.has(DEFAULT_TEAM_ID) ? DEFAULT_TEAM_ID : base.homeTeamId;
    const rest = [...this.teams.values()].map((t) => t.id).filter((id) => id !== homeId);
    const awayId = rest[Math.floor(Math.random() * rest.length)] ?? base.awayTeamId;
    const home = this.getTeam(homeId);
    const timeOfDay = (["DAY", "EVENING", "NIGHT"] as const)[Math.floor(Math.random() * 3)];
    const weatherPool = timeOfDay === "NIGHT" ? (["MILD", "RAINY", "SNOWY"] as const) : (["MILD", "RAINY", "SNOWY", "SUNNY"] as const);
    return {
      ...base,
      id: `sim_${awayId}_${Date.now()}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeLineupId: this.defaultLineupId(homeId) ?? base.homeLineupId,
      awayLineupId: this.defaultLineupId(awayId) ?? base.awayLineupId,
      venueId: home.defaultStadiumId,
      durationSeconds,
      timeOfDay,
      weather: weatherPool[Math.floor(Math.random() * weatherPool.length)],
    };
  }

  advanceAttractOpponent(): void {
    this.attractIndex += 1 + Math.floor(Math.random() * 3);
  }
}

export function cycleAttractOpponent(teamIds: string[], homeId: string, index: number, preferredAwayId?: string): string {
  const rest = teamIds.filter((id) => id !== homeId);
  if (!rest.length) return homeId;
  const ordered = preferredAwayId && rest.includes(preferredAwayId) ? [preferredAwayId, ...rest.filter((id) => id !== preferredAwayId)] : rest;
  return ordered[((index % ordered.length) + ordered.length) % ordered.length];
}

/** Menu Classic / historic / fans / international sides (no English league calendar). */
export function isClassicMenuTeam(team: TeamRecord): boolean {
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

/** Local pack path (not a remote CDN URL). */
function isLocalPortraitUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/**
 * Prefer authored portrait when the save has none, still points at a remote CDN card,
 * or holds a stale prior local path after a second seed replace.
 * Preserve in-game custom picks (`/images/…`, data URLs).
 */
export function shouldPreferAuthoredPortrait(authoredPort: string, savePort: string | null): boolean {
  if (!savePort) return true;
  if (!isLocalPortraitUrl(authoredPort)) return false;
  // User-uploaded / Character Select custom art wins over seed.
  if (savePort.startsWith("data:") || savePort.startsWith("blob:")) return false;
  if (isLocalPortraitUrl(savePort) && (savePort.startsWith("/images/") || savePort.includes("/images/"))) {
    return false;
  }
  // Seed local beats CDN silhouettes and referrer-blocked remotes.
  if (/^https?:\/\//i.test(savePort)) return true;
  // Second replace often changes the filename while localStorage still holds the first path.
  if (isLocalPortraitUrl(savePort) && normalizePortraitPath(savePort) !== normalizePortraitPath(authoredPort)) {
    return true;
  }
  return false;
}

/** Strip query/hash so `foo.png?v=2` compares equal to `foo.png`. */
function normalizePortraitPath(url: string): string {
  return url.split(/[?#]/, 2)[0]!;
}
