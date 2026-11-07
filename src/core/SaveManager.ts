import { DEFAULT_KEY_BINDINGS, mergeKeyBindings, type KeyBindings } from "../football/controls/KeyBindings";
import { DEFAULT_KICK_OFF_TIME, DEFAULT_MATCH_DURATION, DEFAULT_TEAM_ID } from "../football/constants";
import { blankPredictions, normalizePredictions, type PredictionsState } from "../football/predictions/Predictions";
import type { TeamTacticsSave } from "../football/teams/TeamTactics";
import { DEFAULT_TITLE_FONT, DEFAULT_CLUB_NAME_FONT, DEFAULT_CLUB_NAME_GLOW, DEFAULT_CLUB_NAME_GLOW_DIFFUSION, DEFAULT_CLUB_NAME_INVERT_COLORS, clampClubNameGlowDiffusion } from "../ui/TitleFonts";
import { normalizeProductMode, type ProductMode } from "./ProductMode";
import {
  normalizePyramidSave,
  type PyramidSave,
} from "../football/pyramid/defaultPyramid";

export type { PyramidSave };

export interface SavedSettings {
  matchDuration: number;
  cameraMode: "BROADCAST" | "TACTICAL" | "CLOSE";
  viewMode: "CLOSE" | "MEDIUM" | "WIDE" | "PLAYER" | "BIRD" | "BIRD_FAR";
  trackMode: "BALL" | "PLAYER" | "DYNAMIC";
  /** Shared camera zoom: 1 = default; higher = closer (sideline + bird). */
  cameraZoom: number;
  graphicsPreset: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  debug: boolean;
  /** When true with debug, records AI decision events for analysis (off by default). */
  aiAnalysisTelemetry: boolean;
  /** Random-pool Classic Teams in Match Simulation Lab. Default OFF. */
  includeClassicInSimulations: boolean;
  formationDebug: boolean;
  masterVolume: number;
  invertShotY: boolean;
  gameplayMode: ProductMode;
  /** TABLE foosball defaults. */
  tableLayoutId: "FRENCH_CLASSIC" | "TOURNAMENT_MODERN" | "OPEN_CUSTOM";
  tableOpponent: "AI" | "HUMAN";
  tableDifficulty: "EASY" | "NORMAL" | "HARD" | "EXPERT";
  tableFirstTo: number;
  tableCustomMen: [number, number, number, number];
  /** FLICK Flickball defaults. */
  flickOpponent: "AI" | "HUMAN";
  flickDifficulty: "EASY" | "NORMAL" | "HARD" | "EXPERT";
  flickFirstTo: number;
  /** Classic alternate flicks when true; open reactive play when false. */
  flickTurnBased: boolean;
  /** Main menu Team Select kit dial — HOME or AWAY for the user club. */
  menuKitChoice: "home" | "away";
  timeOfDay: "DAY" | "EVENING" | "NIGHT";
  weather: "SUNNY" | "MILD" | "RAINY" | "SNOWY";
  kickOffTime: string;
  defaultTeamId: string;
  titleFont: string;
  clubNameFont: string;
  clubNameGlow: boolean;
  clubNameGlowDiffusion: number;
  clubNameInvertColors: boolean;
  keyBindings: KeyBindings;
  homeHudRing: boolean;
  awayHudRing: boolean;
  homeShowPortraits: boolean;
  awayShowPortraits: boolean;
  homePortraitOpacity: number;
  awayPortraitOpacity: number;
  homePortraitScale: number;
  awayPortraitScale: number;
  homePortraitUpright: boolean;
  awayPortraitUpright: boolean;
  homeHidePlayers: boolean;
  awayHidePlayers: boolean;
  homeShowDefLine: boolean;
  homeShowMidLine: boolean;
  homeShowAttLine: boolean;
  awayShowDefLine: boolean;
  awayShowMidLine: boolean;
  awayShowAttLine: boolean;
  homeDefLineColor: string;
  homeMidLineColor: string;
  homeAttLineColor: string;
  awayDefLineColor: string;
  awayMidLineColor: string;
  awayAttLineColor: string;
  ballGoldRing: boolean;
  /** Info overlays: help tooltips + formation pitch/bench name tips. Default off. */
  formationOverlays: boolean;
  /**
   * Player headshot PNGs on MiTeam / Play Next Fixture cards & counters.
   * Default off (club emblem + jersey name/number). Pyramid is unaffected.
   * When turned on, the choice is persisted for later sessions.
   */
  showMenuPlayerPngs: boolean;
  /** Ring under the intended pass receiver while aiming. Default off. */
  showPassTargetHighlight: boolean;
  /** Visual football size: 1 = default, up to ~2.25. */
  ballScale: number;
  leagueProgression: boolean;
  audioEnabled: boolean;
}

