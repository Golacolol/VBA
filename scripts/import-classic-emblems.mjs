/**
 * Download era-correct primary logos for classic NBA teams (SportsLogos.net)
 * → public/assets/emblems/{classicEraId}.{png|gif|svg}
 * and patch public/data/teams.json badgeAsset.
 *
 * Usage: node scripts/import-classic-emblems.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSIC_ERAS } from "./lib/nbaClassicEras.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "assets", "emblems");
const teamsPath = path.join(root, "public", "data", "teams.json");
const force = process.argv.includes("--force");
const UA = "VORTEX-Basketball/0.5 (classic emblems; educational fair use)";

/** SportsLogos.net team page ids for current franchises. */
const SPORTLOGOS_BY_FRANCHISE = {
  nba_atl: { id: 220, slug: "Atlanta-Hawks-Logos" },
  nba_bos: { id: 213, slug: "Boston-Celtics-Logos" },
  nba_bkn: { id: 3786, slug: "Brooklyn-Nets-Logos" },
  nba_cha: { id: 5120, slug: "Charlotte-Hornets-Logos" },
  nba_chi: { id: 221, slug: "Chicago-Bulls-Logos" },
  nba_cle: { id: 222, slug: "Cleveland-Cavaliers-Logos" },
  nba_det: { id: 223, slug: "Detroit-Pistons-Logos" },
  nba_ind: { id: 224, slug: "Indiana-Pacers-Logos" },
  nba_mia: { id: 214, slug: "Miami-Heat-Logos" },
  nba_mil: { id: 225, slug: "Milwaukee-Bucks-Logos" },
  nba_nyk: { id: 216, slug: "New-York-Knicks-Logos" },
  nba_orl: { id: 217, slug: "Orlando-Magic-Logos" },
  nba_phi: { id: 218, slug: "Philadelphia-76ers-Logos" },
  nba_tor: { id: 227, slug: "Toronto-Raptors-Logos" },
  nba_was: { id: 219, slug: "Washington-Wizards-Logos" },
  nba_dal: { id: 228, slug: "Dallas-Mavericks-Logos" },
  nba_den: { id: 229, slug: "Denver-Nuggets-Logos" },
  nba_gsw: { id: 235, slug: "Golden-State-Warriors-Logos" },
  nba_hou: { id: 230, slug: "Houston-Rockets-Logos" },
  nba_lac: { id: 236, slug: "Los-Angeles-Clippers-Logos" },
  nba_lal: { id: 237, slug: "Los-Angeles-Lakers-Logos" },
  nba_mem: { id: 231, slug: "Memphis-Grizzlies-Logos" },
  nba_min: { id: 232, slug: "Minnesota-Timberwolves-Logos" },
  nba_nop: { id: 4962, slug: "New-Orleans-Pelicans-Logos" },
  nba_okc: { id: 2687, slug: "Oklahoma-City-Thunder-Logos" },
  nba_phx: { id: 238, slug: "Phoenix-Suns-Logos" },
  nba_por: { id: 239, slug: "Portland-Trail-Blazers-Logos" },
  nba_sac: { id: 240, slug: "Sacramento-Kings-Logos" },
  nba_sas: { id: 233, slug: "San-Antonio-Spurs-Logos" },
  nba_uta: { id: 234, slug: "Utah-Jazz-Logos" },
};

/** Predecessor / relocated identity pages keyed by classic era id. */
const SPORTLOGOS_BY_ERA = {
  classic_okc_1995_96: { id: 241, slug: "Seattle-Supersonics-Logos" },
  classic_bkn_2000_01: { id: 215, slug: "New-Jersey-Nets-Logos" },
  classic_uta_1976_77: { id: 255, slug: "New-Orleans-Jazz-Logos" },
  classic_cin_1963_64: { id: 247, slug: "Cincinnati-Royals-Logos" },
  classic_cha_1992_93: { id: 256, slug: "Charlotte-Hornets-Logos" },
};

const pageCache = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Season "1994/95" → tip year used for logo matching (calendar year of opener). */
function seasonYear(season) {
  const m = /^(\d{4})/.exec(String(season || ""));
  return m ? Number(m[1]) : null;
}

function sportslogosPageFor(era) {
  return SPORTLOGOS_BY_ERA[era.id] || SPORTLOGOS_BY_FRANCHISE[era.franchiseId] || null;
}

/**
 * Parse Primary Logos History rows:
 *   href="/logos/view/{slug}/…/{year}/Primary-Logo"
 *   title="… Primary Logo (1990 - 1998)"
 */
function parsePrimaryHistory(html) {
  const out = [];
  // SportsLogos puts year range on the same <a title="… Primary Logo (1990 - 1998)">.
  const re =
    /href="\/logos\/view\/([^"/]+)\/[^"]*?\/(\d{4})\/Primary-Logo"\s+title="[^"]*Primary Logo \((\d{4})\s*[-–]\s*(Pres|\d{4})\)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    const from = Number(m[3]);
    const toRaw = m[4];
    const to = /^pres$/i.test(toRaw) ? 9999 : Number(toRaw);
    if (!slug || !Number.isFinite(from) || !Number.isFinite(to)) continue;
    out.push({ slug, from, to });
  }
  // Deduplicate by slug, keep first.
  const seen = new Set();
  return out.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
}

