/**
 * Re-rate classic HISTORIC_TEAM players in public/data/players.json
 * using curated peak OVRs (Pippen/Garnett 90+, Jordan/LeBron anchors).
 *
 * Usage: node scripts/refresh-classic-ratings.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSIC_ERAS } from "./lib/nbaClassicEras.mjs";
import { classicAttrsFor, peakOvrFor } from "./lib/nbaClassicRatings.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playersPath = path.join(root, "public", "data", "players.json");

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
    return s / 0x100000000;
  };
}

const byId = new Map();
for (const era of CLASSIC_ERAS) {
  const all = [...era.starters, ...era.bench];
  all.forEach((p, i) => {
    const id = `${era.id}_p${String(i + 1).padStart(2, "0")}`;
    byId.set(id, { name: p.name, pos: p.pos, role: i < era.starters.length ? "starter" : "bench", eraId: era.id });
  });
}

const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
let updated = 0;
const samples = [];

for (const player of players) {
  const meta = byId.get(player.id);
  if (!meta) continue;
  const r = rng(hash(`${meta.eraId}|${meta.name}`));
  const attrs = classicAttrsFor(meta.pos, meta.name, { role: meta.role, jitter: r });
  Object.assign(player, attrs);
  updated += 1;
  if (
    /Pippen|Garnett|Jordan|Bryant|Duncan|Bird|Curry|O'Neal|Nowitzki|Wade/i.test(meta.name)
  ) {
    samples.push({ name: meta.name, ovr: peakOvrFor(meta.name, meta.pos, meta.role), pos: meta.pos });
  }
}

fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
console.log(`Updated ${updated} classic players`);
for (const s of samples.sort((a, b) => b.ovr - a.ovr)) {
  console.log(`  ${s.ovr}  ${s.name} (${s.pos})`);
}
