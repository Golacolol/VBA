/**
 * Pyramid Draft — snake draft of 13-man rosters (5 + 8 bench) among human / AI seats.
 */
import type { GameDatabase, SquadPlayer } from "../../core/Database";
import type { MiTeamRosterSlot } from "../../core/SaveManager";
import { miteamFillOrder } from "../miteam/MiTeam";
import {
  isMiTeamBenchSlot,
  parseFilter,
  playerIdentityKey,
  positionFitsMiTeamSlot,
  serializeFilter,
  teamMatchesFilter,
  type MiTeamPoolFilter,
} from "../miteam/MiTeamPool";

export const DRAFT_ROSTER_SIZE = 13;
export const DRAFT_DEFAULT_SEATS = 5;
export const DRAFT_MIN_SEATS = 2;
export const DRAFT_MAX_SEATS = 8;
/**
 * Soft cap for the undrafted card grid. Uncapped Infinity freezes the hub
 * (thousands of player-card DOM nodes per render / pick).
 */
export const DRAFT_CANDIDATE_LIMIT = 150;
/** Larger pool when AI / auto-fill scores by roster need. */
export const DRAFT_AI_POOL_LIMIT = 160;

export type DraftFilterId =
  | "all"
  | "current"
  | "classic"
  | "east"
  | "west"
  | "east_classic"
  | "west_classic";

export const DRAFT_FILTERS: { id: DraftFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "current", label: "Current" },
  { id: "classic", label: "Classic" },
  { id: "east", label: "East" },
  { id: "west", label: "West" },
  { id: "east_classic", label: "East classic" },
  { id: "west_classic", label: "West classic" },
];

export type DraftSeatKind = "human" | "ai";

export type DraftSeat = {
  id: string;
  name: string;
  kind: DraftSeatKind;
  roster: MiTeamRosterSlot[];
};

export type DraftStatus = "ready" | "picking" | "done";

export type DraftSave = {
  filter: DraftFilterId;
  seats: DraftSeat[];
  /** Seat index that owns pick #1 (snake start). */
  firstSeat: number;
  /** 0-based global pick counter. */
  pickIndex: number;
  /** Lobby until Start; then snake picks; done when every seat is full. */
  status: DraftStatus;
};

export function draftPoolFilter(id: DraftFilterId): MiTeamPoolFilter {
  switch (id) {
    case "current":
      return { kind: "current" };
    case "classic":
      return { kind: "classic" };
    case "east":
      return { kind: "league", league: "EAST" };
    case "west":
      return { kind: "league", league: "WEST" };
    case "east_classic":
      return { kind: "classic_league", league: "EAST" };
    case "west_classic":
      return { kind: "classic_league", league: "WEST" };
    default:
      return { kind: "all" };
  }
}

export function isDraftFilterId(v: unknown): v is DraftFilterId {
  return typeof v === "string" && DRAFT_FILTERS.some((f) => f.id === v);
}

export function draftSlots(): string[] {
  return miteamFillOrder().slice(0, DRAFT_ROSTER_SIZE);
}

export function nextEmptyDraftSlot(roster: readonly MiTeamRosterSlot[]): string | null {
  const filled = new Set(roster.map((r) => r.slot));
  for (const slot of draftSlots()) {
    if (!filled.has(slot)) return slot;
  }
  return null;
}

/** Snake seat for a global pick index, rotated so `firstSeat` opens. */
export function draftSeatForPick(pickIndex: number, seatCount: number, firstSeat: number): number {
  if (seatCount <= 0) return 0;
  const round = Math.floor(pickIndex / seatCount);
  const pos = pickIndex % seatCount;
  const order = round % 2 === 0 ? pos : seatCount - 1 - pos;
  return ((firstSeat % seatCount) + order + seatCount * 8) % seatCount;
}

export function draftTotalPicks(seatCount: number): number {
  return seatCount * DRAFT_ROSTER_SIZE;
}

export function takenPlayerIds(seats: readonly DraftSeat[]): Set<string> {
  const out = new Set<string>();
  for (const seat of seats) {
    for (const row of seat.roster) out.add(row.playerId);
  }
  return out;
}

/** @see playerIdentityKey — shared with MiTeam pack exclusion. */
export const draftPlayerIdentityKey = playerIdentityKey;

