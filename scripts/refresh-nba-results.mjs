/**
 * Sync ESPN NBA scoreboard into public/data/fixtures.json —
 * completed scores + upcoming schedule (replaces fake seed stubs).
 *
 * Usage:
 *   node scripts/refresh-nba-results.mjs [--from YYYYMMDD] [--to YYYYMMDD]
 *   node scripts/refresh-nba-results.mjs --schedule   # tip-offs / slate only
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

/** Map ESPN season.slug → fixture seasonPhase for standings filtering. */
function seasonPhaseFromEspn(ev) {
  const slug = String(ev?.season?.slug || "").toLowerCase();
  if (slug.includes("pre")) return "preseason";
  if (slug.includes("post") || slug.includes("playoff")) return "postseason";
  if (slug.includes("regular")) return "regular";
  const type = Number(ev?.season?.type);
  // ESPN: 1 preseason, 2 regular, 3 postseason
  if (type === 1) return "preseason";
  if (type === 3) return "postseason";
  if (type === 2) return "regular";
  return "regular";
}

function defaultSeasonFromYmd(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const startYear = m >= 10 ? y : y - 1;
  return `${startYear}1001`;
}

/** Include upcoming slate so Fixtures are not left on fake seed pairings. */
function defaultToYmd(now = new Date(), aheadDays = 21) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + aheadDays);
  return ymd(d);
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

/**
 * Resolve an existing row for this ESPN event.
 * Prefer stable result id, then exact UK/ET date. Only reclaim fake
 * `nba_fix_*` stubs nearby — never rewrite another night's `nba_result_*`.
 */
function findFixtureNear(fixtures, byPairDate, date, etDate, homeId, awayId, resultId) {
  const byId = resultId ? fixtures.find((f) => f.id === resultId) : null;
  if (byId) return byId;
  const hit =
    findFixture(fixtures, byPairDate, date, homeId, awayId) ||
    (etDate !== date ? findFixture(fixtures, byPairDate, etDate, homeId, awayId) : null);
  if (hit) {
    // Same pairing on this slate day is fine; a different result-id night is not.
    if (!String(hit.id).startsWith("nba_result_") || hit.id === resultId) return hit;
    const idDay = String(hit.id).slice("nba_result_".length, "nba_result_".length + 8);
    if (idDay === etDate.replace(/-/g, "")) return hit;
    return null;
  }
  const center = Date.parse(etDate);
  if (!Number.isFinite(center)) return null;
  return (
    fixtures.find((f) => {
      if (!String(f.id).startsWith("nba_fix_")) return false;
      const same =
        (f.homeTeamId === homeId && f.awayTeamId === awayId) ||
        (f.homeTeamId === awayId && f.awayTeamId === homeId);
      if (!same) return false;
      const t = Date.parse(f.date);
      if (!Number.isFinite(t)) return false;
      return Math.abs(t - center) / 86400000 <= 1.5;
    }) || null
  );
}

function reindexPair(byPairDate, fixture, prevDate, prevHome, prevAway) {
  byPairDate.delete(`${prevDate}|${prevHome}|${prevAway}`);
  byPairDate.set(`${fixture.date}|${fixture.homeTeamId}|${fixture.awayTeamId}`, fixture);
}

