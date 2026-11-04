/**
 * Pull live ESPN NBA rosters + season stats → basketball PlayerAttributes.
 * Also seeds curated classic eras and wires emblem badgeAsset paths.
 *
 * Usage: node scripts/refresh-nba-rosters.mjs [--skip-stats] [--skip-classics] [--skip-emblems]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NBA_TEAMS, kit, mapEspnPosition, shortDisplayName } from "./lib/nbaTeams.mjs";
import { CLASSIC_ERAS } from "./lib/nbaClassicEras.mjs";
import { classicAttrsFor } from "./lib/nbaClassicRatings.mjs";
import {
  compressUncategorizedOvr,
  currentAttrsFor,
  currentOvrFor,
} from "./lib/nbaCurrentRatings.mjs";
import {
  pickPreferredStarters,
  positionOverrideFor,
} from "./lib/nbaRosterOverrides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");
const emblemsDir = path.join(root, "public", "assets", "emblems");

const skipStats = process.argv.includes("--skip-stats");
const skipClassics = process.argv.includes("--skip-classics");
const skipEmblems = process.argv.includes("--skip-emblems");

const SITE_ROSTER = (espnId) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnId}/roster`;
const CORE_STATS = (season, athleteId) =>
  `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${season}/types/2/athletes/${athleteId}/statistics/0`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function lerpStat(value, lo, hi, outLo = 45, outHi = 95) {
  if (!Number.isFinite(value)) return Math.round((outLo + outHi) / 2);
  const t = (value - lo) / Math.max(1e-6, hi - lo);
  return clamp(outLo + t * (outHi - outLo), 1, 99);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "VORTEX-Basketball/0.5 (roster refresh)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function flattenStats(payload) {
  const flat = {};
  for (const cat of payload?.splits?.categories || []) {
    for (const s of cat.stats || []) {
      if (typeof s.value === "number") flat[s.name] = s.value;
    }
  }
  return flat;
}

async function loadAthleteStats(athleteId, seasons) {
  let best = { season: null, flat: {}, score: -1 };
  for (const season of seasons) {
    try {
      const data = await fetchJson(CORE_STATS(season, athleteId));
      const flat = flattenStats(data);
      const score = (flat.avgMinutes ?? 0) * 10 + (flat.avgPoints ?? 0);
      if (Object.keys(flat).length && score > best.score) {
        best = { season, flat, score };
        // Full-season sample (≥20 mpg) is good enough — stop early.
        if ((flat.avgMinutes ?? 0) >= 20) {
          await sleep(40);
          return best;
        }
      }
    } catch {
      /* try next season */
    }
    await sleep(40);
  }
  return best;
}

/**
 * Map ESPN counting / shooting splits onto 1–100 basketball attributes.
 * Public box-score rates are imperfect proxies — position priors fill gaps.
 */