/** Identity keys for everyone already drafted (covers all id variants of that name). */
export function takenDraftIdentityKeys(db: GameDatabase, seats: readonly DraftSeat[]): Set<string> {
  const keys = new Set<string>();
  for (const id of takenPlayerIds(seats)) {
    const player = db.players.get(id);
    keys.add(player ? playerIdentityKey(player) : id);
  }
  return keys;
}

function isClassicPlayerId(id: string): boolean {
  return id.startsWith("classic_");
}

/**
 * Pick which form of a person belongs on the draft board.
 * Mixed pools prefer curated classic peaks over live espn_* so ratings match Pyramid.
 * Same era-class: higher authored overall, then stable id order.
 */
export function preferDraftSquadPlayer(
  prev: SquadPlayer,
  next: SquadPlayer,
  opts: { preferClassic: boolean },
): SquadPlayer {
  if (opts.preferClassic) {
    const prevClassic = isClassicPlayerId(prev.player.id);
    const nextClassic = isClassicPlayerId(next.player.id);
    if (nextClassic !== prevClassic) return nextClassic ? next : prev;
  }
  if (next.overall !== prev.overall) return next.overall > prev.overall ? next : prev;
  return next.player.id.localeCompare(prev.player.id) < 0 ? next : prev;
}

function defaultSeatName(index: number, kind: DraftSeatKind): string {
  if (index === 0 && kind === "human") return "You";
  if (kind === "human") return `Player ${index + 1}`;
  return `CPU ${index + 1}`;
}

export function createDraftSeat(index: number, kind: DraftSeatKind = index === 0 ? "human" : "ai"): DraftSeat {
  return {
    id: `draft_seat_${index + 1}`,
    name: defaultSeatName(index, kind),
    kind,
    roster: [],
  };
}

export function defaultDraftSave(seatCount = DRAFT_DEFAULT_SEATS): DraftSave {
  const n = Math.max(DRAFT_MIN_SEATS, Math.min(DRAFT_MAX_SEATS, Math.round(seatCount)));
  const seats = Array.from({ length: n }, (_, i) => createDraftSeat(i, i === 0 ? "human" : "ai"));
  const firstSeat = Math.floor(Math.random() * n);
  return {
    filter: "all",
    seats,
    firstSeat,
    pickIndex: 0,
    status: "ready",
  };
}

export function restartDraft(prev?: DraftSave | null): DraftSave {
  const n = prev?.seats.length ?? DRAFT_DEFAULT_SEATS;
  const seats = (prev?.seats ?? defaultDraftSave(n).seats).map((s, i) => ({
    ...s,
    id: s.id || `draft_seat_${i + 1}`,
    name: s.name || defaultSeatName(i, s.kind),
    kind: s.kind === "human" ? ("human" as const) : ("ai" as const),
    roster: [] as MiTeamRosterSlot[],
  }));
  const count = Math.max(DRAFT_MIN_SEATS, Math.min(DRAFT_MAX_SEATS, seats.length));
  while (seats.length < count) seats.push(createDraftSeat(seats.length));
  seats.length = count;
  return {
    filter: isDraftFilterId(prev?.filter) ? prev!.filter : "all",
    seats,
    firstSeat: Math.floor(Math.random() * seats.length),
    pickIndex: 0,
    status: "ready",
  };
}

/** Leave the lobby and begin snake picks (keeps seats / filter / first pick). */
export function startDraft(draft: DraftSave): DraftSave {
  if (draft.status === "picking") return draft;
  if (draft.status === "done") return startDraft(restartDraft(draft));
  return {
    ...draft,
    seats: draft.seats.map((s) => ({ ...s, roster: [] as MiTeamRosterSlot[] })),
    pickIndex: 0,
    status: "picking",
  };
}