async function main() {
  const from = argValue("--from", defaultSeasonFromYmd());
  const to = argValue("--to", defaultToYmd());
  const scheduleOnly = process.argv.includes("--schedule");
  let fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  const byPairDate = new Map();
  for (const f of fixtures) {
    byPairDate.set(`${f.date}|${f.homeTeamId}|${f.awayTeamId}`, f);
  }

  const overlayResults = [];
  const touched = new Set();
  let added = 0;
  let updated = 0;
  let scheduled = 0;

  const fromIso = `${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}`;
  const toIso = `${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}`;

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
      const seasonPhase = seasonPhaseFromEspn(ev);
      const competition = competitionFor(homeMeta);
      const idDay = etDate.replace(/-/g, "");
      const resultId = `nba_result_${idDay}_${homeMeta.abbr}_${awayMeta.abbr}`;

      let fixture = findFixtureNear(
        fixtures,
        byPairDate,
        date,
        etDate,
        homeMeta.id,
        awayMeta.id,
        resultId,
      );

      const homeScore = Number(homeC.score);
      const awayScore = Number(awayC.score);
      const hasScores =
        completed && Number.isFinite(homeScore) && Number.isFinite(awayScore) && !scheduleOnly;

      if (fixture) {
        const prevDate = fixture.date;
        const prevHome = fixture.homeTeamId;
        const prevAway = fixture.awayTeamId;
        fixture.homeTeamId = homeMeta.id;
        fixture.awayTeamId = awayMeta.id;
        fixture.competition = competition;
        fixture.date = date;
        fixture.time = tip || fixture.time;
        fixture.official = true;
        fixture.seasonPhase = seasonPhase;
        fixture.venueId = `${homeMeta.id}_arena`;
        fixture.homeLineupId = `${homeMeta.id}_lineup`;
        fixture.awayLineupId = `${awayMeta.id}_lineup`;
        if (hasScores) {
          fixture.played = true;
          fixture.homeScore = homeScore;
          fixture.awayScore = awayScore;
        } else {
          // Scheduled / live — never keep a stale final from a wrong stub merge.
          fixture.played = false;
          delete fixture.homeScore;
          delete fixture.awayScore;
        }
        if (resultId && String(fixture.id).startsWith("nba_fix_")) {
          fixture.id = resultId;
        }
        reindexPair(byPairDate, fixture, prevDate, prevHome, prevAway);
        touched.add(fixture.id);
        updated += 1;
      } else {
        const created = {
          id: hasScores || completed ? resultId : `nba_result_${idDay}_${homeMeta.abbr}_${awayMeta.abbr}`,
          homeTeamId: homeMeta.id,
          awayTeamId: awayMeta.id,
          venueId: `${homeMeta.id}_arena`,
          competition,
          date,
          time: tip || "00:00",
          durationSeconds: 600,
          homeLineupId: `${homeMeta.id}_lineup`,
          awayLineupId: `${awayMeta.id}_lineup`,
          timeOfDay: "EVENING",
          weather: "MILD",
          played: !!hasScores,
          official: true,
          seasonPhase,
        };
        if (hasScores) {
          created.homeScore = homeScore;
          created.awayScore = awayScore;
        }
        fixtures.push(created);
        byPairDate.set(`${date}|${homeMeta.id}|${awayMeta.id}`, created);
        touched.add(created.id);
        added += 1;
        if (!hasScores) scheduled += 1;
      }

      if (hasScores && seasonPhase === "regular") {
        overlayResults.push({
          competition,
          date,
          time: tip,
          homeTeamId: homeMeta.id,
          awayTeamId: awayMeta.id,
          homeScore,
          awayScore,
          played: true,
          seasonPhase,
        });
      }
      dayDone += 1;
    }
    console.log(`${dayDone} games`);
    await new Promise((r) => setTimeout(r, 80));
  }

  // Drop all remaining fake seed stubs — ESPN slate is authoritative.
  const before = fixtures.length;
  fixtures = fixtures.filter((f) => !String(f.id).startsWith("nba_fix_"));
  const pruned = before - fixtures.length;

  // Collapse UK/ET date-shift duplicates (same pairing + score within 36h).
  const deduped = [];
  const seenPair = new Map();
  let collapsed = 0;
  for (const f of fixtures) {
    if (!f.played || f.homeScore == null || f.awayScore == null) {
      deduped.push(f);
      continue;
    }
    const teams = [f.homeTeamId, f.awayTeamId].sort().join("|");
    const scoreKey = `${f.homeScore}-${f.awayScore}`;
    const t = Date.parse(f.date);
    const prev = seenPair.get(`${teams}|${scoreKey}`);
    if (prev != null && Number.isFinite(t) && Math.abs(t - prev.t) <= 36 * 3600 * 1000) {
      // Prefer the row whose id embeds the ESPN Eastern day.
      const prevEt = String(prev.f.id).match(/^nba_result_(\d{8})_/)?.[1];
      const curEt = String(f.id).match(/^nba_result_(\d{8})_/)?.[1];
      const prevDate = prevEt ? `${prevEt.slice(0, 4)}-${prevEt.slice(4, 6)}-${prevEt.slice(6, 8)}` : prev.f.date;
      const curDate = curEt ? `${curEt.slice(0, 4)}-${curEt.slice(4, 6)}-${curEt.slice(6, 8)}` : f.date;
      const prevAlign = Math.abs(Date.parse(prevDate) - prev.t);
      const curAlign = Math.abs(Date.parse(curDate) - t);
      if (curAlign < prevAlign) {
        deduped[prev.index] = f;
        seenPair.set(`${teams}|${scoreKey}`, { f, t, index: prev.index });
      }
      collapsed += 1;
      continue;
    }
    seenPair.set(`${teams}|${scoreKey}`, { f, t, index: deduped.length });
    deduped.push(f);
  }
  fixtures = deduped.filter(Boolean);

  // Rebuild overlay from surviving regular-season finals in-range.
  overlayResults.length = 0;
  for (const f of fixtures) {
    if (!f.played || f.seasonPhase !== "regular") continue;
    if (f.date < fromIso || f.date > toIso) continue;
    if (f.homeScore == null || f.awayScore == null) continue;
    overlayResults.push({
      competition: f.competition,
      date: f.date,
      time: f.time,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      played: true,
      seasonPhase: "regular",
    });
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
    `Fixtures: +${added} new (${scheduled} scheduled), ${updated} updated, ${pruned} fake stubs pruned, ${collapsed} date-shift dupes collapsed, ${overlayResults.length} completed regular-season games`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
