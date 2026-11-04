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
  return String(iso || "").slice(0, 10);
}

function timeFromEspn(iso) {
  const t = String(iso || "").slice(11, 16);
  return t || "19:00";
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

async function main() {
  const from = argValue("--from", "20251021");
  const to = argValue("--to", ymd(new Date()));
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  const byPairDate = new Map();
  for (const f of fixtures) {
    byPairDate.set(`${f.date}|${f.homeTeamId}|${f.awayTeamId}`, f);
  }

  const overlayResults = [];
  let added = 0;
  let updated = 0;

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
      if (!ev.status?.type?.completed) continue;
      const comps = ev.competitions?.[0]?.competitors || [];
      const homeC = comps.find((c) => c.homeAway === "home");
      const awayC = comps.find((c) => c.homeAway === "away");
      if (!homeC || !awayC) continue;
      const homeMeta = espnToTeam.get(String(homeC.team?.id));
      const awayMeta = espnToTeam.get(String(awayC.team?.id));
      if (!homeMeta || !awayMeta) continue;
      const date = isoFromEspn(ev.date);
      const homeScore = Number(homeC.score);
      const awayScore = Number(awayC.score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      const key = `${date}|${homeMeta.id}|${awayMeta.id}`;
      const competition = competitionFor(homeMeta);
      const row = {
        competition,
        date,
        time: timeFromEspn(ev.date),
        homeTeamId: homeMeta.id,
        awayTeamId: awayMeta.id,
        homeScore,
        awayScore,
        played: true,
      };
      overlayResults.push(row);

      let fixture = byPairDate.get(key);
      if (!fixture) {
        // Also match undirected existing stub on same date.
        fixture =
          fixtures.find(
            (f) =>
              f.date === date &&
              ((f.homeTeamId === homeMeta.id && f.awayTeamId === awayMeta.id) ||
                (f.homeTeamId === awayMeta.id && f.awayTeamId === homeMeta.id)),
          ) || null;
      }
      if (fixture) {
        fixture.played = true;
        fixture.homeTeamId = homeMeta.id;
        fixture.awayTeamId = awayMeta.id;
        fixture.homeScore = homeScore;
        fixture.awayScore = awayScore;
        fixture.competition = competition;
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
          time: timeFromEspn(ev.date),
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
  console.log(`Fixtures: +${added} new, ${updated} updated, ${overlayResults.length} completed games`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
