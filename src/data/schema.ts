/** NBA conferences (Phase 1 standings / menu dials). */
export type Conference = "EAST" | "WEST";

/** @deprecated Use Conference — kept as an alias so older call sites still typecheck. */
export type EnglishLeague = Conference;

export type TeamType =
  | "CURRENT_TEAM"
  | "HISTORIC_TEAM"
  | "HISTORIC_OPPONENT"
  | "FANS_TEAM"
  | "CUSTOM_TEAM"
  | "LEGENDS_TEAM"
  | "YOUTH_TEAM"
  | "STORY_TEAM"
  | "INTERNATIONAL";

export type VenueType =
  | "NBA_ARENA"
  | "STREET_COURT"
  | "GYM"
  | "CLASSIC_ARENA"
  | "PRO_STADIUM"
  | "SMALL_STADIUM"
  | "COMMUNITY_PITCH"
  | "TRAINING_GROUND"
  | "HISTORIC_GROUND"
  | "CUSTOM";

export type ScoreboardType = "LED_VIDEO_SCREEN" | "TRADITIONAL_SCOREBOARD" | "NONE";

export type CrowdSupport = "HOME" | "AWAY" | "NEUTRAL";

export type PositionCode =
  | "PG"
  | "SG"
  | "SF"
  | "PF"
  | "C"
  | "GK"
  | "RB"
  | "CB"
  | "LB"
  | "RWB"
  | "LWB"
  | "DM"
  | "CM"
  | "AM"
  | "RM"
  | "LM"
  | "RW"
  | "LW"
  | "ST";

export interface AppearanceData {
  portraitAsset?: string | null;
  fullBodyAsset?: string | null;
  modelId?: string;
  skinTone?: number;
  hairStyle?: "short" | "fade" | "curl" | "long" | "bald";
  hairColor?: string;
  bootStyle?: string;
  sleeveStyle?: "short" | "long";
  heightScale?: number;
  bodyType?: "lean" | "standard" | "stocky";
  /** Continuous XZ girth (≈0.86–1.14); derived from height/weight when set. */
  bodyWidth?: number;
  /** Optional birthplace from openfootball / bio enrich (display only). */
  birthplace?: string;
  /** Full legal / wiki-friendly name from openfootball (for portraits & bios). */
  fullName?: string;
  /** College / university (card-back bio). */
  college?: string;
  /** Common nickname (card-back bio). */
  nickname?: string;
}

/**
 * Basketball attribute set (1–100).
 * Football-named mirrors remain optional so leftover Match code can still read them.
 */
export interface PlayerAttributes {
  /** Finish at the rim / in the paint. */
  finishing: number;
  /** Pull-up / mid-range jumper. */
  midRange: number;
  /** Three-point shooting. */
  threePoint: number;
  /** Free-throw shooting. */
  freeThrow: number;
  /** Handle / creation vs pressure. */
  ballHandle: number;
  /** Pass accuracy and delivery. */
  passAccuracy: number;
  /** On-ball / perimeter defense. */
  perimeterD: number;
  /** Post / paint defense. */
  interiorD: number;
  /** Rebound skill (box-outs + tracking). */
  rebound: number;
  /** Steal / deflection instinct. */
  steal: number;
  /** Shot-blocking / contest length. */
  block: number;
  /** Straight-line speed. */
  speed: number;
  /** First step / burst. */
  acceleration?: number;
  /** Vertical leap. */
  vertical: number;
  strength: number;
  stamina: number;
  /** Basketball IQ / decision making. */
  iq: number;
  /** Late-game / pressure shooting & poise. */
  clutch: number;

  /** @deprecated Prefer `speed` — mirror for leftover football systems. */
  pace?: number;
  /** @deprecated Prefer `passAccuracy`. */
  passing?: number;
  longPassing?: number;
  /** @deprecated Prefer `iq`. */
  vision?: number;
  crossing?: number;
  /** @deprecated Prefer `ballHandle`. */
  control?: number;
  /** @deprecated Prefer `ballHandle`. */
  dribbling?: number;
  /** @deprecated Prefer scoring mix. */
  shooting?: number;
  shotPower?: number;
  /** @deprecated Prefer `threePoint`. */
  longShots?: number;
  heading?: number;
  penalties?: number;
  setPieces?: number;
  /** @deprecated Prefer perimeterD/interiorD. */
  defending?: number;
  defensiveAwareness?: number;
  tackling?: number;
  /** @deprecated Prefer `vertical`. */
  jumping?: number;
  aggression?: number;
  /** @deprecated Prefer `clutch`. */
  composure?: number;
  form?: number;
  concentration?: number;
  attackingAwareness?: number;
  reactions?: number;
  agility?: number;
  balance?: number;
  gkDiving?: number;
  gkHandling?: number;
  gkPositioning?: number;
  gkReflexes?: number;
  gkKicking?: number;
}

export interface PlayerPhysicalFacts {
  heightCm?: number;
  weightKg?: number;
  /** Shooting hand when known. */
  preferredHand?: "L" | "R" | "left" | "right";
  /** @deprecated Prefer preferredHand. */
  preferredFoot?: "L" | "R" | "left" | "right";
}

