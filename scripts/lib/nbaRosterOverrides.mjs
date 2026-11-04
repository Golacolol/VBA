/**
 * Manual corrections on top of ESPN live rosters.
 * - Position overrides (e.g. Draymond / Wemby at C)
 * - Preferred starting fives (ignore injury/minute noise for game squads)
 *
 * Classic eras are untouched — these keys are current display names / espn team ids only.
 */

/** displayName → forced primaryPosition */
export const POSITION_OVERRIDES = {
  "Draymond Green": "C",
  "Victor Wembanyama": "C",
};

/**
 * Preferred starters per current franchise id.
 * Names must match ESPN displayName (or III suffix variants).
 * Slots: PG SG SF PF C
 */
export const PREFERRED_STARTERS = {
  nba_gsw: {
    PG: "Stephen Curry",
    SG: "Brandin Podziemski",
    SF: "Jimmy Butler III",
    PF: "Kristaps Porzingis",
    C: "Draymond Green",
  },
  nba_sas: {
    PG: "De'Aaron Fox",
    SG: "Stephon Castle",
    SF: "Devin Vassell",
    PF: "Harrison Barnes",
    C: "Victor Wembanyama",
  },
};

/** Alternate name keys → canonical ESPN displayName used in squad maps. */
export const NAME_ALIASES = {
  "Jimmy Butler": "Jimmy Butler III",
  Wembanyama: "Victor Wembanyama",
  "Victor Wembenyama": "Victor Wembanyama",
};

export function canonicalPlayerName(name) {
  const n = String(name || "").trim();
  return NAME_ALIASES[n] || n;
}

export function positionOverrideFor(name) {
  const n = canonicalPlayerName(name);
  if (POSITION_OVERRIDES[n]) return POSITION_OVERRIDES[n];
  const stripped = n.replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, "").trim();
  return POSITION_OVERRIDES[stripped] || null;
}

/**
 * Pick starters from a squad list using preferred names when present.
 * @param {string} teamId
 * @param {{ playerId: string, name: string, pos: string, min?: number, pts?: number }[]} squad
 * @param {string[]} slots
 */
export function pickPreferredStarters(teamId, squad, slots = ["PG", "SG", "SF", "PF", "C"]) {
  const pref = PREFERRED_STARTERS[teamId] || null;
  const used = new Set();
  const starters = [];
  const byName = new Map();
  for (const s of squad) {
    byName.set(canonicalPlayerName(s.name), s);
    byName.set(String(s.name || "").replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, "").trim(), s);
  }

  for (const slot of slots) {
    let pick = null;
    const want = pref?.[slot];
    if (want) {
      pick = byName.get(canonicalPlayerName(want)) || byName.get(want);
      if (pick && used.has(pick.playerId)) pick = null;
    }
    if (!pick) {
      const candidates = squad
        .filter((s) => !used.has(s.playerId) && s.pos === slot)
        .sort((a, b) => (b.min ?? 0) + (b.pts ?? 0) - ((a.min ?? 0) + (a.pts ?? 0)));
      pick = candidates[0] || null;
    }
    if (!pick) {
      pick =
        squad
          .filter((s) => !used.has(s.playerId))
          .sort((a, b) => (b.min ?? 0) + (b.pts ?? 0) - ((a.min ?? 0) + (a.pts ?? 0)))[0] || null;
    }
    if (pick) {
      used.add(pick.playerId);
      starters.push({ playerId: pick.playerId, slot });
    }
  }
  return starters;
}
