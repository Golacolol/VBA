import { describe, expect, it } from "vitest";
import {
  applyDraftPick,
  autoFillDraft,
  bestOpenSlotForPlayer,
  chooseNeedsBasedPick,
  createDraftSeat,
  currentDraftPick,
  defaultDraftSave,
  DRAFT_DEFAULT_SEATS,
  DRAFT_ROSTER_SIZE,
  draftCandidates,
  draftPlayerIdentityKey,
  draftPoolFilter,
  draftSeatForPick,
  draftTotalPicks,
  draftRosterPhase,
  normalizeDraftSave,
  restartDraft,
  setDraftFilter,
  swapDraftRosterSlots,
} from "./draft";
import { GameDatabase } from "../../core/Database";
import { SaveManager } from "../../core/SaveManager";

describe("draft engine", () => {
  it("defaults to You + four AI seats and a random first pick", () => {
    const d = defaultDraftSave();
    expect(d.seats).toHaveLength(DRAFT_DEFAULT_SEATS);
    expect(d.seats[0]?.kind).toBe("human");
    expect(d.seats.slice(1).every((s) => s.kind === "ai")).toBe(true);
    expect(d.firstSeat).toBeGreaterThanOrEqual(0);
    expect(d.firstSeat).toBeLessThan(DRAFT_DEFAULT_SEATS);
    expect(d.status).toBe("picking");
    expect(draftTotalPicks(d.seats.length)).toBe(DRAFT_DEFAULT_SEATS * DRAFT_ROSTER_SIZE);
  });

  it("snakes pick order from the first seat", () => {
    // firstSeat=1, 3 seats → 1,2,0, 0,2,1, 1,...
    expect(draftSeatForPick(0, 3, 1)).toBe(1);
    expect(draftSeatForPick(1, 3, 1)).toBe(2);
    expect(draftSeatForPick(2, 3, 1)).toBe(0);
    expect(draftSeatForPick(3, 3, 1)).toBe(0);
    expect(draftSeatForPick(4, 3, 1)).toBe(2);
    expect(draftSeatForPick(5, 3, 1)).toBe(1);
  });

  it("seats picks in starter wave, then sub-5, without skipping holes", () => {
    expect(bestOpenSlotForPlayer([], "PG")).toBe("PG");
    expect(bestOpenSlotForPlayer([{ playerId: "a", slot: "PG", shirtNumber: 1 }], "SG")).toBe("SG");
    // C with SF still open → C, never SF.
    expect(bestOpenSlotForPlayer([], "C")).toBe("C");
    expect(
      bestOpenSlotForPlayer(
        [
          { playerId: "a", slot: "PG", shirtNumber: 1 },
          { playerId: "b", slot: "SG", shirtNumber: 2 },
        ],
        "C",
      ),
    ).toBe("C");
    // C taken, SF+PF open → Center prefers PF over SF.
    expect(
      bestOpenSlotForPlayer(
        [
          { playerId: "a", slot: "PG", shirtNumber: 1 },
          { playerId: "b", slot: "SG", shirtNumber: 2 },
          { playerId: "c", slot: "C", shirtNumber: 3 },
        ],
        "C",
      ),
    ).toBe("PF");
    // Starters incomplete → stay in starter wave (never bench yet).
    expect(
      bestOpenSlotForPlayer(
        [
          { playerId: "a", slot: "PG", shirtNumber: 1 },
          { playerId: "b", slot: "SG", shirtNumber: 2 },
          { playerId: "c", slot: "SF", shirtNumber: 3 },
          { playerId: "d", slot: "PF", shirtNumber: 4 },
        ],
        "PG",
      ),
    ).toBe("C");
    // After starting five, next wave is BENCH_1…5.
    const startersFull = ["PG", "SG", "SF", "PF", "C"].map((slot, i) => ({
      playerId: `s${i}`,
      slot,
      shirtNumber: i + 1,
    }));
    expect(bestOpenSlotForPlayer(startersFull, "PG")).toBe("BENCH_1");
    expect(
      bestOpenSlotForPlayer([...startersFull, { playerId: "b1", slot: "BENCH_1", shirtNumber: 6 }], "SG"),
    ).toBe("BENCH_2");
  });

  it("maps draft filters onto pool filters", () => {
    expect(draftPoolFilter("current")).toEqual({ kind: "current" });
    expect(draftPoolFilter("east")).toEqual({ kind: "league", league: "EAST" });
    expect(draftPoolFilter("west_classic")).toEqual({ kind: "classic_league", league: "WEST" });
  });

  it("restart clears rosters and re-rolls first pick", () => {
    const d = normalizeDraftSave({
      filter: "classic",
      seats: [createDraftSeat(0, "human"), createDraftSeat(1, "ai")],
      firstSeat: 0,
      pickIndex: 4,
      status: "picking",
    });
    d.seats[0]!.roster = [{ playerId: "x", slot: "PG", shirtNumber: 1 }];
    const next = restartDraft(d);
    expect(next.filter).toBe("classic");
    expect(next.seats).toHaveLength(2);
    expect(next.seats.every((s) => s.roster.length === 0)).toBe(true);
    expect(next.pickIndex).toBe(0);
    expect(next.status).toBe("picking");
  });

  it("changing filter restarts the board", () => {
    const d = defaultDraftSave(2);
    d.pickIndex = 3;
    const next = setDraftFilter(d, "east");
    expect(next.filter).toBe("east");
    expect(next.pickIndex).toBe(0);
    expect(next.seats.every((s) => s.roster.length === 0)).toBe(true);
  });

  it("offers undrafted players sorted by overall (any position)", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const draft = defaultDraftSave(2);
    draft.filter = "all";
    draft.firstSeat = 0;
    const ctx = currentDraftPick(draft);
    expect(ctx?.seat.kind).toBe("human");
    const board = draftCandidates(db, draft, 12);
    expect(board.length).toBeGreaterThan(5);
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1]!.overall).toBeGreaterThanOrEqual(board[i]!.overall);
    }
    const pick = applyDraftPick(draft, board[0]!.player.id, db);
    expect(pick.pickIndex).toBe(1);
    expect(pick.seats[0]!.roster).toHaveLength(1);
    expect(pick.seats[0]!.roster[0]!.playerId).toBe(board[0]!.player.id);
  });

  it("collapses classic variants of the same person (Moses Malone)", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const phi = "classic_phi_1982_83_p05";
    const atl = "classic_atl_1990_91_p05";
    expect(db.players.has(phi)).toBe(true);
    expect(db.players.has(atl)).toBe(true);
    expect(draftPlayerIdentityKey(db.players.get(phi)!)).toBe(
      draftPlayerIdentityKey(db.players.get(atl)!),
    );

    const draft = defaultDraftSave(2);
    draft.filter = "classic";
    draft.firstSeat = 0;
    const board = draftCandidates(db, draft, 500);
    const malones = board.filter((s) => /moses malone/i.test(s.player.displayName || s.player.name));
    expect(malones).toHaveLength(1);

    const picked = applyDraftPick(draft, phi, db);
    expect(picked.seats[0]!.roster[0]!.playerId).toBe(phi);
    const after = draftCandidates(db, picked, 500);
    expect(after.some((s) => s.player.id === atl || s.player.id === phi)).toBe(false);
    expect(applyDraftPick(picked, atl, db)).toEqual(picked);
  });

  it("AI picks from the top band with variety; roster phase is starters then sub-5", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const draft = defaultDraftSave(2);
    draft.filter = "all";
    draft.firstSeat = 0;
    const ctx = currentDraftPick(draft)!;
    const top = draftCandidates(db, draft, 14);
    const pick = chooseNeedsBasedPick(db, draft, ctx);
    expect(pick).toBeTruthy();
    expect(top.some((sp) => sp.player.id === pick!.player.id)).toBe(true);
    expect(pick!.overall).toBeGreaterThanOrEqual(top[0]!.overall - 8);
    expect(draftRosterPhase([])).toBe("starters");
    expect(
      draftRosterPhase(["PG", "SG", "SF", "PF", "C"].map((slot, i) => ({ playerId: `p${i}`, slot, shirtNumber: i }))),
    ).toBe("sub5");
    expect(
      draftRosterPhase(
        ["PG", "SG", "SF", "PF", "C", "BENCH_1", "BENCH_2", "BENCH_3", "BENCH_4", "BENCH_5"].map((slot, i) => ({
          playerId: `p${i}`,
          slot,
          shirtNumber: i,
        })),
      ),
    ).toBe("rest");
  });

  it("auto-fill completes every seat to 13", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const draft = defaultDraftSave(3);
    draft.filter = "all";
    draft.firstSeat = 0;
    const filled = autoFillDraft(db, draft);
    expect(filled.status).toBe("done");
    expect(filled.pickIndex).toBe(draftTotalPicks(3));
    for (const seat of filled.seats) {
      expect(seat.roster.length).toBe(DRAFT_ROSTER_SIZE);
      const slots = new Set(seat.roster.map((r) => r.slot));
      expect(slots.has("C")).toBe(true);
      expect(slots.has("PG")).toBe(true);
      expect(slots.has("BENCH_1")).toBe(true);
      expect(slots.has("BENCH_5")).toBe(true);
      expect(slots.has("BENCH_8")).toBe(true);
    }
  });

  it("swaps starter and bench slots without changing shirt numbers", () => {
    const roster = [
      { playerId: "a", slot: "PG", shirtNumber: 1 },
      { playerId: "b", slot: "BENCH_1", shirtNumber: 7 },
      { playerId: "c", slot: "SG", shirtNumber: 2 },
    ];
    const next = swapDraftRosterSlots(roster, "PG", "BENCH_1");
    expect(next.find((r) => r.playerId === "a")).toEqual({ playerId: "a", slot: "BENCH_1", shirtNumber: 1 });
    expect(next.find((r) => r.playerId === "b")).toEqual({ playerId: "b", slot: "PG", shirtNumber: 7 });
    expect(next.find((r) => r.playerId === "c")).toEqual({ playerId: "c", slot: "SG", shirtNumber: 2 });
  });
});