function pickLogoForYear(history, year) {
  if (!history.length || year == null) return null;
  const covering = history.filter((r) => year >= r.from && year <= r.to);
  if (covering.length) {
    // Prefer the tightest window, then newest start.
    covering.sort((a, b) => a.to - a.from - (b.to - b.from) || b.from - a.from);
    return covering[0];
  }
  // Fallback: nearest logo that started on/before the season.
  const prior = history.filter((r) => r.from <= year).sort((a, b) => b.from - a.from);
  return prior[0] || history[0];
}

async function resolveFullUrl(slug, pageMeta) {
  const viewUrl = `https://www.sportslogos.net/logos/view/${slug}`;
  const html = await fetchText(viewUrl);
  await sleep(120);
  const leagueId = 6;
  const teamId = pageMeta.id;
  // Prefer PNG full assets named on the view page.
  const fulls = [
    ...html.matchAll(
      new RegExp(
        `content\\.sportslogos\\.net/logos/${leagueId}/${teamId}/full/([^"'\\s]+\\.(?:png|gif|jpg|jpeg|webp|svg))`,
        "gi",
      ),
    ),
  ].map((m) => m[1]);
  const prefer = fulls.find((f) => /\.png$/i.test(f)) || fulls[0];
  if (prefer) {
    return {
      url: `https://content.sportslogos.net/logos/${leagueId}/${teamId}/full/${prefer}`,
      ext: path.extname(prefer).toLowerCase() || ".png",
    };
  }
  // Hash-style slug often works as .gif under /full/
  return {
    url: `https://content.sportslogos.net/logos/${leagueId}/${teamId}/full/${slug}.gif`,
    ext: ".gif",
  };
}

async function loadHistory(pageMeta) {
  const key = `${pageMeta.id}:${pageMeta.slug}`;
  if (pageCache.has(key)) return pageCache.get(key);
  const url = `https://www.sportslogos.net/logos/list_by_team/${pageMeta.id}/${pageMeta.slug}/`;
  const html = await fetchText(url);
  await sleep(180);
  const history = parsePrimaryHistory(html);
  pageCache.set(key, history);
  return history;
}

function existingAsset(eraId) {
  for (const ext of [".png", ".gif", ".svg", ".webp", ".jpg", ".jpeg"]) {
    const p = path.join(outDir, `${eraId}${ext}`);
    if (fs.existsSync(p)) return `/assets/emblems/${eraId}${ext}`;
  }
  return null;
}

async function downloadEraEmblem(era) {
  const page = sportslogosPageFor(era);
  if (!page) {
    console.warn(`  no SportsLogos page for ${era.id}`);
    return null;
  }
  if (!force) {
    const hit = existingAsset(era.id);
    if (hit) {
      console.log(`  keep ${hit}`);
      return hit;
    }
  }
  const year = seasonYear(era.season);
  const history = await loadHistory(page);
  if (!history.length) {
    console.warn(`  no primary history on ${page.slug}`);
    return null;
  }
  const pick = pickLogoForYear(history, year);
  if (!pick) return null;
  const resolved = await resolveFullUrl(pick.slug, page);
  const buf = await fetchBuffer(resolved.url);
  await sleep(100);
  // Drop broken XML/HTML error bodies.
  if (buf.length < 400) {
    console.warn(`  tiny payload for ${era.id} (${buf.length}b) — skip`);
    return null;
  }
  const head = buf.slice(0, 64).toString("utf8");
  if (/^\s*</.test(head) && !/^\s*<svg/i.test(head)) {
    console.warn(`  non-image payload for ${era.id} — skip`);
    return null;
  }
  // Clear other extensions for this era id.
  for (const ext of [".png", ".gif", ".svg", ".webp", ".jpg", ".jpeg"]) {
    const p = path.join(outDir, `${era.id}${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const dest = path.join(outDir, `${era.id}${resolved.ext}`);
  fs.writeFileSync(dest, buf);
  const asset = `/assets/emblems/${era.id}${resolved.ext}`;
  console.log(
    `  ${era.id} ← ${pick.from}-${pick.to === 9999 ? "Pres" : pick.to} (${resolved.ext}, ${buf.length}b)`,
  );
  return asset;
}

function patchTeamsJson(updates) {
  const teams = JSON.parse(fs.readFileSync(teamsPath, "utf8"));
  let n = 0;
  for (const team of teams) {
    const asset = updates.get(team.id);
    if (!asset) continue;
    if (team.badgeAsset !== asset) {
      team.badgeAsset = asset;
      n += 1;
    }
  }
  fs.writeFileSync(teamsPath, `${JSON.stringify(teams, null, 2)}\n`);
  return n;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const updates = new Map();
  for (const era of CLASSIC_ERAS) {
    process.stdout.write(`${era.id}…\n`);
    try {
      const asset = await downloadEraEmblem(era);
      if (asset) updates.set(era.id, asset);
    } catch (err) {
      console.warn(`  fail ${era.id}: ${err.message}`);
    }
  }
  const patched = patchTeamsJson(updates);
  console.log(`Emblems ready: ${updates.size}/${CLASSIC_ERAS.length}; teams.json patched ${patched}`);
  // Knock out opaque white plates (Hawks, Spurs, Heat, …) after download.
  try {
    const { spawnSync } = await import("node:child_process");
    const knock = spawnSync("python3", [path.join(root, "scripts", "knockout-emblem-bg.py")], {
      cwd: root,
      stdio: "inherit",
    });
    if (knock.status !== 0) console.warn("knockout-emblem-bg.py exited", knock.status);
  } catch (err) {
    console.warn("emblem knockout skipped:", err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