export interface PlayerRecord extends PlayerAttributes, PlayerPhysicalFacts {
  id: string;
  name: string;
  displayName: string;
  primaryPosition: PositionCode;
  secondaryPositions: PositionCode[];
  overall?: number;
  age?: number;
  appearance?: AppearanceData;
}

export interface RatingOverride extends Partial<PlayerAttributes> {
  overall?: number;
}

export interface TeamKit {
  shirt: string;
  shorts: string;
  socks: string;
  trim?: string;
  numberColor?: string;
  /**
   * Optional shirt wrap texture (e.g. /assets/kits/{teamId}_home.png).
   * Drop-in community kit PNGs are drawn onto the player torso/arms.
   */
  shirtAsset?: string | null;
}

/** Prematch kit picker: auto follows clash rules; home/away force that strip. */
export type KitChoice = "auto" | "home" | "away";

export interface TeamRecord {
  id: string;
  name: string;
  abbreviation: string;
  teamType: TeamType;
  city?: string;
  primaryColor: string;
  secondaryColor: string;
  /** Optional crest / emblem URL (e.g. /assets/crests/plymouth_argyle.png). */
  badgeAsset?: string | null;
  defaultKit: TeamKit;
  /** Change kit used when home colours clash with the opponent. */
  awayKit?: TeamKit;
  goalkeeperKit: TeamKit;
  defaultStadiumId: string;
  defaultFormation: string;
  /** NBA conference for current franchises. */
  conference?: Conference;
  /** @deprecated Prefer conference — still read for East/West grouping. */
  league?: Conference | string;
  /** Historic season label (e.g. 1995/96) for Classic eras. */
  historicSeason?: string;
  /** Current franchise id for Classic teams (links Era dial to East/West clubs). */
  franchiseId?: string;
  fanTeam?: boolean;
  custom?: boolean;
}

export interface TeamMembership {
  playerId: string;
  teamId: string;
  shirtNumber: number;
  squadRole: "FIRST_TEAM" | "BENCH" | "YOUTH" | "LEGEND" | "FAN" | "STORY";
  captain?: boolean;
  from?: string;
  to?: string | null;
  ratingOverride?: RatingOverride;
}

export interface LineupSlot {
  playerId: string;
  slot: string;
  /** Optional nudge from formation default along pitch length (0–1 space). */
  offsetX?: number;
  /** Optional nudge from formation default along pitch width (−0.5–0.5 space). */
  offsetZ?: number;
}

export interface LineupRecord {
  id: string;
  teamId: string;
  formation: string;
  starters: LineupSlot[];
  /**
   * Optional team play-style override for this lineup.
   * Absent / null = Auto (derive from strength / league at kick-off).
   */
  playStyle?: "possession" | "balanced" | "counter" | "direct" | "routeOne" | null;
}

export interface FixtureRecord {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string;
  competition: string;
  date: string;
  time: string;
  durationSeconds: number;
  homeLineupId?: string;
  awayLineupId?: string;
  gameplayModeDefault?: "REAL" | "ARCADE";
  timeOfDay?: "DAY" | "EVENING" | "NIGHT";
  weather?: "SUNNY" | "MILD" | "RAINY" | "SNOWY";
  played?: boolean;
  homeScore?: number;
  awayScore?: number;
  simulated?: boolean;
  official?: boolean;
  /** ESPN season phase — standings count regular only. */
  seasonPhase?: "preseason" | "regular" | "postseason";
  /** Closing sportsbook favorite (ESPN / DraftKings), when available. */
  oddsFavorite?: "HOME" | "AWAY";
  /** Home point spread (negative = home favored). */
  oddsSpread?: number;
  oddsMoneylineHome?: number;
  oddsMoneylineAway?: number;
  oddsProvider?: string;
}

export interface CrowdSectionRecord {
  id: string;
  support: CrowdSupport;
  stand: "north" | "south" | "east" | "west";
  density: number;
}

export interface ScoreboardConfig {
  type: ScoreboardType;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
}

export interface StadiumRecord {
  id: string;
  name: string;
  venueType: VenueType;
  pitchLength: number;
  pitchWidth: number;
  standConfiguration: "four" | "one" | "none" | "deluxe";
  crowdCapacity: number;
  crowdSections: CrowdSectionRecord[];
  scoreboard: ScoreboardConfig;
  floodlights: boolean;
  tunnel: boolean;
  benches: boolean;
  advertisingSetId: string;
  environment: "urban" | "park" | "historic";
  lightingPreset: "DAY" | "EVENING_FLOODLIGHT" | "NIGHT";
  crowdDensity: number;
  audioProfile: string;
}

export interface AdvertisingBoardRecord {
  board: number;
  image?: string;
  label: string;
  color: string;
  textColor?: string;
}

export interface StoryChapter {
  type: "football" | "arcade" | "world";
  opponent?: string;
  levels?: string[];
  location?: string;
}

export interface StoryRecord {
  storyId: string;
  homeTeam: string;
  chapters: StoryChapter[];
}
