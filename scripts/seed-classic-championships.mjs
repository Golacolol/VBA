/**
 * Merge newly authored championship classic eras into public/data without
 * wiping current ESPN rosters.
 *
 * Usage: node scripts/seed-classic-championships.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NBA_TEAMS, kit, shortDisplayName } from "./lib/nbaTeams.mjs";
import { CLASSIC_ERAS } from "./lib/nbaClassicEras.mjs";
import { classicAttrsFor } from "./lib/nbaClassicRatings.mjs";
import {
  espnHeadshotUrl,
  espnIdForName,
  localPortraitForName,
  nbaHeadshotUrl,
  nbaIdForName,
} from "./lib/nbaClassicHeadshots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");
const emblemsDir = path.join(root, "public", "assets", "emblems");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(outDir, name), "utf8"));
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${name}`);
}

function asArray(data) {
  return Array.isArray(data) ? data : Object.values(data);
}

function emblemFor(teamId) {
  const svg = path.join(emblemsDir, `${teamId}.svg`);
  const png = path.join(emblemsDir, `${teamId}.png`);
  if (fs.existsSync(svg)) return `/assets/emblems/${teamId}.svg`;
  if (fs.existsSync(png)) return `/assets/emblems/${teamId}.png`;
  return null;
}

function portraitFor(name) {
  const local = localPortraitForName(name);
  if (local) return local;
  const nbaId = nbaIdForName(name);
  if (nbaId != null) return nbaHeadshotUrl(nbaId);
  const espnId = espnIdForName(name);
  if (espnId != null) return espnHeadshotUrl(espnId);
  return null;
}

function ensureArena(stadiums, franchise) {
  const list = asArray(stadiums);
  const id = `${franchise.id}_arena`;
  if (list.some((s) => s.id === id)) return { stadiums: list, stadiumId: id };
  list.push({
    id,
    name: franchise.arena,
    venueType: "NBA_ARENA",
    pitchLength: 28.65,
    pitchWidth: 15.24,
    standConfiguration: "four",
    crowdCapacity: 18000,
    crowdSections: [
      { id: `${id}_n`, support: "HOME", stand: "north", density: 0.85 },
      { id: `${id}_s`, support: "HOME", stand: "south", density: 0.8 },
      { id: `${id}_e`, support: "NEUTRAL", stand: "east", density: 0.7 },
      { id: `${id}_w`, support: "AWAY", stand: "west", density: 0.55 },
    ],
    scoreboard: { type: "LED_VIDEO_SCREEN", position: [0, 11.5, 0], rotation: [0, 0, 0], width: 6.4, height: 4.0 },
    floodlights: true,
    tunnel: true,
    benches: true,
    advertisingSetId: "nba_default",
    environment: "urban",
    lightingPreset: "EVENING_FLOODLIGHT",
    crowdDensity: 0.8,
    audioProfile: "arena",
  });
  return { stadiums: list, stadiumId: id };
}

function main() {
  let teams = asArray(readJson("teams.json"));
  let players = asArray(readJson("players.json"));
  let memberships = asArray(readJson("teamMemberships.json"));
  let lineups = asArray(readJson("lineups.json"));
  let stadiums = asArray(readJson("stadiums.json"));

  const existingTeamIds = new Set(teams.map((t) => t.id));
  const existingPlayerIds = new Set(players.map((p) => p.id));
  let addedTeams = 0;
  let addedPlayers = 0;

  for (const era of CLASSIC_ERAS) {
    if (existingTeamIds.has(era.id)) {
      console.log(`skip existing ${era.id}`);
      continue;
    }
    const franchise = NBA_TEAMS.find((x) => x.id === era.franchiseId);
    if (!franchise) {
      console.warn(`missing franchise ${era.franchiseId} for ${era.id}`);
      continue;
    }
    const arena = ensureArena(stadiums, franchise);
    stadiums = arena.stadiums;
    const look = era.historicLook || {};
    const primary = look.primary || franchise.primary;
    const secondary = look.secondary || franchise.secondary;
    const badge = look.badgeAsset || emblemFor(franchise.id);
    teams.push({
      id: era.id,
      name: era.name,
      abbreviation: String(look.abbr || franchise.abbr).toUpperCase(),
      teamType: "HISTORIC_TEAM",
      city: look.city || franchise.city,
      primaryColor: primary,
      secondaryColor: secondary,
      badgeAsset: badge,
      defaultKit: kit(primary, secondary),
      awayKit: kit(secondary, primary),
      goalkeeperKit: kit("#222222", primary),
      defaultStadiumId: arena.stadiumId,
      defaultFormation: "BASKETBALL_5",
      conference: franchise.conference,
      league: franchise.conference,
      historicSeason: era.season,
      franchiseId: franchise.id,
    });
    existingTeamIds.add(era.id);
    addedTeams += 1;

    const all = [...era.starters, ...era.bench];
    const starterIds = [];
    all.forEach((p, i) => {
      const playerId = `${era.id}_p${String(i + 1).padStart(2, "0")}`;
      if (existingPlayerIds.has(playerId)) return;
      const isStarter = i < era.starters.length;
      const attrs = classicAttrsFor(p.pos, p.name, { role: isStarter ? "starter" : "bench" });
      const portrait = portraitFor(p.name);
      players.push({
        id: playerId,
        name: shortDisplayName(p.name),
        displayName: p.name,
        primaryPosition: p.pos,
        secondaryPositions: Array.isArray(p.sec) ? p.sec : [],
        age: 28,
        heightCm: p.pos === "C" ? 213 : p.pos === "PG" ? 188 : 201,
        weightKg: p.pos === "C" ? 110 : 95,
        preferredHand: "R",
        preferredFoot: "R",
        appearance: {
          fullName: p.name,
          ...(portrait ? { portraitAsset: portrait } : {}),
        },
        ...attrs,
      });
      existingPlayerIds.add(playerId);
      addedPlayers += 1;
      memberships.push({
        playerId,
        teamId: era.id,
        shirtNumber: Number.isFinite(Number(p.number)) ? Number(p.number) : i + 1,
        squadRole: isStarter ? "FIRST_TEAM" : "BENCH",
        captain: i === 0,
      });
      if (isStarter) starterIds.push({ playerId, slot: p.pos });
    });
    lineups.push({
      id: `${era.id}_lineup`,
      teamId: era.id,
      formation: "BASKETBALL_5",
      starters: starterIds,
    });
    console.log(`seeded ${era.id} (${all.length} players)`);
  }

  writeJson("teams.json", teams);
  writeJson("players.json", players);
  writeJson("teamMemberships.json", memberships);
  writeJson("lineups.json", lineups);
  writeJson("stadiums.json", stadiums);
  console.log(`Done: +${addedTeams} teams, +${addedPlayers} players`);
}

main();