export function normalizeDraftSave(raw: unknown): DraftSave {
  const o = raw && typeof raw === "object" ? (raw as Partial<DraftSave>) : null;
  if (!o) return defaultDraftSave();
  const filter = isDraftFilterId(o.filter) ? o.filter : "all";
  const rawSeats = Array.isArray(o.seats) ? o.seats : [];
  const targetCount =
    rawSeats.length >= DRAFT_MIN_SEATS
      ? Math.min(DRAFT_MAX_SEATS, rawSeats.length)
      : DRAFT_DEFAULT_SEATS;
  const seats: DraftSeat[] = [];
  for (let i = 0; i < targetCount; i++) {
    const s = rawSeats[i] as Partial<DraftSeat> | undefined;
    const kind: DraftSeatKind = s?.kind === "human" ? "human" : i === 0 && !s ? "human" : s?.kind === "ai" ? "ai" : i === 0 ? "human" : "ai";
    const roster = Array.isArray(s?.roster)
      ? s!.roster
          .filter(
            (r): r is MiTeamRosterSlot =>
              !!r &&
              typeof r === "object" &&
              typeof (r as MiTeamRosterSlot).playerId === "string" &&
              typeof (r as MiTeamRosterSlot).slot === "string",
          )
          .map((r) => ({
            playerId: r.playerId.trim(),
            slot: r.slot.trim(),
            shirtNumber: Math.max(0, Math.min(99, Math.round(Number(r.shirtNumber) || i + 1))),
            ...(typeof r.sourceTeamId === "string" && r.sourceTeamId.trim()
              ? { sourceTeamId: r.sourceTeamId.trim() }
              : {}),
          }))
          .slice(0, DRAFT_ROSTER_SIZE)
      : [];
    seats.push({
      id: typeof s?.id === "string" && s.id.trim() ? s.id.trim() : `draft_seat_${i + 1}`,
      name: typeof s?.name === "string" && s.name.trim() ? s.name.trim() : defaultSeatName(i, kind),
      kind,
      roster,
    });
  }
  while (seats.length < DRAFT_MIN_SEATS) seats.push(createDraftSeat(seats.length));
  const firstSeat = Number.isInteger(o.firstSeat)
    ? Math.max(0, Math.min(seats.length - 1, Number(o.firstSeat)))
    : 0;
  const total = draftTotalPicks(seats.length);
  let pickIndex = Number.isFinite(Number(o.pickIndex)) ? Math.max(0, Math.floor(Number(o.pickIndex))) : 0;
  let status: DraftStatus =
    o.status === "done" ? "done" : o.status === "ready" ? "ready" : o.status === "picking" ? "picking" : "ready";
  // Do not coerce empty "picking" → "ready" here — that undoes Start (pickIndex 0, empty rosters).
  // Lobby-on-open is handled in PyramidHub.setView instead.
  if (pickIndex >= total || seats.every((s) => s.roster.length >= DRAFT_ROSTER_SIZE)) {
    pickIndex = total;
    status = "done";
  }
  return { filter, seats, firstSeat, pickIndex, status };
}

export function addDraftSeat(draft: DraftSave): DraftSave {
  if (draft.seats.length >= DRAFT_MAX_SEATS) return draft;
  const seats = [...draft.seats, createDraftSeat(draft.seats.length, "ai")];
  return restartDraft({ ...draft, seats });
}

export function toggleDraftSeatKind(draft: DraftSave, seatIndex: number): DraftSave {
  if (seatIndex < 0 || seatIndex >= draft.seats.length) return draft;
  const seats = draft.seats.map((s, i) => {
    if (i !== seatIndex) return s;
    const kind: DraftSeatKind = s.kind === "human" ? "ai" : "human";
    return { ...s, kind, name: defaultSeatName(i, kind) };
  });
  return { ...draft, seats };
}

export function setDraftFilter(draft: DraftSave, filter: DraftFilterId): DraftSave {
  if (!isDraftFilterId(filter) || filter === draft.filter) return draft;
  // Lobby: swap the pool in place. Mid-draft: restart so taken ids stay coherent.
  if (draft.status === "ready") return { ...draft, filter };
  return restartDraft({ ...draft, filter });
}

export type DraftPickContext = {
  seatIndex: number;
  seat: DraftSeat;
  /** Hint slot (next empty in fill order) — AI still picks by roster need. */
  slot: string;
  pickNumber: number;
};

export function currentDraftPick(draft: DraftSave): DraftPickContext | null {
  if (draft.status !== "picking") return null;
  const total = draftTotalPicks(draft.seats.length);
  if (draft.pickIndex >= total) return null;
  const seatIndex = draftSeatForPick(draft.pickIndex, draft.seats.length, draft.firstSeat);
  const seat = draft.seats[seatIndex];
  if (!seat) return null;
  if (seat.roster.length >= DRAFT_ROSTER_SIZE) return null;
  const slot = nextEmptyDraftSlot(seat.roster) ?? draftSlots()[seat.roster.length] ?? "BENCH_1";
  return { seatIndex, seat, slot, pickNumber: draft.pickIndex + 1 };
}

