/**
 * Replace football club packs with a Phase-1 NBA seed:
 * 30 franchises, stub rosters (13 players), BASKETBALL_5 lineups, arenas, thin schedule.
 *
 * Usage: node scripts/generate-nba-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");

/** @type {{ id: string, name: string, abbreviation: string, city: string, conference: "EAST"|"WEST", primary: string, secondary: string, arena: string }[]} */
const TEAMS = [
  { id: "nba_atl", name: "Atlanta Hawks", abbreviation: "ATL", city: "Atlanta", conference: "EAST", primary: "#E03A3E", secondary: "#C1D32F", arena: "State Farm Arena" },
  { id: "nba_bos", name: "Boston Celtics", abbreviation: "BOS", city: "Boston", conference: "EAST", primary: "#007A33", secondary: "#BA9653", arena: "TD Garden" },
  { id: "nba_bkn", name: "Brooklyn Nets", abbreviation: "BKN", city: "Brooklyn", conference: "EAST", primary: "#000000", secondary: "#FFFFFF", arena: "Barclays Center" },
  { id: "nba_cha", name: "Charlotte Hornets", abbreviation: "CHA", city: "Charlotte", conference: "EAST", primary: "#1D1160", secondary: "#00788C", arena: "Spectrum Center" },
  { id: "nba_chi", name: "Chicago Bulls", abbreviation: "CHI", city: "Chicago", conference: "EAST", primary: "#CE1141", secondary: "#000000", arena: "United Center" },
  { id: "nba_cle", name: "Cleveland Cavaliers", abbreviation: "CLE", city: "Cleveland", conference: "EAST", primary: "#860038", secondary: "#FDBB30", arena: "Rocket Mortgage FieldHouse" },
  { id: "nba_det", name: "Detroit Pistons", abbreviation: "DET", city: "Detroit", conference: "EAST", primary: "#C8102E", secondary: "#1D42BA", arena: "Little Caesars Arena" },
  { id: "nba_ind", name: "Indiana Pacers", abbreviation: "IND", city: "Indiana", conference: "EAST", primary: "#002D62", secondary: "#FDBB30", arena: "Gainbridge Fieldhouse" },
  { id: "nba_mia", name: "Miami Heat", abbreviation: "MIA", city: "Miami", conference: "EAST", primary: "#98002E", secondary: "#F9A01B", arena: "Kaseya Center" },
  { id: "nba_mil", name: "Milwaukee Bucks", abbreviation: "MIL", city: "Milwaukee", conference: "EAST", primary: "#00471B", secondary: "#EEE1C6", arena: "Fiserv Forum" },
  { id: "nba_nyk", name: "New York Knicks", abbreviation: "NYK", city: "New York", conference: "EAST", primary: "#006BB6", secondary: "#F58426", arena: "Madison Square Garden" },
  { id: "nba_orl", name: "Orlando Magic", abbreviation: "ORL", city: "Orlando", conference: "EAST", primary: "#0077C0", secondary: "#C4CED4", arena: "Kia Center" },
  { id: "nba_phi", name: "Philadelphia 76ers", abbreviation: "PHI", city: "Philadelphia", conference: "EAST", primary: "#006BB6", secondary: "#ED174C", arena: "Wells Fargo Center" },
  { id: "nba_tor", name: "Toronto Raptors", abbreviation: "TOR", city: "Toronto", conference: "EAST", primary: "#CE1141", secondary: "#000000", arena: "Scotiabank Arena" },
  { id: "nba_was", name: "Washington Wizards", abbreviation: "WAS", city: "Washington", conference: "EAST", primary: "#002B5C", secondary: "#E31837", arena: "Capital One Arena" },
  { id: "nba_dal", name: "Dallas Mavericks", abbreviation: "DAL", city: "Dallas", conference: "WEST", primary: "#00538C", secondary: "#002B5E", arena: "American Airlines Center" },
  { id: "nba_den", name: "Denver Nuggets", abbreviation: "DEN", city: "Denver", conference: "WEST", primary: "#0E2240", secondary: "#FEC524", arena: "Ball Arena" },
  { id: "nba_gsw", name: "Golden State Warriors", abbreviation: "GSW", city: "San Francisco", conference: "WEST", primary: "#1D428A", secondary: "#FFC72C", arena: "Chase Center" },
  { id: "nba_hou", name: "Houston Rockets", abbreviation: "HOU", city: "Houston", conference: "WEST", primary: "#CE1141", secondary: "#000000", arena: "Toyota Center" },
  { id: "nba_lac", name: "LA Clippers", abbreviation: "LAC", city: "Los Angeles", conference: "WEST", primary: "#C8102E", secondary: "#1D428A", arena: "Intuit Dome" },
  { id: "nba_lal", name: "Los Angeles Lakers", abbreviation: "LAL", city: "Los Angeles", conference: "WEST", primary: "#552583", secondary: "#FDB927", arena: "Crypto.com Arena" },
  { id: "nba_mem", name: "Memphis Grizzlies", abbreviation: "MEM", city: "Memphis", conference: "WEST", primary: "#5D76A9", secondary: "#12173F", arena: "FedExForum" },
  { id: "nba_min", name: "Minnesota Timberwolves", abbreviation: "MIN", city: "Minnesota", conference: "WEST", primary: "#0C2340", secondary: "#236192", arena: "Target Center" },
  { id: "nba_nop", name: "New Orleans Pelicans", abbreviation: "NOP", city: "New Orleans", conference: "WEST", primary: "#0C2340", secondary: "#C8102E", arena: "Smoothie King Center" },
  { id: "nba_okc", name: "Oklahoma City Thunder", abbreviation: "OKC", city: "Oklahoma City", conference: "WEST", primary: "#007AC1", secondary: "#EF3B24", arena: "Paycom Center" },
  { id: "nba_phx", name: "Phoenix Suns", abbreviation: "PHX", city: "Phoenix", conference: "WEST", primary: "#1D1160", secondary: "#E56020", arena: "Mortgage Matchup Center" },
  { id: "nba_por", name: "Portland Trail Blazers", abbreviation: "POR", city: "Portland", conference: "WEST", primary: "#E03A3E", secondary: "#000000", arena: "Moda Center" },
  { id: "nba_sac", name: "Sacramento Kings", abbreviation: "SAC", city: "Sacramento", conference: "WEST", primary: "#5A2D81", secondary: "#63727A", arena: "Golden 1 Center" },
  { id: "nba_sas", name: "San Antonio Spurs", abbreviation: "SAS", city: "San Antonio", conference: "WEST", primary: "#C4CED4", secondary: "#000000", arena: "Frost Bank Center" },
  { id: "nba_uta", name: "Utah Jazz", abbreviation: "UTA", city: "Utah", conference: "WEST", primary: "#002B5C", secondary: "#00471B", arena: "Delta Center" },
];

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const STARTER_SLOTS = ["PG", "SG", "SF", "PF", "C"];
const FIRST_NAMES = [
  "Jaylen", "Marcus", "Devin", "Jalen", "Tyrese", "Anthony", "Bam", "Karl", "Jayson", "Cade",
  "Paolo", "Scottie", "Franz", "Evan", "Desmond", "Austin", "Brandon", "Jordan", "Malik", "Naz",
];
const LAST_NAMES = [
  "Brooks", "Hayes", "Porter", "Reed", "Cole", "Vance", "Miles", "Quinn", "Drake", "Lane",
  "Ford", "Grant", "Blake", "Nash", "West", "Stone", "Cross", "Hunt", "Shaw", "Webb",
];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function kit(primary, secondary) {
  return {
    shirt: primary,
    shorts: secondary,
    socks: primary,
    trim: secondary,
    numberColor: secondary === "#FFFFFF" || secondary === "#EEE1C6" || secondary === "#C4CED4" ? "#111111" : "#FFFFFF",
  };
}

