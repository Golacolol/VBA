/**
 * Pull completed ESPN NBA scoreboard games into public/data/fixtures.json
 * (early-season results for Fixtures / standings).
 *
 * Usage: node scripts/refresh-nba-results.mjs [--from YYYYMMDD] [--to YYYYMMDD]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NBA_TEAMS } from "./lib/nbaTeams.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.join(root, "public", "data", "fixtures.json");
const overlayPath = path.join(root, "public", "data", "officialResultsOverlay.json");

const espnToTeam = new Map(NBA_TEAMS.map((t) => [t.espnId, t]));

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function ymd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoFromEspn(iso) {
  return dateFromEspn(iso);
}

const TIP_ZONE = "Europe/London";
const ESPN_DAY_ZONE = "America/New_York";

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

/** Tip-off as UK wall-clock HH:mm for in-game menus. */
function timeFromEspn(iso) {
  const raw = String(iso || "");
  if (!raw) return "00:00";
  const zoned = partsInZone(raw, TIP_ZONE);
  if (!zoned) return raw.slice(11, 16) || "00:00";
  return zoned.time;
}

function dateFromEspn(iso) {
  const raw = String(iso || "");
  const zoned = partsInZone(raw, TIP_ZONE);
  if (zoned) return zoned.date;
  return raw.slice(0, 10);
}

/** ESPN scoreboard day key (US Eastern calendar) — used to match legacy stubs. */
function easternDateFromEspn(iso) {
  const zoned = partsInZone(iso, ESPN_DAY_ZONE);
  return zoned?.date ?? dateFromEspn(iso);
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

async function fetchDay(day) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${day}`;
  const res = await fetch(url, { headers: { "User-Agent": "VORTEX-Basketball/0.5" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function competitionFor(homeTeam) {
  return homeTeam.conference === "WEST" ? "Western Conference" : "Eastern Conference";
}

function defaultSeasonFromYmd(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const startYear = m >= 10 ? y : y - 1;
  return `${startYear}1001`;
}

function findFixture(fixtures, byPairDate, date, homeId, awayId) {
  const key = `${date}|${homeId}|${awayId}`;
  let fixture = byPairDate.get(key);
  if (fixture) return fixture;
  return (
    fixtures.find(
      (f) =>
        f.date === date &&
        ((f.homeTeamId === homeId && f.awayTeamId === awayId) ||
          (f.homeTeamId === awayId && f.awayTeamId === homeId)),
    ) || null
  );
}

async function main() {
  const from = argValue("--from", defaultSeasonFromYmd());
  const to = argValue("--to", ymd(new Date()));
  const scheduleOnly = process.argv.includes("--schedule");
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  const byPairDate = new Map();
  for (const f of fixtures) {
    byPairDate.set(`${f.date}|${f.homeTeamId}|${f.awayTeamId}`, f);
  }

  const overlayResults = [];
  let added = 0;
  let updated = 0;
  let tipUpdated = 0;

  for (const day of eachDay(from, to)) {
    process.stdout.write(`${day}… `);
    let payload;
    try {
      payload = await fetchDay(day);
    } catch (err) {
      console.warn(`fail ${err.message}`);
      continue;
    }
    const events = payload.events || [];
    let dayDone = 0;
    for (const ev of events) {
      const comps = ev.competitions?.[0]?.competitors || [];
      const homeC = comps.find((c) => c.homeAway === "home");
      const awayC = comps.find((c) => c.homeAway === "away");
      if (!homeC || !awayC) continue;
      const homeMeta = espnToTeam.get(String(homeC.team?.id));
      const awayMeta = espnToTeam.get(String(awayC.team?.id));
      if (!homeMeta || !awayMeta) continue;
      const date = isoFromEspn(ev.date);
      const tip = timeFromEspn(ev.date);
      const etDate = easternDateFromEspn(ev.date);
      const completed = !!ev.status?.type?.completed;

      // Scheduled / in-progress: refresh tip-off on matching stubs.
      if (!completed || scheduleOnly) {
        const stub =
          findFixture(fixtures, byPairDate, date, homeMeta.id, awayMeta.id) ||
          (etDate !== date ? findFixture(fixtures, byPairDate, etDate, homeMeta.id, awayMeta.id) : null);
        if (stub && !stub.played && tip) {
          let changed = false;
          if (stub.time !== tip) {
            stub.time = tip;
            changed = true;
          }
          if (stub.date !== date) {
            byPairDate.delete(`${stub.date}|${stub.homeTeamId}|${stub.awayTeamId}`);
            stub.date = date;
            byPairDate.set(`${date}|${stub.homeTeamId}|${stub.awayTeamId}`, stub);
            changed = true;
          }
          if (changed) {
            stub.official = true;
            tipUpdated += 1;
          }
        }
        if (!completed) continue;
      }
      if (scheduleOnly) continue;

      const homeScore = Number(homeC.score);
      const awayScore = Number(awayC.score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      const key = `${date}|${homeMeta.id}|${awayMeta.id}`;
      const competition = competitionFor(homeMeta);
      const row = {
        competition,
        date,
        time: tip,
        homeTeamId: homeMeta.id,
        awayTeamId: awayMeta.id,
        homeScore,
        awayScore,
        played: true,
      };
      overlayResults.push(row);

      let fixture = findFixture(fixtures, byPairDate, date, homeMeta.id, awayMeta.id);
      if (fixture) {
        fixture.played = true;
        fixture.homeTeamId = homeMeta.id;
        fixture.awayTeamId = awayMeta.id;
        fixture.homeScore = homeScore;
        fixture.awayScore = awayScore;
        fixture.competition = competition;
        fixture.time = tip || fixture.time;
        fixture.official = true;
        fixture.venueId = `${homeMeta.id}_arena`;
        fixture.homeLineupId = `${homeMeta.id}_lineup`;
        fixture.awayLineupId = `${awayMeta.id}_lineup`;
        updated += 1;
      } else {
        const id = `nba_result_${date.replace(/-/g, "")}_${homeMeta.abbr}_${awayMeta.abbr}`;
        const created = {
          id,
          homeTeamId: homeMeta.id,
          awayTeamId: awayMeta.id,
          venueId: `${homeMeta.id}_arena`,
          competition,
          date,
          time: tip,
          durationSeconds: 600,
          homeLineupId: `${homeMeta.id}_lineup`,
          awayLineupId: `${awayMeta.id}_lineup`,
          timeOfDay: "EVENING",
          weather: "MILD",
          played: true,
          homeScore,
          awayScore,
          official: true,
        };
        fixtures.push(created);
        byPairDate.set(key, created);
        added += 1;
      }
      dayDone += 1;
    }
    console.log(`${dayDone} results`);
    await new Promise((r) => setTimeout(r, 80));
  }

  fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  fs.writeFileSync(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`);
  fs.writeFileSync(
    overlayPath,
    `${JSON.stringify(
      {
        results: overlayResults,
        updatedAt: new Date().toISOString(),
        source: "espn-nba-scoreboard",
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Fixtures: +${added} new, ${updated} updated, ${tipUpdated} tip-offs, ${overlayResults.length} completed games`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