/**
 * Undrafted pool for the board — any position, sorted by authored overall.
 * One entry per person; already-drafted identities excluded.
 * On All (mixed classic + current), classic peak forms win so board OVRs match Pyramid.
 */
export function draftCandidates(
  db: GameDatabase,
  draft: DraftSave,
  limit = DRAFT_CANDIDATE_LIMIT,
): SquadPlayer[] {
  const filter = draftPoolFilter(draft.filter);
  const preferClassic = filter.kind === "all";
  const excludeIds = takenPlayerIds(draft.seats);
  const excludeKeys = takenDraftIdentityKeys(db, draft.seats);
  const bestByKey = new Map<string, SquadPlayer>();
  for (const team of db.teams.values()) {
    if (!teamMatchesFilter(team, filter)) continue;
    for (const sp of db.getSquad(team.id)) {
      if (excludeIds.has(sp.player.id)) continue;
      const key = draftPlayerIdentityKey(sp.player);
      if (excludeKeys.has(key)) continue;
      const prev = bestByKey.get(key);
      bestByKey.set(key, prev ? preferDraftSquadPlayer(prev, sp, { preferClassic }) : sp);
    }
  }
  const ranked = [...bestByKey.values()].sort(
    (a, b) => b.overall - a.overall || a.player.name.localeCompare(b.player.name),
  );
  if (!Number.isFinite(limit) || limit <= 0) return ranked;
  return ranked.slice(0, Math.max(0, Math.floor(limit)));
}

function shirtForSeat(roster: readonly MiTeamRosterSlot[], preferred: number): number {
  const used = new Set(roster.map((r) => r.shirtNumber));
  let n = Math.max(0, Math.min(99, preferred));
  for (let i = 0; i < 100; i++) {
    const tryN = (n + i) % 100;
    if (!used.has(tryN)) return tryN;
  }
  return n;
}

function resolveSquadPlayer(db: GameDatabase, playerId: string): SquadPlayer | null {
  for (const team of db.teams.values()) {
    const hit = db.getSquad(team.id).find((s) => s.player.id === playerId);
    if (hit) return hit;
  }
  return null;
}

const DRAFT_STARTERS = ["PG", "SG", "SF", "PF", "C"] as const;
/** First bench wave — filled as a group after the starting five. */
const DRAFT_SUB5 = ["BENCH_1", "BENCH_2", "BENCH_3", "BENCH_4", "BENCH_5"] as const;
const DRAFT_REST_BENCH = ["BENCH_6", "BENCH_7", "BENCH_8"] as const;

export type DraftRosterPhase = "starters" | "sub5" | "rest";

/** Starting five → sub five → last three bench. */
export function draftRosterPhase(roster: readonly MiTeamRosterSlot[]): DraftRosterPhase {
  const filled = new Set(roster.map((r) => r.slot));
  if (DRAFT_STARTERS.some((s) => !filled.has(s))) return "starters";
  if (DRAFT_SUB5.some((s) => !filled.has(s))) return "sub5";
  return "rest";
}

export function draftPhaseSlots(phase: DraftRosterPhase): readonly string[] {
  if (phase === "starters") return DRAFT_STARTERS;
  if (phase === "sub5") return DRAFT_SUB5;
  return DRAFT_REST_BENCH;
}

/**
 * Seat a pick inside the current wave only (starters, then sub-5, then rest).
 * Within a wave: exact position → neighbor fit → first open hole (never skip a hole).
 */
export function bestOpenSlotForPlayer(
  roster: readonly MiTeamRosterSlot[],
  primaryPosition: string | null | undefined,
): string | null {
  const filled = new Set(roster.map((r) => r.slot));
  const phase = draftRosterPhase(roster);
  const empty = draftPhaseSlots(phase).filter((s) => !filled.has(s));
  if (!empty.length) {
    // Safety: fall through to any remaining roster hole.
    const leftover = draftSlots().filter((s) => !filled.has(s));
    return leftover[0] ?? null;
  }
  const pos = (primaryPosition ?? "").trim().toUpperCase();
  if (!pos) return empty[0] ?? null;

  if (phase === "starters") {
    // Exact hole always wins (C → C while SF is also open — never spill to SF first).
    if (empty.includes(pos)) return pos;
    const naturalIdx = DRAFT_STARTERS.indexOf(pos as (typeof DRAFT_STARTERS)[number]);
    const starterIndex = (s: string) => DRAFT_STARTERS.indexOf(s as (typeof DRAFT_STARTERS)[number]);
    const byLineDistance = (a: string, b: string) => {
      if (naturalIdx < 0) return starterIndex(a) - starterIndex(b);
      return Math.abs(starterIndex(a) - naturalIdx) - Math.abs(starterIndex(b) - naturalIdx);
    };
    const fits = empty.filter((s) => positionFitsMiTeamSlot(s, pos));
    if (fits.length) return [...fits].sort(byLineDistance)[0]!;
    // No starter-band fit (e.g. C with only SG open) — park on the bench.
    // Never force a Center into SG/SF just to fill a starter hole.
    const benchOpen = [...DRAFT_SUB5, ...DRAFT_REST_BENCH].filter((s) => !filled.has(s));
    return benchOpen[0] ?? null;
  }

  // Bench waves — any open hole in the wave (order BENCH_1…).
  return empty[0] ?? null;
}