function playerAttrs(r, position) {
  const base = 68 + Math.floor(r() * 22);
  const speed = clamp(base + Math.floor(r() * 10) - (position === "C" ? 8 : 0), 55, 96);
  const finishing = clamp(base + Math.floor(r() * 12) - (position === "PG" ? 4 : 0), 55, 96);
  const threePoint = clamp(base + Math.floor(r() * 12) - (position === "C" ? 10 : 0) + (position === "SG" ? 6 : 0), 50, 96);
  const passAccuracy = clamp(base + Math.floor(r() * 10) + (position === "PG" ? 8 : 0), 55, 96);
  const perimeterD = clamp(base + Math.floor(r() * 10) + (position === "SG" || position === "SF" ? 4 : 0), 55, 96);
  const interiorD = clamp(base + Math.floor(r() * 10) + (position === "C" || position === "PF" ? 6 : 0), 55, 96);
  const rebound = clamp(base + Math.floor(r() * 10) + (position === "C" || position === "PF" ? 8 : -4), 50, 96);
  const strength = clamp(base + Math.floor(r() * 10) + (position === "C" ? 8 : 0), 55, 96);
  const ballHandle = clamp(base + Math.floor(r() * 10) + (position === "PG" ? 8 : 0) - (position === "C" ? 10 : 0), 50, 96);
  const midRange = clamp(blendish(finishing, threePoint) + Math.floor(r() * 6) - 3, 50, 95);
  const freeThrow = clamp(blendish(finishing, threePoint) + Math.floor(r() * 8) - 2, 50, 96);
  const iq = clamp(passAccuracy + Math.floor(r() * 8) - 2, 55, 96);
  const clutch = clamp(iq + Math.floor(r() * 8) - 4, 55, 96);
  const vertical = clamp(rebound + Math.floor(r() * 8) - 2, 55, 97);
  const steal = clamp(perimeterD + Math.floor(r() * 6) - 4, 50, 95);
  const block = clamp(interiorD + Math.floor(r() * 6) - 4, 50, 96);
  const stamina = clamp(70 + Math.floor(r() * 22), 60, 96);
  return {
    finishing,
    midRange,
    threePoint,
    freeThrow,
    ballHandle,
    passAccuracy,
    perimeterD,
    interiorD,
    rebound,
    steal,
    block,
    speed,
    acceleration: clamp(speed + Math.floor(r() * 6) - 2, 50, 97),
    vertical,
    strength,
    stamina,
    iq,
    clutch,
    // Football mirrors for leftover Match stub
    pace: speed,
    passing: passAccuracy,
    longPassing: passAccuracy,
    vision: iq,
    control: ballHandle,
    dribbling: ballHandle,
    shooting: finishing,
    shotPower: clamp(finishing + 2, 50, 97),
    longShots: threePoint,
    defending: Math.round((perimeterD + interiorD) / 2),
    composure: clutch,
    jumping: vertical,
  };
}

