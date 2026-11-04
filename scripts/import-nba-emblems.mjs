/**
 * Download NBA franchise emblems → public/assets/emblems/{teamId}.svg|.png
 *
 * Sources (in order):
 *   1. gtkacz/nba-logo-api SVG
 *   2. ESPN team logo PNG
 *   3. NBA CDN SVG (by espn→nba id map when known)
 *
 * Usage: node scripts/import-nba-emblems.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NBA_TEAMS } from "./lib/nbaTeams.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "assets", "emblems");
const force = process.argv.includes("--force");

const LOGO_API = "https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons";
const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/nba/500";

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveEmblem(team) {
  const svgPath = path.join(outDir, `${team.id}.svg`);
  const pngPath = path.join(outDir, `${team.id}.png`);
  if (!force && (fs.existsSync(svgPath) || fs.existsSync(pngPath))) {
    return fs.existsSync(svgPath) ? `/assets/emblems/${team.id}.svg` : `/assets/emblems/${team.id}.png`;
  }
  try {
    const buf = await fetchBuffer(`${LOGO_API}/${team.abbr}.svg`);
    fs.writeFileSync(svgPath, buf);
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
    return `/assets/emblems/${team.id}.svg`;
  } catch (err) {
    console.warn(`  SVG failed for ${team.abbr}: ${err.message}`);
  }
  try {
    const buf = await fetchBuffer(`${ESPN_LOGO}/${team.abbr}.png`);
    fs.writeFileSync(pngPath, buf);
    if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
    return `/assets/emblems/${team.id}.png`;
  } catch (err) {
    console.warn(`  PNG failed for ${team.abbr}: ${err.message}`);
  }
  return null;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const map = {};
  for (const team of NBA_TEAMS) {
    process.stdout.write(`${team.abbr}… `);
    const asset = await saveEmblem(team);
    console.log(asset ?? "MISSING");
    if (asset) map[team.id] = asset;
  }
  fs.writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(map, null, 2)}\n`);
  console.log(`Emblems: ${Object.keys(map).length}/${NBA_TEAMS.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