export function applyDraftPick(
  draft: DraftSave,
  playerId: string,
  db: GameDatabase,
): DraftSave {
  const ctx = currentDraftPick(draft);
  if (!ctx) return draft;
  if (takenPlayerIds(draft.seats).has(playerId)) return draft;
  const sp = resolveSquadPlayer(db, playerId);
  if (!sp) return draft;
  // Block the other classic/current copy of the same person.
  if (takenDraftIdentityKeys(db, draft.seats).has(draftPlayerIdentityKey(sp.player))) return draft;
  const slot = bestOpenSlotForPlayer(ctx.seat.roster, sp.player.primaryPosition);
  if (!slot) return draft;
  const row: MiTeamRosterSlot = {
    playerId,
    slot,
    shirtNumber: shirtForSeat(ctx.seat.roster, sp.shirtNumber || ctx.seat.roster.length + 1),
    sourceTeamId: sp.membership.teamId,
  };
  const seats = draft.seats.map((s, i) =>
    i === ctx.seatIndex ? { ...s, roster: [...s.roster, row] } : s,
  );
  const pickIndex = draft.pickIndex + 1;
  const done = pickIndex >= draftTotalPicks(seats.length);
  return {
    ...draft,
    seats,
    pickIndex,
    status: done ? "done" : "picking",
  };
}

/** Open starter holes for a seat (PG→C order). */
export function emptyStarterNeeds(roster: readonly MiTeamRosterSlot[]): string[] {
  const filled = new Set(roster.map((r) => r.slot));
  return DRAFT_STARTERS.filter((s) => !filled.has(s));
}

function sourceTeamCounts(seats: readonly DraftSeat[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const seat of seats) {
    for (const row of seat.roster) {
      const tid = row.sourceTeamId?.trim();
      if (!tid) continue;
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
  }
  return counts;
}

function seatSourceTeamCounts(seat: DraftSeat): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of seat.roster) {
    const tid = row.sourceTeamId?.trim();
    if (!tid) continue;
    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }
  return counts;
}

/**
 * Rank AI / auto-fill candidates: strong overall, team variety, light jitter.
 * Returns best-first (index 0 = pick; 1–2 = runners-up for the reveal UI).
 */