export interface SaveData {
  settings: SavedSettings;
  teams: unknown[];
  players: unknown[];
  memberships: unknown[];
  fixtures: unknown[];
  advertising: unknown[];
  fansTeam: unknown | null;
  playedListedFixture: boolean;
  predictions: PredictionsState;
  /** Per-team formation / play-style / USER custom tactics. */
  teamTactics: Record<string, TeamTacticsSave>;
  /** One MiTeam pack-built club per browser (null = none). */
  miteam: MiTeamSave | null;
  /** Completed Pyramid Draft seat saved as a User club (null = none). */
  draftTeam: MiTeamSave | null;
  /** Editable Top 50 all-time ranking (Pyramid / Ring hub). */
  pyramid: PyramidSave | null;
}

export type MiTeamRosterSlot = {
  playerId: string;
  slot: string;
  shirtNumber: number;
  /** Origin club the player was packed from (for card / counter colours). */
  sourceTeamId?: string | null;
};

export type MiTeamSave = {
  teamId: string;
  clubName: string;
  /**
   * Crest URL (pack path or data URL).
   * Null = unset — player cards use each origin club crest until the user picks one.
   */
  badgeAsset: string | null;
  /**
   * Optional MiTeam shell kit colours.
   * Null = unset — players keep origin club colours on cards/kits until set.
   */
  primaryColor: string | null;
  secondaryColor: string | null;
  roster: MiTeamRosterSlot[];
  nextFixtureId: string | null;
};

const KEY = "vortex-basketball-save-v1";

export const DEFAULT_SETTINGS: SavedSettings = {
  matchDuration: DEFAULT_MATCH_DURATION,
  cameraMode: "BROADCAST",
  viewMode: "MEDIUM",
  trackMode: "DYNAMIC",
  cameraZoom: 1,
  graphicsPreset: "VERY_HIGH",
  debug: false,
  aiAnalysisTelemetry: false,
  includeClassicInSimulations: false,
  formationDebug: false,
  masterVolume: 0.7,
  invertShotY: false,
  gameplayMode: "BASKETBALL",
  tableLayoutId: "FRENCH_CLASSIC",
  tableOpponent: "AI",
  tableDifficulty: "NORMAL",
  tableFirstTo: 5,
  tableCustomMen: [1, 2, 5, 3],
  flickOpponent: "AI",
  flickDifficulty: "NORMAL",
  flickFirstTo: 5,
  flickTurnBased: true,
  menuKitChoice: "home",
  timeOfDay: "EVENING",
  weather: "MILD",
  kickOffTime: DEFAULT_KICK_OFF_TIME,
  defaultTeamId: DEFAULT_TEAM_ID,
  titleFont: DEFAULT_TITLE_FONT,
  clubNameFont: DEFAULT_CLUB_NAME_FONT,
  clubNameGlow: DEFAULT_CLUB_NAME_GLOW,
  clubNameGlowDiffusion: DEFAULT_CLUB_NAME_GLOW_DIFFUSION,
  clubNameInvertColors: DEFAULT_CLUB_NAME_INVERT_COLORS,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
  homeHudRing: false,
  awayHudRing: false,
  homeShowPortraits: false,
  awayShowPortraits: false,
  homePortraitOpacity: 0.85,
  awayPortraitOpacity: 0.85,
  homePortraitScale: 1,
  awayPortraitScale: 1,
  homePortraitUpright: false,
  awayPortraitUpright: false,
  homeHidePlayers: false,
  awayHidePlayers: false,
  homeShowDefLine: false,
  homeShowMidLine: false,
  homeShowAttLine: false,
  awayShowDefLine: false,
  awayShowMidLine: false,
  awayShowAttLine: false,
  homeDefLineColor: "#3db7ff",
  homeMidLineColor: "#ffd24a",
  homeAttLineColor: "#ff5a6a",
  awayDefLineColor: "#7ad0ff",
  awayMidLineColor: "#ffc14d",
  awayAttLineColor: "#ff8a9a",
  ballGoldRing: false,
  formationOverlays: false,
  showMenuPlayerPngs: false,
  showPassTargetHighlight: false,
  ballScale: 1,
  leagueProgression: false,
  audioEnabled: true,
};