function attrsFromStats(flat, position, heightIn, weightLbs) {
  const h = Number(heightIn) || 78;
  const w = Number(weightLbs) || 210;
  const min = flat.avgMinutes ?? 0;
  const pts = flat.avgPoints ?? 0;
  const ast = flat.avgAssists ?? 0;
  const reb = flat.avgRebounds ?? 0;
  const stl = flat.avgSteals ?? 0;
  const blk = flat.avgBlocks ?? 0;
  const tov = flat.avgTurnovers ?? 1.5;
  const fg = flat.fieldGoalPct ?? 45;
  const twop = flat.twoPointFieldGoalPct ?? fg;
  const thr = flat.threePointPct ?? flat.threePointFieldGoalPct ?? 34;
  const ft = flat.freeThrowPct ?? 75;
  const ts = flat.trueShootingPct ?? 55;
  const per = flat.PER ?? 12;
  const played = min >= 8 || pts >= 4;

  const posPriors = {
    PG: { finishing: 72, midRange: 70, threePoint: 74, ballHandle: 82, passAccuracy: 84, perimeterD: 72, interiorD: 55, rebound: 52, steal: 72, block: 48, speed: 84, vertical: 70, strength: 62 },
    SG: { finishing: 76, midRange: 76, threePoint: 78, ballHandle: 76, passAccuracy: 70, perimeterD: 74, interiorD: 58, rebound: 55, steal: 72, block: 50, speed: 80, vertical: 74, strength: 66 },
    SF: { finishing: 76, midRange: 72, threePoint: 72, ballHandle: 72, passAccuracy: 68, perimeterD: 74, interiorD: 68, rebound: 68, steal: 70, block: 60, speed: 76, vertical: 78, strength: 72 },
    PF: { finishing: 78, midRange: 68, threePoint: 62, ballHandle: 62, passAccuracy: 64, perimeterD: 64, interiorD: 78, rebound: 80, steal: 58, block: 72, speed: 68, vertical: 80, strength: 82 },
    C: { finishing: 80, midRange: 58, threePoint: 48, ballHandle: 52, passAccuracy: 58, perimeterD: 55, interiorD: 84, rebound: 86, steal: 52, block: 82, speed: 58, vertical: 84, strength: 88 },
  };
  const prior = posPriors[position] || posPriors.SF;

  const finishing = played
    ? clamp(0.45 * lerpStat(fg, 38, 58) + 0.35 * lerpStat(pts, 4, 28) + 0.2 * prior.finishing, 40, 98)
    : prior.finishing;
  const midRange = played
    ? clamp(0.55 * lerpStat(twop, 40, 62) + 0.25 * lerpStat(ts, 48, 65) + 0.2 * prior.midRange, 40, 96)
    : prior.midRange;
  const threePoint = played
    ? clamp(0.7 * lerpStat(thr, 28, 42) + 0.3 * prior.threePoint, 35, 98)
    : prior.threePoint;
  const freeThrow = played ? clamp(0.85 * lerpStat(ft, 60, 92) + 0.15 * prior.finishing, 40, 98) : lerpStat(ft, 60, 92);
  const ballHandle = played
    ? clamp(0.4 * lerpStat(ast, 0.5, 9) + 0.25 * lerpStat(pts, 4, 28) + 0.2 * lerpStat(15 - tov, 8, 14) + 0.15 * prior.ballHandle, 40, 97)
    : prior.ballHandle;
  const passAccuracy = played
    ? clamp(0.55 * lerpStat(ast, 0.5, 10) + 0.25 * lerpStat(ast / Math.max(0.5, tov), 0.6, 3.5, 45, 94) + 0.2 * prior.passAccuracy, 40, 97)
    : prior.passAccuracy;
  const perimeterD = played
    ? clamp(0.55 * lerpStat(stl, 0.2, 2.0) + 0.25 * lerpStat(min, 10, 36) + 0.2 * prior.perimeterD, 40, 96)
    : prior.perimeterD;
  const interiorD = played
    ? clamp(0.5 * lerpStat(blk, 0.1, 2.4) + 0.3 * lerpStat(reb, 2, 12) + 0.2 * prior.interiorD, 40, 97)
    : prior.interiorD;
  const rebound = played ? clamp(0.7 * lerpStat(reb, 1.5, 13) + 0.3 * prior.rebound, 40, 98) : prior.rebound;
  const steal = played ? clamp(0.75 * lerpStat(stl, 0.2, 2.2) + 0.25 * prior.steal, 40, 96) : prior.steal;
  const block = played ? clamp(0.75 * lerpStat(blk, 0.1, 2.6) + 0.25 * prior.block, 40, 97) : prior.block;
  const speed = clamp(prior.speed + (h <= 74 ? 6 : h >= 82 ? -8 : 0) + (played ? lerpStat(min, 12, 34, -2, 4) - 2 : 0), 40, 97);
  const vertical = clamp(0.45 * prior.vertical + 0.3 * lerpStat(h, 72, 84, 55, 90) + 0.25 * block, 45, 97);
  const strength = clamp(0.5 * prior.strength + 0.5 * lerpStat(w, 175, 265, 55, 92), 45, 97);
  const stamina = played ? lerpStat(min, 12, 36, 58, 94) : clamp(prior.speed - 8, 50, 85);
  const iq = played
    ? clamp(0.4 * lerpStat(per, 8, 28) + 0.35 * passAccuracy + 0.25 * prior.passAccuracy, 45, 97)
    : clamp(prior.passAccuracy - 2, 50, 90);
  const clutch = clamp(0.45 * iq + 0.35 * freeThrow + 0.2 * lerpStat(per, 10, 27, 50, 92), 45, 97);

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
    acceleration: clamp(speed + 2, 40, 98),
    vertical,
    strength,
    stamina,
    iq,
    clutch,
    pace: speed,
    passing: passAccuracy,
    longPassing: passAccuracy,
    vision: iq,
    control: ballHandle,
    dribbling: ballHandle,
    shooting: finishing,
    shotPower: clamp(finishing + 2, 40, 98),
    longShots: threePoint,
    defending: clamp((perimeterD + interiorD) / 2, 40, 97),
    composure: clutch,
    jumping: vertical,
  };
}

function classicAttrs(pos, name, r, role = "starter") {
  return classicAttrsFor(pos, name, { role, jitter: r });
}