export function rankNeedsBasedPicks(
  db: GameDatabase,
  draft: DraftSave,
  ctx: DraftPickContext,
  limit = 3,
): SquadPlayer[] {
  const pool = draftCandidates(db, draft, DRAFT_AI_POOL_LIMIT);
  if (!pool.length) return [];
  const topBand = pool.slice(0, Math.min(14, pool.length));
  const floorOvr = topBand[0]!.overall - 8;
  const candidates = topBand.filter((sp) => sp.overall >= floorOvr);
  const seatTeams = seatSourceTeamCounts(ctx.seat);
  const globalTeams = sourceTeamCounts(draft.seats);
  const scored = candidates.map((sp) => {
    const teamId = sp.membership.teamId;
    const seatN = seatTeams.get(teamId) ?? 0;
    const globalN = globalTeams.get(teamId) ?? 0;
    // Prefer elite OVR; penalize repeating the same source team on this seat / board.
    const score = sp.overall - seatN * 5.5 - globalN * 1.75 + Math.random() * 4;
    return { sp, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const out = scored.slice(0, Math.max(1, limit)).map((row) => row.sp);
  if (!out.length && pool[0]) out.push(pool[0]);
  return out;
}

/**
 * AI / auto-fill: strong overall, with team variety (avoid stacking one franchise)
 * and light jitter so boards don't clone the same top card every seat.
 */
export function chooseNeedsBasedPick(
  db: GameDatabase,
  draft: DraftSave,
  ctx: DraftPickContext,
): SquadPlayer | null {
  return rankNeedsBasedPicks(db, draft, ctx, 1)[0] ?? null;
}

/** One needs-based pick (AI seats only unless `forAnyone`). */
export function aiDraftPick(
  db: GameDatabase,
  draft: DraftSave,
  opts?: { forAnyone?: boolean },
): DraftSave {
  const step = aiDraftPickStep(db, draft, opts);
  return step?.draft ?? draft;
}

/** One AI/auto pick with the chosen player id (for reveal UI). */
export function aiDraftPickStep(
  db: GameDatabase,
  draft: DraftSave,
  opts?: { forAnyone?: boolean },
): { draft: DraftSave; playerId: string; seatName: string; seatIndex: number } | null {
  const ctx = currentDraftPick(draft);
  if (!ctx || draft.status === "done") return null;
  if (!opts?.forAnyone && ctx.seat.kind === "human") return null;
  const pick = chooseNeedsBasedPick(db, draft, ctx);
  if (!pick) {
    return {
      draft: { ...draft, status: "done", pickIndex: draftTotalPicks(draft.seats.length) },
      playerId: "",
      seatName: ctx.seat.name,
      seatIndex: ctx.seatIndex,
    };
  }
  return {
    draft: applyDraftPick(draft, pick.player.id, db),
    playerId: pick.player.id,
    seatName: ctx.seat.name,
    seatIndex: ctx.seatIndex,
  };
}

/** Run AI seats until a human must pick or the draft completes (no UI reveal). */
export function advanceDraftAi(db: GameDatabase, draft: DraftSave, maxSteps = 200): DraftSave {
  let next = draft;
  for (let i = 0; i < maxSteps; i++) {
    const ctx = currentDraftPick(next);
    if (!ctx || next.status === "done") break;
    if (ctx.seat.kind === "human") break;
    next = aiDraftPick(db, next);
  }
  return next;
}

/** Complete the entire draft for every seat (human + AI) with needs-based picks. */
export function autoFillDraft(db: GameDatabase, draft: DraftSave): DraftSave {
  let next = draft.status === "ready" ? startDraft(draft) : draft;
  const total = draftTotalPicks(next.seats.length);
  const guard = total + 8;
  for (let i = 0; i < guard; i++) {
    if (next.pickIndex >= total) {
      return { ...next, pickIndex: total, status: "done" };
    }
    const ctx = currentDraftPick(next);
    if (!ctx) {
      return { ...next, pickIndex: total, status: "done" };
    }
    const pick = chooseNeedsBasedPick(db, next, ctx);
    if (!pick) {
      return { ...next, pickIndex: total, status: "done" };
    }
    const applied = applyDraftPick(next, pick.player.id, db);
    if (applied.pickIndex === next.pickIndex) {
      return { ...applied, pickIndex: total, status: "done" };
    }
    next = applied;
  }
  return {
    ...next,
    pickIndex: Math.min(total, next.pickIndex),
    status: next.pickIndex >= total ? "done" : next.status,
  };
}

/** Swap two roster slots (starters ↔ bench, bench reorder, or XI shuffle). */
export function swapDraftRosterSlots(
  roster: readonly MiTeamRosterSlot[],
  slotA: string,
  slotB: string,
): MiTeamRosterSlot[] {
  if (slotA === slotB) return roster.map((r) => ({ ...r }));
  const next = roster.map((r) => ({ ...r }));
  const a = next.find((r) => r.slot === slotA);
  const b = next.find((r) => r.slot === slotB);
  if (!a || !b) return next;
  a.slot = slotB;
  b.slot = slotA;
  return next;
}

/** Serialize filter id for UI data attributes (stable). */
export function draftFilterAttr(id: DraftFilterId): string {
  return serializeFilter(draftPoolFilter(id));
}

export function draftFilterFromAttr(raw: string): DraftFilterId {
  const f = parseFilter(raw);
  if (f.kind === "current") return "current";
  if (f.kind === "classic") return "classic";
  if (f.kind === "league" && f.league === "EAST") return "east";
  if (f.kind === "league" && f.league === "WEST") return "west";
  if (f.kind === "classic_league" && f.league === "EAST") return "east_classic";
  if (f.kind === "classic_league" && f.league === "WEST") return "west_classic";
  return "all";
}
