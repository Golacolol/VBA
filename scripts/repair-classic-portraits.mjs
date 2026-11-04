/**
 * Repair classic portraits:
 *  1) Drop NBA/ESPN CDN URLs that resolve to silhouettes / empty
 *  2) Prefer working NBA → ESPN headshots
 *  3) Fall back to Wikipedia page image downloaded into public/assets/portraits/classic
 *
 * Usage: node scripts/repair-classic-portraits.mjs [--dry] [--limit N]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSIC_ESPN_IDS,
  CLASSIC_NBA_IDS,
  espnHeadshotUrl,
  espnIdForName,
  localPortraitForName,
  nbaHeadshotUrl,
  nbaIdForName,
} from "./lib/nbaClassicHeadshots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playersPath = path.join(root, "public", "data", "players.json");
const outDir = path.join(root, "public", "assets", "portraits", "classic");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Math.max(1, Number(args[limitIdx + 1]) || 40) : Infinity;

const UA = "VORTEX-Basketball/0.5 (classic portrait repair)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function bytesOk(url, min = 20000) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://www.nba.com/" },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length >= min;
  } catch {
    return false;
  }
}

async function resolveCdn(fullName) {
  const local = localPortraitForName(fullName);
  if (local) {
    const abs = path.join(root, "public", local.replace(/^\//, ""));
    if (fs.existsSync(abs) && fs.statSync(abs).size >= 8000) return { url: local, source: "local" };
  }
  const nbaId = nbaIdForName(fullName) ?? CLASSIC_NBA_IDS[fullName];
  if (nbaId != null) {
    const url = nbaHeadshotUrl(nbaId);
    if (await bytesOk(url)) return { url, source: "nba" };
  }
  const espnId = espnIdForName(fullName) ?? CLASSIC_ESPN_IDS[fullName];
  if (espnId != null) {
    const url = espnHeadshotUrl(espnId);
    if (await bytesOk(url, 15000)) return { url, source: "espn" };
  }
  return null;
}

async function wikiImage(fullName) {
  const title = fullName.replace(/ /g, "_");
  const tries = [
    title,
    `${title}_(basketball)`,
    `${title}_(basketball_player)`,
  ];
  for (const t of tries) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, {
        headers: { "User-Agent": UA },
      });
      if (!res.ok) continue;
      const j = await res.json();
      const src = j.originalimage?.source || j.thumbnail?.source;
      if (!src) continue;
      // Prefer larger commons URL without thumb path when possible.
      const clean = String(src).replace(/\/thumb\//, "/").replace(/\/\d+px-[^/]+$/, "");
      const pick = (await bytesOk(clean, 8000)) ? clean : src;
      if (await bytesOk(pick, 8000)) return pick;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function downloadLocal(fullName, url) {
  fs.mkdirSync(outDir, { recursive: true });
  const ext = /\.png(\?|$)/i.test(url) ? "png" : /\.webp(\?|$)/i.test(url) ? "webp" : "jpg";
  const file = `${slugify(fullName)}.${ext}`;
  const abs = path.join(outDir, file);
  const rel = `/assets/portraits/classic/${file}`;
  if (fs.existsSync(abs) && fs.statSync(abs).size > 8000) return rel;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8000) return null;
  if (!dry) fs.writeFileSync(abs, buf);
  return rel;
}

function isCdnPortrait(url) {
  return /cdn\.nba\.com|espncdn\.com/i.test(String(url || ""));
}

async function main() {
  const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  const classics = players.filter((p) => String(p.id).startsWith("classic_"));
  let cleared = 0;
  let linked = 0;
  let local = 0;
  let attempted = 0;

  // First pass: clear dead CDN portraits.
  for (const p of classics) {
    const url = p.appearance?.portraitAsset;
    if (!url || !isCdnPortrait(url)) continue;
    if (await bytesOk(url, url.includes("espncdn") ? 15000 : 20000)) continue;
    p.appearance = { ...(p.appearance || {}), portraitAsset: null };
    cleared += 1;
  }

  for (const p of classics) {
    if (attempted >= limit) break;
    const fullName = p.appearance?.fullName || p.displayName || p.name;
    if (p.appearance?.portraitAsset) continue;
    attempted += 1;

    const cdn = await resolveCdn(fullName);
    if (cdn) {
      if (!dry) p.appearance = { ...(p.appearance || {}), fullName, portraitAsset: cdn.url };
      linked += 1;
      console.log(`${fullName}… ${cdn.source}`);
      await sleep(40);
      continue;
    }

    const wiki = await wikiImage(fullName);
    if (wiki) {
      const rel = await downloadLocal(fullName, wiki);
      if (rel) {
        if (!dry) p.appearance = { ...(p.appearance || {}), fullName, portraitAsset: rel };
        local += 1;
        console.log(`${fullName}… wiki→${rel}`);
        await sleep(80);
        continue;
      }
    }
    console.log(`${fullName}… MISS`);
    await sleep(40);
  }

  // Propagate a working portrait to every classic clone of the same full name.
  const byName = new Map();
  for (const p of classics) {
    const name = p.appearance?.fullName || p.displayName;
    const url = p.appearance?.portraitAsset;
    if (!name || !url) continue;
    if (!byName.has(name)) byName.set(name, url);
  }
  let cloned = 0;
  for (const p of classics) {
    const name = p.appearance?.fullName || p.displayName;
    const best = name ? byName.get(name) : null;
    if (!best || p.appearance?.portraitAsset) continue;
    if (!dry) p.appearance = { ...(p.appearance || {}), portraitAsset: best };
    cloned += 1;
  }

  if (!dry) {
    fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
  }
  console.log(
    `${dry ? "Dry" : "Wrote"}: cleared ${cleared} dead CDN, linked ${linked} CDN, ${local} local wiki, cloned ${cloned}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