export class SaveManager {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return this.blank();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const rawSettings = (parsed.settings ?? {}) as Partial<SavedSettings> & { hudPlayerRings?: boolean };
      const settings = { ...DEFAULT_SETTINGS, ...rawSettings, keyBindings: mergeKeyBindings(rawSettings.keyBindings) };
      if (settings.titleFont === "anton") settings.titleFont = DEFAULT_TITLE_FONT;
      if (!("homeHudRing" in rawSettings) && rawSettings.hudPlayerRings) {
        settings.homeHudRing = true;
        settings.awayHudRing = true;
      }
      settings.homePortraitOpacity = clamp01(settings.homePortraitOpacity);
      settings.awayPortraitOpacity = clamp01(settings.awayPortraitOpacity);
      settings.homePortraitScale = clampScale(settings.homePortraitScale);
      settings.awayPortraitScale = clampScale(settings.awayPortraitScale);
      settings.clubNameGlowDiffusion = clampClubNameGlowDiffusion(settings.clubNameGlowDiffusion);
      settings.clubNameGlow = settings.clubNameGlow !== false;
      settings.clubNameInvertColors = settings.clubNameInvertColors === true;
      settings.formationOverlays = settings.formationOverlays === true;
      settings.showMenuPlayerPngs = settings.showMenuPlayerPngs === true;
      settings.cameraZoom = clampCameraZoomSetting(settings.cameraZoom);
      settings.ballScale = clampBallScaleSetting(settings.ballScale);
      settings.homeDefLineColor = clampHex(settings.homeDefLineColor, DEFAULT_SETTINGS.homeDefLineColor);
      settings.homeMidLineColor = clampHex(settings.homeMidLineColor, DEFAULT_SETTINGS.homeMidLineColor);
      settings.homeAttLineColor = clampHex(settings.homeAttLineColor, DEFAULT_SETTINGS.homeAttLineColor);
      settings.awayDefLineColor = clampHex(settings.awayDefLineColor, DEFAULT_SETTINGS.awayDefLineColor);
      settings.awayMidLineColor = clampHex(settings.awayMidLineColor, DEFAULT_SETTINGS.awayMidLineColor);
      settings.awayAttLineColor = clampHex(settings.awayAttLineColor, DEFAULT_SETTINGS.awayAttLineColor);
      settings.gameplayMode = normalizeProductMode(rawSettings.gameplayMode);
      if (settings.flickOpponent !== "AI" && settings.flickOpponent !== "HUMAN") settings.flickOpponent = "AI";
      if (
        settings.flickDifficulty !== "EASY" &&
        settings.flickDifficulty !== "NORMAL" &&
        settings.flickDifficulty !== "HARD" &&
        settings.flickDifficulty !== "EXPERT"
      ) {
        settings.flickDifficulty = "NORMAL";
      }
      settings.flickFirstTo = Math.max(1, Math.min(21, Number(settings.flickFirstTo) || 5));
      if (typeof settings.flickTurnBased !== "boolean") settings.flickTurnBased = true;
      if (settings.menuKitChoice !== "home" && settings.menuKitChoice !== "away") {
        settings.menuKitChoice = "home";
      }
      if (
        settings.tableLayoutId !== "FRENCH_CLASSIC" &&
        settings.tableLayoutId !== "TOURNAMENT_MODERN" &&
        settings.tableLayoutId !== "OPEN_CUSTOM"
      ) {
        settings.tableLayoutId = "FRENCH_CLASSIC";
      }
      if (settings.tableOpponent !== "AI" && settings.tableOpponent !== "HUMAN") settings.tableOpponent = "AI";
      if (!["EASY", "NORMAL", "HARD", "EXPERT"].includes(settings.tableDifficulty)) {
        settings.tableDifficulty = "NORMAL";
      }
      settings.tableFirstTo = Math.max(1, Math.min(21, Number(settings.tableFirstTo) || 5));
      {
        const m = settings.tableCustomMen;
        settings.tableCustomMen = [
          1,
          Math.max(1, Math.min(5, Number(m?.[1]) || 2)),
          Math.max(1, Math.min(5, Number(m?.[2]) || 5)),
          Math.max(1, Math.min(5, Number(m?.[3]) || 3)),
        ];
      }
      return {
        ...this.blank(),
        ...parsed,
        settings,
        playedListedFixture: Boolean(parsed.playedListedFixture),
        predictions: normalizePredictions(parsed.predictions),
        teamTactics:
          parsed.teamTactics && typeof parsed.teamTactics === "object"
            ? (parsed.teamTactics as Record<string, TeamTacticsSave>)
            : {},
        miteam: normalizeMiTeamSave(parsed.miteam),
        draftTeam: normalizeDraftTeamSave(parsed.draftTeam),
        pyramid: normalizePyramidSave(parsed.pyramid),
      };
    } catch {
      return this.blank();
    }
  }

  save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data));
  }

  resetDefaults(): void {
    this.data = this.blank();
    this.save();
  }

  private blank(): SaveData {
    return {
      settings: { ...DEFAULT_SETTINGS },
      teams: [],
      players: [],
      memberships: [],
      fixtures: [],
      advertising: [],
      fansTeam: null,
      playedListedFixture: false,
      predictions: blankPredictions(),
      teamTactics: {},
      miteam: null,
      draftTeam: null,
      pyramid: null,
    };
  }
}

