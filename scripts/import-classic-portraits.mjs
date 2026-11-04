/**
 * Attach pro headshots to classic HISTORIC_TEAM players.
 *
 * Sources (no Wikipedia — those are usually present-day photos):
 *   1) NBA.com CDN career cards
 *   2) ESPN CDN (same as current rosters)
 *
 * Usage:
 *   node scripts/import-classic-portraits.mjs
 *   node scripts/import-classic-portraits.mjs --force
 *   node scripts/import-classic-portraits.mjs --dry --limit 20
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  espnHeadshotUrl,
  espnIdForName,
  localPortraitForName,
  nbaHeadshotUrl,
  nbaIdForName,
} from "./lib/nbaClassicHeadshots.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playersPath = path.join(root, "public", "data", "players.json");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Math.max(1, Number(args[limitIdx + 1]) || 40) : Infinity;

const UA = "VORTEX-Basketball/0.5 (classic NBA headshots)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA, Referer: "https://www.nba.com/" },
      redirect: "follow",
    });
    if (!res.ok) return false;
    // NBA.com serves a tiny generic silhouette (~12KB) for unknown personIds.
    const len = Number(res.headers.get("content-length") || 0);
    if (len > 0 && len < 20000) return false;
    return true;
  } catch {
    return false;
  }
}

function isWikiPortrait(url) {
  return /wikipedia|wikimedia/i.test(String(url || ""));
}

async function resolvePortrait(fullName) {
  const local = localPortraitForName(fullName);
  if (local) {
    const abs = path.join(root, "public", local.replace(/^\//, ""));
    if (fs.existsSync(abs) && fs.statSync(abs).size >= 8000) {
      return { url: local, source: "local", id: "file" };
    }
  }
  const nbaId = nbaIdForName(fullName);
  if (nbaId != null) {
    const url = nbaHeadshotUrl(nbaId);
    if (await headOk(url)) return { url, source: "nba", id: nbaId };
  }
  const espnId = espnIdForName(fullName);
  if (espnId != null) {
    const url = espnHeadshotUrl(espnId);
    if (await headOk(url)) return { url, source: "espn", id: espnId };
  }
  return null;
}

async function main() {
  const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  const classics = players.filter((p) => String(p.id).startsWith("classic_"));
  let attempted = 0;
  let linked = 0;
  let skipped = 0;
  let clearedWiki = 0;
  let missing = 0;
  const bySource = { nba: 0, espn: 0 };

  let clearedSilhouette = 0;

  for (const player of classics) {
    if (attempted >= limit) break;
    const existing = player.appearance?.portraitAsset;
    if (existing && isWikiPortrait(existing)) {
      // Drop present-day wiki photos even without --force.
      if (!dry) {
        player.appearance = { ...player.appearance, portraitAsset: null };
      }
      clearedWiki += 1;
    } else if (existing && !force && !isWikiPortrait(existing)) {
      // NBA CDN serves a ~12KB silhouette for missing historic cards — treat as no photo.
      if (!(await headOk(existing))) {
        if (!dry) {
          player.appearance = { ...player.appearance, portraitAsset: null };
        }
        clearedSilhouette += 1;
        // Fall through and try ESPN / a real NBA card.
      } else {
        skipped += 1;
        continue;
      }
    }

    const fullName = player.appearance?.fullName || player.displayName || player.name;
    attempted += 1;
    process.stdout.write(`${fullName}… `);
    const hit = await resolvePortrait(fullName);
    if (!hit) {
      console.log("MISS");
      missing += 1;
      await sleep(40);
      continue;
    }
    console.log(`${hit.source} #${hit.id}`);
    bySource[hit.source] += 1;
    if (!dry) {
      player.appearance = { ...(player.appearance || {}), portraitAsset: hit.url, fullName };
    }
    linked += 1;
    await sleep(60);
  }

  if (!dry) {
    fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
  }
  console.log(
    `${dry ? "Dry-run" : "Wrote"}: ${linked} linked (${bySource.nba} NBA.com, ${bySource.espn} ESPN), ${skipped} kept, ${clearedWiki} wiki cleared, ${clearedSilhouette} silhouettes cleared, ${missing} missing (null → club crest)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