function blendish(a, b) {
  return Math.round((a + b) / 2);
}

function writeJson(name, data) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${name} (${Array.isArray(data) ? data.length : "object"})`);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(root, "public", "data", "nba"), { recursive: true });

  const teams = [];
  const stadiums = [];
  const players = [];
  const memberships = [];
  const lineups = [];

  for (const t of TEAMS) {
    const stadiumId = `${t.id}_arena`;
    teams.push({
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      teamType: "CURRENT_TEAM",
      city: t.city,
      primaryColor: t.primary,
      secondaryColor: t.secondary,
      badgeAsset: null,
      defaultKit: kit(t.primary, t.secondary),
      awayKit: kit(t.secondary, t.primary),
      goalkeeperKit: kit("#222222", t.primary),
      defaultStadiumId: stadiumId,
      defaultFormation: "BASKETBALL_5",
      conference: t.conference,
      league: t.conference,
    });
    stadiums.push({
      id: stadiumId,
      name: t.arena,
      venueType: "NBA_ARENA",
      pitchLength: 28.65,
      pitchWidth: 15.24,
      standConfiguration: "four",
      crowdCapacity: 18000,
      crowdSections: [
        { id: `${stadiumId}_n`, support: "HOME", stand: "north", density: 0.85 },
        { id: `${stadiumId}_s`, support: "HOME", stand: "south", density: 0.8 },
        { id: `${stadiumId}_e`, support: "NEUTRAL", stand: "east", density: 0.7 },
        { id: `${stadiumId}_w`, support: "AWAY", stand: "west", density: 0.55 },
      ],
      scoreboard: {
        type: "LED_VIDEO_SCREEN",
        position: [0, 11.5, 0],
        rotation: [0, 0, 0],
        width: 6.4,
        height: 4.0,
      },
      floodlights: true,
      tunnel: true,
      benches: true,
      advertisingSetId: "nba_default",
      environment: "urban",
      lightingPreset: "EVENING_FLOODLIGHT",
      crowdDensity: 0.8,
      audioProfile: "arena",
    });

    const r = rng(hash(t.id));
    const squadSize = 13;
    const usedNumbers = new Set();
    const squadPlayerIds = [];
    for (let i = 0; i < squadSize; i++) {
      const position = POSITIONS[i % POSITIONS.length];
      const fn = FIRST_NAMES[(hash(`${t.id}-${i}-f`) + i) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(hash(`${t.id}-${i}-l`) + i * 3) % LAST_NAMES.length];
      const playerId = `${t.id}_p${String(i + 1).padStart(2, "0")}`;
      let shirt = 1 + Math.floor(r() * 99);
      while (usedNumbers.has(shirt)) shirt = 1 + Math.floor(r() * 99);
      usedNumbers.add(shirt);
      const attrs = playerAttrs(r, position);
      players.push({
        id: playerId,
        name: `${fn[0]}. ${ln}`,
        displayName: `${fn} ${ln}`,
        primaryPosition: position,
        secondaryPositions: [],
        age: 21 + Math.floor(r() * 14),
        heightCm: position === "C" ? 208 + Math.floor(r() * 10) : position === "PG" ? 185 + Math.floor(r() * 10) : 195 + Math.floor(r() * 12),
        weightKg: 85 + Math.floor(r() * 30),
        preferredHand: "R",
        preferredFoot: "R",
        appearance: {},
        ...attrs,
      });
      memberships.push({
        playerId,
        teamId: t.id,
        shirtNumber: shirt,
        squadRole: i < 5 ? "FIRST_TEAM" : "BENCH",
        captain: i === 0,
      });
      squadPlayerIds.push(playerId);
    }

    lineups.push({
      id: `${t.id}_lineup`,
      teamId: t.id,
      formation: "BASKETBALL_5",
      starters: STARTER_SLOTS.map((slot, i) => ({
        playerId: squadPlayerIds[i],
        slot,
      })),
    });
  }

  // Fixtures come from ESPN via `scripts/refresh-nba-results.mjs` —
  // do not invent intra-conference stubs (they fight real scores/slate).
  const fixtures = [];

  const advertising = [
    { board: 1, label: "VORTEX", color: "#070b14", textColor: "#3ec6ff" },
    { board: 2, label: "VBA", color: "#1d428a", textColor: "#ffffff" },
  ];
  const stories = [];
  const officialOverlay = { results: [], updatedAt: new Date().toISOString(), source: "nba-seed" };

  writeJson("teams.json", teams);
  writeJson("players.json", players);
  writeJson("teamMemberships.json", memberships);
  writeJson("lineups.json", lineups);
  writeJson("stadiums.json", stadiums);
  writeJson("fixtures.json", fixtures);
  writeJson("advertising.json", advertising);
  writeJson("stories.json", stories);
  writeJson("officialResultsOverlay.json", officialOverlay);
  writeJson("nba/teams.json", teams);
  writeJson("nba/rosters-current.json", { season: "2025-26", generatedAt: new Date().toISOString(), teams: teams.map((t) => t.id) });

  console.log(`NBA seed ready: ${teams.length} teams, ${players.length} players, ${fixtures.length} fixtures`);
}

main();