export const MITEAM_TEAM_ID = "miteam_user";
export const MITEAM_DEFAULT_CLUB_NAME = "MiTeam";
export const MITEAM_DEFAULT_BADGE = "/vba-logo.png";
export const MITEAM_DEFAULT_PRIMARY = "#A8B0BC";
export const MITEAM_DEFAULT_SECONDARY = "#1B2430";
export const MITEAM_ERA = "2025/26";
export const MITEAM_LINEUP_ID = "miteam_user_lineup";
export const MITEAM_FORMATION = "BASKETBALL_5";
export const MITEAM_BENCH_SLOTS = 8;

/** User club saved from a completed Pyramid Draft seat. */
export const DRAFT_TEAM_ID = "draft_user";
export const DRAFT_DEFAULT_CLUB_NAME = "Draft";
/** Same main mark as MiTeam court (`/vba-logo.png`). */
export const DRAFT_DEFAULT_BADGE = MITEAM_DEFAULT_BADGE;
export const DRAFT_DEFAULT_PRIMARY = "#1B2430";
export const DRAFT_DEFAULT_SECONDARY = "#E8A84A";
export const DRAFT_LINEUP_ID = "draft_user_lineup";

function normalizeHexColor(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function normalizeMiTeamSave(raw: unknown): MiTeamSave | null {
  return normalizeUserClubSave(raw, MITEAM_TEAM_ID, MITEAM_DEFAULT_CLUB_NAME);
}

function normalizeDraftTeamSave(raw: unknown): MiTeamSave | null {
  const next = normalizeUserClubSave(raw, DRAFT_TEAM_ID, DRAFT_DEFAULT_CLUB_NAME);
  if (!next) return null;
  // Legacy Draft crest was vortex-logo.svg; use the same main mark as MiTeam.
  if (next.badgeAsset === "/vortex-logo.svg") next.badgeAsset = DRAFT_DEFAULT_BADGE;
  return next;
}

function normalizeUserClubSave(
  raw: unknown,
  fallbackTeamId: string,
  fallbackClubName: string,
): MiTeamSave | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<MiTeamSave>;
  if (typeof o.teamId !== "string" || !o.teamId) return null;
  const clubName =
    typeof o.clubName === "string" && o.clubName.trim() ? o.clubName.trim() : fallbackClubName;
  const badgeAsset =
    typeof o.badgeAsset === "string" && o.badgeAsset.trim() ? o.badgeAsset.trim() : null;
  const roster = Array.isArray(o.roster)
    ? o.roster
        .filter(
          (r): r is MiTeamRosterSlot =>
            !!r &&
            typeof r === "object" &&
            typeof (r as MiTeamRosterSlot).playerId === "string" &&
            typeof (r as MiTeamRosterSlot).slot === "string" &&
            Number.isFinite(Number((r as MiTeamRosterSlot).shirtNumber)),
        )
        .map((r) => ({
          playerId: r.playerId,
          slot: r.slot,
          shirtNumber: Math.max(1, Math.min(99, Math.round(Number(r.shirtNumber)))),
          sourceTeamId:
            typeof r.sourceTeamId === "string" && r.sourceTeamId.trim() ? r.sourceTeamId.trim() : null,
        }))
    : [];
  return {
    teamId: o.teamId || fallbackTeamId,
    clubName,
    badgeAsset,
    primaryColor: normalizeHexColor(o.primaryColor, null),
    secondaryColor: normalizeHexColor(o.secondaryColor, null),
    roster,
    nextFixtureId: typeof o.nextFixtureId === "string" ? o.nextFixtureId : null,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.85;
  return Math.min(1, Math.max(0, n));
}

function clampCameraZoomSetting(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.85, Math.max(0.7, n));
}

function clampBallScaleSetting(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(2.25, Math.max(1, n));
}

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(0.4, n));
}

function clampHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
