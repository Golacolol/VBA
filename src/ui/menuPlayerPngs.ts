/**
 * Options → Display → Player PNGs (MiTeam & Play Next Fixture).
 * Default off: cards use club emblems; pitch/bench counters use jersey name + number.
 * Pyramid ignores this flag and always uses its own portrait rules.
 */

let enabled = false;

export function setMenuPlayerPngsEnabled(on: boolean): void {
  enabled = !!on;
}

/** True when Display → Player PNGs is on (persisted). Default off. */
export function menuPlayerPngsEnabled(): boolean {
  return enabled;
}
