/**
 * Seed the in-game NBA schedule for one season from ESPN scoreboards.
 *
 * Writes a durable season CSV (pairings + tip-offs + scores when final) and
 * replaces public/data/fixtures.json with that season only — so standings /
 * "Play Next" never mix prior-year leftovers or invent fake pairings.
 *
 * Usage:
 *   node scripts/seed-nba-season-fixtures.mjs                 # current season
 *   node scripts/seed-nba-season-fixtures.mjs --season 2026-27
 *   node scripts/seed-nba-season-fixtures.mjs --season 2026-27 --csv-only
 *   node scripts/seed-nba-season-fixtures.mjs --from-csv public/data/nba/schedule-2026-27.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NBA_TEAMS } from "./lib/nbaTeams.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.join(root, "public", "data", "fixtures.json");
const overlayPath = path.join(root, "public", "data", "officialResultsOverlay.json");
const nbaDir = path.join(root, "public", "data", "nba");

const espnToTeam = new Map(NBA_TEAMS.map((t) => [t.espnId, t]));
const idToTeam = new Map(NBA_TEAMS.map((t) => [t.id, t]));

const TIP_ZONE = "Europe/London";
const ESPN_DAY_ZONE = "America/New_York";

function argValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function ymd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function eachDay(fromYmd, toYmd) {
  const out = [];
  const cur = new Date(
    Date.UTC(Number(fromYmd.slice(0, 4)), Number(fromYmd.slice(4, 6)) - 1, Number(fromYmd.slice(6, 8))),
  );
  const end = new Date(
    Date.UTC(Number(toYmd.slice(0, 4)), Number(toYmd.slice(4, 6)) - 1, Number(toYmd.slice(6, 8))),
  );
  while (cur <= end) {
    out.push(ymd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function partsInZone(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = get("hour") ?? "00";
  if (hour === "24") hour = "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${String(hour).padStart(2, "0")}:${get("minute") ?? "00"}`,
  };
}

function seasonBounds(season) {
  const m = String(season || "").match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!m) throw new Error(`Bad --season ${season}; expected YYYY-YY (e.g. 2026-27)`);
  const startYear = Number(m[1]);
  const endYear = m[2].length === 4 ? Number(m[2]) : 2000 + Number(m[2]);
  if (endYear !== startYear + 1) throw new Error(`Season end must be start+1 (${season})`);
  // Preseason tip-offs through end of regular season (playoffs filled later by refresh).
  return {
    season: `${startYear}-${String(endYear).slice(2)}`,
    fromYmd: `${startYear}1001`,
    toYmd: `${endYear}0415`,
    csvName: `schedule-${startYear}-${String(endYear).slice(2)}.csv`,
  };
}

function currentSeason(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const startYear = m >= 10 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

function seasonPhaseFromEspn(ev) {
  const slug = String(ev?.season?.slug || "").toLowerCase();
  if (slug.includes("pre")) return "preseason";
  if (slug.includes("post") || slug.includes("playoff")) return "postseason";
  if (slug.includes("regular")) return "regular";
  const type = Number(ev?.season?.type);
  if (type === 1) return "preseason";
  if (type === 3) return "postseason";
  return "regular";
}

function competitionFor(homeTeam) {
  return homeTeam.conference === "WEST" ? "Western Conference" : "Eastern Conference";
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows) {
  const header = [
    "id",
    "date",
    "time",
    "homeTeamId",
    "awayTeamId",
    "seasonPhase",
    "played",
    "homeScore",
    "awayScore",
    "espnDate",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.date,
        r.time,
        r.homeTeamId,
        r.awayTeamId,
        r.seasonPhase,
        r.played ? "1" : "0",
        r.homeScore ?? "",
        r.awayScore ?? "",
        r.espnDate ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    // Simple CSV (no nested commas in our fields).
    const cols = line.split(",");
    const get = (k) => (cols[idx[k]] ?? "").trim();
    const played = get("played") === "1" || get("played") === "true";
    const homeScore = get("homeScore");
    const awayScore = get("awayScore");
    rows.push({
      id: get("id"),
      date: get("date"),
      time: get("time") || "00:00",
      homeTeamId: get("homeTeamId"),
      awayTeamId: get("awayTeamId"),
      seasonPhase: get("seasonPhase") || "regular",
      played,
      homeScore: homeScore === "" ? undefined : Number(homeScore),
      awayScore: awayScore === "" ? undefined : Number(awayScore),
      espnDate: get("espnDate") || undefined,
    });
  }
  return rows;
}

function fixtureFromRow(row) {
  const home = idToTeam.get(row.homeTeamId);
  const away = idToTeam.get(row.awayTeamId);
  if (!home || !away) throw new Error(`Unknown team in schedule row ${row.id}`);
  const fixture = {
    id: row.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    venueId: `${home.id}_arena`,
    competition: competitionFor(home),
    date: row.date,
    time: row.time || "00:00",
    durationSeconds: 600,
    homeLineupId: `${home.id}_lineup`,
    awayLineupId: `${away.id}_lineup`,
    timeOfDay: "EVENING",
    weather: "MILD",
    played: !!row.played,
    official: true,
    seasonPhase: row.seasonPhase || "regular",
  };
  if (fixture.played && Number.isFinite(row.homeScore) && Number.isFinite(row.awayScore)) {
    fixture.homeScore = row.homeScore;
    fixture.awayScore = row.awayScore;
  }
  return fixture;
}

async function fetchDay(day) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${day}`;
  const res = await fetch(url, { headers: { "User-Agent": "VORTEX-Basketball/0.5" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function collectFromEspn(fromYmd, toYmd) {
  const days = eachDay(fromYmd, toYmd);
  const byId = new Map();
  let i = 0;
  for (const day of days) {
    i += 1;
    process.stdout.write(`\rESPN ${day} (${i}/${days.length})`);
    let payload;
    try {
      payload = await fetchDay(day);
    } catch (err) {
      console.warn(`\n  fail ${day}: ${err.message}`);
      continue;
    }
    for (const ev of payload.events || []) {
      const comps = ev.competitions?.[0]?.competitors || [];
      const homeC = comps.find((c) => c.homeAway === "home");
      const awayC = comps.find((c) => c.homeAway === "away");
      if (!homeC || !awayC) continue;
      const homeMeta = espnToTeam.get(String(homeC.team?.id));
      const awayMeta = espnToTeam.get(String(awayC.team?.id));
      if (!homeMeta || !awayMeta) continue;
      const tip = partsInZone(ev.date, TIP_ZONE);
      const et = partsInZone(ev.date, ESPN_DAY_ZONE);
      if (!tip || !et) continue;
      const seasonPhase = seasonPhaseFromEspn(ev);
      const completed = !!ev.status?.type?.completed;
      const homeScore = Number(homeC.score);
      const awayScore = Number(awayC.score);
      const hasScores = completed && Number.isFinite(homeScore) && Number.isFinite(awayScore);
      const id = `nba_result_${et.date.replace(/-/g, "")}_${homeMeta.abbr}_${awayMeta.abbr}`;
      byId.set(id, {
        id,
        date: tip.date,
        time: tip.time,
        homeTeamId: homeMeta.id,
        awayTeamId: awayMeta.id,
        seasonPhase,
        played: hasScores,
        homeScore: hasScores ? homeScore : undefined,
        awayScore: hasScores ? awayScore : undefined,
        espnDate: ev.date,
      });
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  process.stdout.write("\n");
  return [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  );
}

function writeFixtures(rows) {
  const fixtures = rows.map(fixtureFromRow);
  fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  fs.writeFileSync(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`);

  const overlayResults = fixtures
    .filter((f) => f.played && f.seasonPhase === "regular" && f.homeScore != null && f.awayScore != null)
    .map((f) => ({
      competition: f.competition,
      date: f.date,
      time: f.time,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      played: true,
      seasonPhase: "regular",
    }));
  fs.writeFileSync(
    overlayPath,
    `${JSON.stringify(
      {
        results: overlayResults,
        updatedAt: new Date().toISOString(),
        source: "nba-season-csv",
      },
      null,
      2,
    )}\n`,
  );
  return { fixtures, overlayResults };
}

async function main() {
  const fromCsv = argValue("--from-csv");
  const csvOnly = process.argv.includes("--csv-only");
  const season = argValue("--season", currentSeason());
  const bounds = seasonBounds(season);
  fs.mkdirSync(nbaDir, { recursive: true });
  const csvPath = fromCsv
    ? path.resolve(root, fromCsv)
    : path.join(nbaDir, bounds.csvName);

  let rows;
  if (fromCsv) {
    if (!fs.existsSync(csvPath)) throw new Error(`Missing CSV ${csvPath}`);
    rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    console.log(`Loaded ${rows.length} rows from ${path.relative(root, csvPath)}`);
  } else {
    console.log(`Fetching ESPN NBA schedule ${bounds.season} (${bounds.fromYmd}→${bounds.toYmd})…`);
    rows = await collectFromEspn(bounds.fromYmd, bounds.toYmd);
    fs.writeFileSync(csvPath, rowsToCsv(rows));
    console.log(`Wrote ${rows.length} games → ${path.relative(root, csvPath)}`);
  }

  if (csvOnly) return;

  const { fixtures, overlayResults } = writeFixtures(rows);
  const played = fixtures.filter((f) => f.played).length;
  const upcoming = fixtures.length - played;
  const byPhase = fixtures.reduce((acc, f) => {
    acc[f.seasonPhase || "regular"] = (acc[f.seasonPhase || "regular"] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Seeded fixtures.json: ${fixtures.length} games (${played} final, ${upcoming} upcoming) phases=${JSON.stringify(byPhase)}; overlay=${overlayResults.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