function emblemFor(teamId) {
  const svg = path.join(emblemsDir, `${teamId}.svg`);
  const png = path.join(emblemsDir, `${teamId}.png`);
  if (fs.existsSync(svg)) return `/assets/emblems/${teamId}.svg`;
  if (fs.existsSync(png)) return `/assets/emblems/${teamId}.png`;
  return null;
}

function writeJson(name, data) {
  const file = path.join(outDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${name}`);
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

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (!skipEmblems) {
    console.log("Importing emblems…");
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [path.join(root, "scripts", "import-nba-emblems.mjs")], {
      stdio: "inherit",
    });
    if (r.status !== 0) console.warn("Emblem import finished with errors — continuing");
  }

  // Detect season year from first roster payload; try current then prior for stats.
  const probe = await fetchJson(SITE_ROSTER(NBA_TEAMS[0].espnId));
  const seasonYear = probe?.season?.year ?? new Date().getFullYear();
  const seasonLabel = probe?.season?.displayName ?? `${seasonYear - 1}-${String(seasonYear).slice(2)}`;
  // Prefer the last completed season (full sample), then prior, then in-progress.
  const statsSeasons = [seasonYear - 2, seasonYear - 1, seasonYear];
  console.log(`Season ${seasonLabel} (stats try ${statsSeasons.join(", ")})`);

  const teams = [];
  const stadiums = [];
  const players = [];
  const memberships = [];
  const lineups = [];
  const STARTER_SLOTS = ["PG", "SG", "SF", "PF", "C"];

  for (const t of NBA_TEAMS) {
    const stadiumId = `${t.id}_arena`;
    const badge = emblemFor(t.id);
    teams.push({
      id: t.id,
      name: t.name,
      abbreviation: t.abbr.toUpperCase(),
      teamType: "CURRENT_TEAM",
      city: t.city,
      primaryColor: t.primary,
      secondaryColor: t.secondary,
      badgeAsset: badge,
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

    process.stdout.write(`${t.abbr.toUpperCase()} roster… `);
    let athletes = [];
    try {
      const roster = await fetchJson(SITE_ROSTER(t.espnId));
      athletes = roster.athletes || [];
    } catch (err) {
      console.warn(`FAILED ${err.message}`);
      continue;
    }
    console.log(`${athletes.length} athletes`);

    const squad = [];
    for (const a of athletes) {
      const heightIn = a.height || 78;
      const displayName = a.displayName || a.fullName;
      const pos = positionOverrideFor(displayName) || mapEspnPosition(a.position?.abbreviation, heightIn);
      let flat = {};
      if (!skipStats) {
        const loaded = await loadAthleteStats(a.id, statsSeasons);
        flat = loaded.flat;
        await sleep(35);
      }
      const statsAttrs = attrsFromStats(flat, pos, heightIn, a.weight);
      // Curated current OVRs for stars; soft-cap inflated role-player stats maps.
      // Classic eras are seeded separately and never pass through this path.
      const curated = currentOvrFor(displayName);
      let attrs;
      if (curated != null) {
        attrs = currentAttrsFor(pos, displayName, curated);
      } else {
        const provisional = Math.round(
          (statsAttrs.finishing + statsAttrs.midRange + statsAttrs.threePoint + statsAttrs.ballHandle +
            statsAttrs.perimeterD + statsAttrs.interiorD + statsAttrs.iq + statsAttrs.stamina) / 8,
        );
        const target = compressUncategorizedOvr(provisional);
        attrs = target !== provisional ? currentAttrsFor(pos, displayName, target) : { ...statsAttrs, overall: provisional };
      }
      const playerId = `espn_${a.id}`;
      const heightCm = Math.round(heightIn * 2.54);
      const weightKg = Math.round((Number(a.weight) || 210) * 0.453592);
      players.push({
        id: playerId,
        name: shortDisplayName(displayName),
        displayName,
        primaryPosition: pos,
        secondaryPositions: [],
        age: a.age,
        heightCm,
        weightKg,
        preferredHand: "R",
        preferredFoot: "R",
        appearance: {
          portraitAsset: a.headshot?.href || null,
          fullName: a.fullName || a.displayName,
          birthplace: a.birthPlace ? [a.birthPlace.city, a.birthPlace.state, a.birthPlace.country].filter(Boolean).join(", ") : undefined,
          heightScale: clamp(0.88 + ((heightCm - 180) / 55) * 0.28, 0.88, 1.2),
        },
        ...attrs,
      });
      const jersey = Number.parseInt(String(a.jersey ?? ""), 10);
      memberships.push({
        playerId,
        teamId: t.id,
        shirtNumber: Number.isFinite(jersey) ? jersey : 0,
        squadRole: "FIRST_TEAM",
        captain: false,
      });
      squad.push({
        playerId,
        name: displayName,
        pos,
        min: flat.avgMinutes ?? 0,
        pts: flat.avgPoints ?? 0,
      });
      await sleep(15);
    }

    // Preferred curated fives when authored; otherwise minutes/points per slot.
    const starters = pickPreferredStarters(t.id, squad, STARTER_SLOTS);
    // Mark bench
    for (const m of memberships.filter((x) => x.teamId === t.id)) {
      if (!starters.some((s) => s.playerId === m.playerId)) m.squadRole = "BENCH";
    }
    if (starters[0]) {
      const cap = memberships.find((m) => m.playerId === starters[0].playerId && m.teamId === t.id);
      if (cap) cap.captain = true;
    }
    lineups.push({
      id: `${t.id}_lineup`,
      teamId: t.id,
      formation: "BASKETBALL_5",
      starters,
    });
  }

  // Shared fallback arena for MiTeam / unknown venue ids.
  if (!stadiums.some((s) => s.id === "vortex_arena")) {
    stadiums.push({
      id: "vortex_arena",
      name: "VORTEX Arena",
      venueType: "NBA_ARENA",
      pitchLength: 28.65,
      pitchWidth: 15.24,
      standConfiguration: "four",
      crowdCapacity: 16000,
      crowdSections: [
        { id: "vortex_arena_n", support: "HOME", stand: "north", density: 0.85 },
        { id: "vortex_arena_s", support: "HOME", stand: "south", density: 0.8 },
        { id: "vortex_arena_e", support: "NEUTRAL", stand: "east", density: 0.7 },
        { id: "vortex_arena_w", support: "AWAY", stand: "west", density: 0.55 },
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
  }

  if (!skipClassics) {
    console.log("Seeding classic eras…");
    for (const era of CLASSIC_ERAS) {
      const franchise = NBA_TEAMS.find((x) => x.id === era.franchiseId);
      if (!franchise) continue;
      const r = rng(hash(era.id));
      const stadiumId = `${franchise.id}_arena`;
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
        defaultStadiumId: stadiumId,
        defaultFormation: "BASKETBALL_5",
        conference: franchise.conference,
        league: franchise.conference,
        historicSeason: era.season,
        franchiseId: franchise.id,
      });
      const all = [...era.starters, ...era.bench];
      const starterIds = [];
      all.forEach((p, i) => {
        const playerId = `${era.id}_p${String(i + 1).padStart(2, "0")}`;
        const isStarter = i < era.starters.length;
        const attrs = classicAttrs(p.pos, p.name, r, isStarter ? "starter" : "bench");
        players.push({
          id: playerId,
          name: shortDisplayName(p.name),
          displayName: p.name,
          primaryPosition: p.pos,
          secondaryPositions: [],
          age: 28,
          heightCm: p.pos === "C" ? 213 : p.pos === "PG" ? 188 : 201,
          weightKg: p.pos === "C" ? 110 : 95,
          preferredHand: "R",
          preferredFoot: "R",
          appearance: { fullName: p.name },
          ...attrs,
        });
        memberships.push({
          playerId,
          teamId: era.id,
          // Keep jersey 0 — `Number(0) || fallback` incorrectly becomes 1.
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
    }
  }

  // Keep existing fixtures if present; otherwise thin stub.
  let fixtures = [];
  const fixturesPath = path.join(outDir, "fixtures.json");
  if (fs.existsSync(fixturesPath)) {
    try {
      fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
      // Drop fixtures pointing at removed football teams
      const teamIds = new Set(teams.map((t) => t.id));
      fixtures = fixtures.filter((f) => teamIds.has(f.homeTeamId) && teamIds.has(f.awayTeamId));
    } catch {
      fixtures = [];
    }
  }

  writeJson("teams.json", teams);
  writeJson("players.json", players);
  writeJson("teamMemberships.json", memberships);
  writeJson("lineups.json", lineups);
  writeJson("stadiums.json", stadiums);
  if (fixtures.length) writeJson("fixtures.json", fixtures);
  writeJson("nba/rosters-current.json", {
    season: seasonLabel,
    generatedAt: new Date().toISOString(),
    teams: NBA_TEAMS.map((t) => t.id),
    playerCount: players.filter((p) => p.id.startsWith("espn_")).length,
    classicCount: skipClassics ? 0 : CLASSIC_ERAS.length,
  });

  console.log(
    `Done: ${teams.length} teams, ${players.length} players, ${memberships.length} memberships, ${lineups.length} lineups`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
