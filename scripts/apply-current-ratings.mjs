/**
 * Rebalance current NBA (espn_*) player attributes to curated OVRs.
 * Classic / historic (classic_*) players are never modified.
 *
 * Usage: node scripts/apply-current-ratings.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compressUncategorizedOvr,
  currentAttrsFor,
  currentOvrFor,
} from "./lib/nbaCurrentRatings.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playersPath = path.join(root, "public/data/players.json");
const dryRun = process.argv.includes("--dry-run");

const WEIGHTS = {
  PG: { passAccuracy: 0.16, ballHandle: 0.14, iq: 0.12, threePoint: 0.1, speed: 0.1, finishing: 0.08, midRange: 0.08, perimeterD: 0.08, clutch: 0.08, stamina: 0.06 },
  SG: { threePoint: 0.16, midRange: 0.12, finishing: 0.12, ballHandle: 0.1, speed: 0.1, freeThrow: 0.08, perimeterD: 0.08, iq: 0.08, clutch: 0.08, stamina: 0.08 },
  SF: { finishing: 0.12, threePoint: 0.1, midRange: 0.1, speed: 0.1, ballHandle: 0.1, perimeterD: 0.1, rebound: 0.08, vertical: 0.08, iq: 0.08, strength: 0.08, stamina: 0.06 },
  PF: { finishing: 0.12, rebound: 0.14, interiorD: 0.12, strength: 0.12, vertical: 0.1, midRange: 0.08, block: 0.08, iq: 0.08, stamina: 0.08, speed: 0.08 },
  C: { rebound: 0.16, interiorD: 0.16, block: 0.14, strength: 0.12, finishing: 0.12, vertical: 0.1, iq: 0.08, stamina: 0.06, freeThrow: 0.06 },
};

function deriveOverall(pos, p) {
  const w = WEIGHTS[pos] || WEIGHTS.SF;
  let sum = 0;
  let tot = 0;
  for (const [k, wt] of Object.entries(w)) {
    const v = Number(p[k]);
    if (!Number.isFinite(v)) continue;
    sum += v * wt;
    tot += wt;
  }
  return Math.round(sum / Math.max(1e-6, tot));
}

function applyAttrs(player, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    player[k] = v;
  }
}

function main() {
  const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  let curated = 0;
  let compressed = 0;
  let skippedClassic = 0;
  let untouched = 0;
  const samples = [];

  for (const p of players) {
    const id = String(p.id || "");
    if (id.startsWith("classic_")) {
      skippedClassic += 1;
      continue;
    }
    if (!id.startsWith("espn_")) {
      untouched += 1;
      continue;
    }

    const name = p.displayName || p.name || "";
    const pos = p.primaryPosition || "SF";
    const before = typeof p.overall === "number" ? p.overall : deriveOverall(pos, p);
    const curatedTarget = currentOvrFor(name);

    if (curatedTarget != null) {
      const attrs = currentAttrsFor(pos, name, curatedTarget);
      if (!dryRun) applyAttrs(p, attrs);
      curated += 1;
      if (samples.length < 12 || ["LeBron James", "Joel Embiid", "Shai Gilgeous-Alexander", "Jayson Tatum", "Nikola Jokic"].includes(name)) {
        samples.push({ name, before, after: curatedTarget, kind: "curated" });
      }
      continue;
    }

    const provisional = before;
    const target = compressUncategorizedOvr(provisional);
    if (target !== provisional) {
      const attrs = currentAttrsFor(pos, name, target);
      if (!dryRun) applyAttrs(p, attrs);
      compressed += 1;
    } else {
      // Lock authored overall to current derive so display stays stable.
      if (!dryRun && typeof p.overall !== "number") p.overall = provisional;
      untouched += 1;
    }
  }

  if (!dryRun) {
    fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
  }

  console.log(
    `${dryRun ? "DRY RUN — " : ""}current ratings: curated=${curated}, compressed=${compressed}, untouched=${untouched}, classicSkipped=${skippedClassic}`,
  );
  for (const s of samples.slice(0, 20)) {
    console.log(`  ${s.kind.padEnd(10)} ${String(s.before).padStart(3)} → ${String(s.after).padStart(3)}  ${s.name}`);
  }
}

main();
