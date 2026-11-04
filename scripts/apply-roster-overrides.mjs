/**
 * Apply POSITION_OVERRIDES + PREFERRED_STARTERS to current espn_* data only.
 * Classic players are never modified.
 *
 * Usage: node scripts/apply-roster-overrides.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentAttrsFor, currentOvrFor } from "./lib/nbaCurrentRatings.mjs";
import {
  POSITION_OVERRIDES,
  PREFERRED_STARTERS,
  canonicalPlayerName,
  pickPreferredStarters,
  positionOverrideFor,
} from "./lib/nbaRosterOverrides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const playersPath = path.join(root, "public/data/players.json");
const membershipsPath = path.join(root, "public/data/teamMemberships.json");
const lineupsPath = path.join(root, "public/data/lineups.json");

function main() {
  const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  const memberships = JSON.parse(fs.readFileSync(membershipsPath, "utf8"));
  const lineups = JSON.parse(fs.readFileSync(lineupsPath, "utf8"));

  let posFixed = 0;
  const byId = new Map(players.map((p) => [p.id, p]));

  for (const p of players) {
    if (!String(p.id).startsWith("espn_")) continue;
    const name = p.displayName || p.name || "";
    const forced = positionOverrideFor(name);
    if (!forced || p.primaryPosition === forced) continue;
    const target = currentOvrFor(name) ?? p.overall ?? 78;
    const attrs = currentAttrsFor(forced, name, target);
    if (!dryRun) {
      p.primaryPosition = forced;
      Object.assign(p, attrs);
    }
    posFixed += 1;
    console.log(`  pos ${name}: → ${forced} (ovr ${attrs.overall})`);
  }

  let lineupsFixed = 0;
  for (const [teamId, pref] of Object.entries(PREFERRED_STARTERS)) {
    const teamMem = memberships.filter((m) => m.teamId === teamId && (m.to == null || m.to === undefined));
    const squad = [];
    for (const m of teamMem) {
      const p = byId.get(m.playerId);
      if (!p || !String(p.id).startsWith("espn_")) continue;
      squad.push({
        playerId: p.id,
        name: p.displayName || p.name,
        pos: p.primaryPosition,
        min: 0,
        pts: Number(p.overall) || 70,
      });
    }
    const starters = pickPreferredStarters(teamId, squad);
    const starterIds = new Set(starters.map((s) => s.playerId));

    if (!dryRun) {
      for (const m of teamMem) {
        m.squadRole = starterIds.has(m.playerId) ? "FIRST_TEAM" : "BENCH";
        m.captain = false;
      }
      const capId = starters[0]?.playerId;
      const cap = teamMem.find((m) => m.playerId === capId);
      if (cap) cap.captain = true;

      let lu = lineups.find((l) => l.teamId === teamId);
      if (!lu) {
        lu = { id: `${teamId}_lineup`, teamId, formation: "BASKETBALL_5", starters: [] };
        lineups.push(lu);
      }
      lu.formation = "BASKETBALL_5";
      lu.starters = starters;
    }

    lineupsFixed += 1;
    console.log(`  lineup ${teamId}:`);
    for (const s of starters) {
      const p = byId.get(s.playerId);
      const want = pref[s.slot];
      console.log(`    ${s.slot} ${p?.displayName || s.playerId}${want && canonicalPlayerName(p?.displayName) !== canonicalPlayerName(want) ? ` (wanted ${want})` : ""}`);
    }
  }

  if (!dryRun) {
    fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
    fs.writeFileSync(membershipsPath, `${JSON.stringify(memberships, null, 2)}\n`);
    fs.writeFileSync(lineupsPath, `${JSON.stringify(lineups, null, 2)}\n`);
  }

  console.log(
    `${dryRun ? "DRY RUN — " : ""}roster overrides: positions=${posFixed}, lineups=${lineupsFixed}, positionKeys=${Object.keys(POSITION_OVERRIDES).length}`,
  );
}

main();
