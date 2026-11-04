/**
 * Pyramid hub — editable Top 50 tiers + interactive position ring around #1.
 */
import type { GameDatabase, SquadPlayer } from "../core/Database";
import type { SaveManager } from "../core/SaveManager";
import type { PlayerRecord, PositionCode } from "../data/schema";
import {
  buildPyramidRingSlots,
  defaultPyramidSave,
  elevatePoolToPyramid,
  ensurePyramidSave,
  movePyramidIndex,
  placePlayerInPool,
  isPyramidTierPatternId,
  PYRAMID_POOL_SIZE,
  PYRAMID_RING_POSITIONS,
  PYRAMID_SEED_VERSION,
  PYRAMID_SIZE,
  PYRAMID_TIER_COUNTS,
  PYRAMID_TIER_PATTERNS,
  PYRAMID_POSITION_TEAM_COUNTS,
  pyramidPositionTeamRows,
  pyramidTierRows,
  pyramidTierScalesFor,
  swapPyramidNeighbor,
  swapPyramidWithPool,
  type PyramidPositionDealMode,
  type PyramidSave,
  type PyramidTierPatternId,
  type PyramidViewId,
} from "../football/pyramid/defaultPyramid";
import {
  blankBracketSave,
  clearBracketWinners,
  isBracketRegionView,
  isPlayInMatch,
  normalizeBracketSave,
  resolveBracket,
  seedTeamIds,
  setBracketRegion,
  setBracketScore,
  setBracketWinner,
  type BracketMatchId,
  type BracketMatchup,
  type BracketSave,
  type BracketSeriesScore,
  type ConferenceBracket,
} from "../football/bracket/PlayoffBracket";
import {
  addDraftSeat,
  applyDraftPick,
  autoFillDraft,
  chooseNeedsBasedPick,
  currentDraftPick,
  DRAFT_FILTERS,
  DRAFT_MAX_SEATS,
  DRAFT_ROSTER_SIZE,
  draftCandidates,
  draftSlots,
  draftTotalPicks,
  isDraftFilterId,
  normalizeDraftSave,
  restartDraft,
  setDraftFilter,
  startDraft,
  swapDraftRosterSlots,
  toggleDraftSeatKind,
  type DraftSave,
  type DraftSeat,
} from "../football/pyramid/draft";
import { standingsFor } from "../football/league/Standings";
import { getFormation } from "../football/teams/Formation";
import { MITEAM_FORMATION } from "../core/SaveManager";
import { formationToPitchPercent, separatePitchMarkers } from "./CharacterSelect";
import { contrastingKitText } from "./kitContrast";
import {
  fitKitSurnameElements,
  kitInitialSurnameLabel,
  kitMarkerHtml,
  kitSurnameFromName,
  portraitAsset,
  portraitHtml,
  teamBadgeHtml,
} from "./Portrait";
import {
  nextPlayerCardFlipY,
  playerCardFlipSideFromClientX,
  playerCardShellHtml,
  type PlayerCardTeamContext,
} from "./playerCardShared";
import { nextProfileStatsMode, type ProfileStatsMode } from "./ProfileHex";
import { titleAttr } from "./infoOverlays";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

export type PyramidAction = "back";

type PyramidEntry = {
  playerId: string;
  rank: number;
  index: number;
  player: PlayerRecord | null;
  name: string;
  shirtNumber: number;
  position: PositionCode | string;
  color: string;
  textColor: string;
};

const RING_AUTO_DEG_PER_SEC = 4.5;
const VIEW_ZOOM_MIN = 0.55;
const VIEW_ZOOM_MAX = 1.85;
const VIEW_ZOOM_STEP = 0.12;
/** Ring opens slightly zoomed so inner ranks around #1 read clearly without stacking. */
const RING_DEFAULT_ZOOM = 1.12;

export class PyramidHub {
  readonly root: HTMLElement;
  private db!: GameDatabase;
  private save!: SaveManager;
  private dragFrom: { kind: "order" | "pool"; index: number } | null = null;
  private ringAngle = 0;
  /** Shared Pyramid + Ring content zoom (header − / +). */
  private viewZoom = 1;
  /** Pyramid view display pattern (row widths / list). Rank order unchanged. */
  private pyramidDisplay: PyramidTierPatternId = "steps";
  /**
   * POS A / POS B: false = #1 alone on top; true = #1 seated in the top five
   * and teams reshuffled. Re-clicking the active POS control flips this.
   */
  private positionsApexInTopTeam = false;
  private ringDragging = false;
  private ringLastX = 0;
  private ringRaf = 0;
  private ringLastTs = 0;
  private ringResizeObserver: ResizeObserver | null = null;
  /** Reserve search query (players outside Top 50 + 51–100). */
  private poolQuery = "";
  /** Open jersey-number picker (0–99), or null when closed. */
  private jerseyPick: number | null = null;
  /** AI pick flash — card shown for ~2s then cleared. */
  private draftAiReveal: { playerId: string; seatName: string; seatIndex: number } | null = null;
  private draftAiRevealTimer: ReturnType<typeof setTimeout> | null = null;
  /** Inspect a drafted seat’s court + bench (null = draft board). */
  private draftInspectSeat: number | null = null;
  /** Highlighted player inside the formation inspect panel. */
  private draftInspectPlayerId: string | null = null;
  /** TEAM SELECT (pitch) vs PLAYER SELECT (sports card in the pitch well). */
  private draftInspectMode: "team" | "player" = "team";
  private draftInspectFlipY = 0;
  private draftInspectProfileView: ProfileStatsMode = "hex";
  /** Drag source slot while rearranging a draft formation. */
  private draftLineupDragSlot: string | null = null;
  /** Ignore the click that follows an HTML5 drop so it does not reverse the swap. */
  private suppressDraftInspectClick = false;
  onAction: ((act: PyramidAction) => void) | null = null;

  private static readonly DRAFT_AI_REVEAL_MS = 3000;

  private readonly onWindowKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "pyramid-hub";
    parent.appendChild(this.root);
    this.hide();
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.root.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.root.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    this.root.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.root.addEventListener("dragstart", (e) => this.onDragStart(e));
    this.root.addEventListener("dragover", (e) => this.onDragOver(e));
    this.root.addEventListener("drop", (e) => this.onDrop(e));
    this.root.addEventListener("dragend", () => {
      this.dragFrom = null;
      this.draftLineupDragSlot = null;
      this.root
        .querySelectorAll(
          ".pyramid-cell.is-drag-over, .pyramid-cell.is-dragging, .pitch-slot.drag-over, .bench-card.drag-over, .bench-card.dragging, .pitch-token.dragging, .roster-row.dragging",
        )
        .forEach((el) => el.classList.remove("is-drag-over", "is-dragging", "drag-over", "dragging"));
    });
  }

  show(): void {
    this.root.classList.add("open");
    this.root.style.display = "";
    window.addEventListener("keydown", this.onWindowKeyDown);
  }

  hide(): void {
    this.stopRingSpin();
    this.clearDraftAiReveal();
    this.ringResizeObserver?.disconnect();
    this.ringResizeObserver = null;
    this.root.classList.remove("open");
    this.root.style.display = "none";
    window.removeEventListener("keydown", this.onWindowKeyDown);
    window.removeEventListener("resize", this.onWindowResize);
  }

  open(db: GameDatabase, save: SaveManager, opts?: { view?: PyramidViewId }): void {
    this.db = db;
    this.save = save;
    const known = new Set(db.players.keys());
    ensurePyramidSave(save, known);
    if (opts?.view) {
      const cur = ensurePyramidSave(save, known);
      save.data.pyramid = { ...cur, view: opts.view };
    }
    save.save();
    this.ringAngle = 0;
    this.viewZoom = this.state().view === "ring" ? RING_DEFAULT_ZOOM : 1;
    this.render();
    this.show();
    if (this.state().view === "ring") this.startRingSpin();
    window.addEventListener("resize", this.onWindowResize);
  }

  private readonly onWindowResize = (): void => {
    if (this.state().view === "ring") this.applyRingOrbitSize();
  };

  private state(): PyramidSave {
    return ensurePyramidSave(this.save, new Set(this.db.players.keys()));
  }

  private persist(patch: Partial<PyramidSave>): void {
    const cur = this.state();
    const jerseyChoice =
      patch.jerseyChoice !== undefined
        ? { ...patch.jerseyChoice }
        : cur.jerseyChoice
          ? { ...cur.jerseyChoice }
          : undefined;
    const draft = patch.draft !== undefined ? patch.draft : cur.draft;
    const bracket =
      patch.bracket !== undefined
        ? normalizeBracketSave(patch.bracket)
        : cur.bracket
          ? normalizeBracketSave(cur.bracket)
          : undefined;
    this.save.data.pyramid = {
      size: PYRAMID_SIZE,
      order: patch.order ? [...patch.order] : [...cur.order],
      pool: patch.pool ? [...patch.pool] : [...cur.pool],
      view: patch.view ?? cur.view,
      seedVersion: cur.seedVersion ?? PYRAMID_SEED_VERSION,
      ...(jerseyChoice && Object.keys(jerseyChoice).length ? { jerseyChoice } : {}),
      ...(draft ? { draft } : {}),
      ...(bracket ? { bracket } : {}),
    };
    this.save.save();
  }

  private draftState(): DraftSave {
    const cur = this.state().draft;
    if (cur) return normalizeDraftSave(cur);
    const fresh = restartDraft(null);
    this.persist({ draft: fresh });
    return fresh;
  }

  private persistDraft(draft: DraftSave): void {
    this.persist({ draft: normalizeDraftSave(draft) });
  }

  /** Prefer the membership for this classic era id (e.g. Kobe 09/10 → #24, not 00/01 #8). */
  private membershipForEntry(playerId: string) {
    const mems = this.db.membershipsForPlayer(playerId);
    if (!mems.length) return null;
    const teamGuess = playerId.replace(/_p\d+$/i, "");
    return mems.find((m) => m.teamId === teamGuess) ?? mems[0] ?? null;
  }

  private entryFor(playerId: string, index: number): PyramidEntry {
    let player: PlayerRecord | null = null;
    try {
      player = this.db.getPlayer(playerId);
    } catch {
      player = null;
    }
    const mem = this.membershipForEntry(playerId);
    const team = mem ? this.db.teams.get(mem.teamId) : null;
    const color = team?.primaryColor ?? "#1a2740";
    const textColor = team?.secondaryColor?.trim() || "#ffffff";
    return {
      playerId,
      rank: index + 1,
      index,
      player,
      name: player?.displayName || player?.name || playerId,
      shirtNumber: mem?.shirtNumber ?? 0,
      position: player?.primaryPosition ?? "SF",
      color,
      textColor,
    };
  }

  /** Kit-back badge only (surname over shirt #) — portrait stays separate. */
  private kitBadgeHtml(entry: PyramidEntry): string {
    // Include jersey 0 (Westbrook / Arenas); `> 0` wrongly fell back to rank.
    const shirt = Number.isFinite(entry.shirtNumber) ? entry.shirtNumber : entry.rank;
    return kitMarkerHtml(
      { id: entry.playerId, name: entry.name, displayName: entry.name },
      shirt,
      {
        primaryColor: entry.color,
        textColor: entry.textColor,
        className: "kit-marker-roster pyramid-kit-badge",
        badgeMode: "surname",
      },
    );
  }

  private teamCrestFallbackHtml(entry: PyramidEntry, tint: string): string {
    const mem = this.membershipForEntry(entry.playerId);
    const team = mem ? this.db.teams.get(mem.teamId) : null;
    if (team) {
      return `<div class="pyramid-cell-photo is-empty is-crest" style="--pyramid-tint:${tint}">${teamBadgeHtml(team, {
        className: "pyramid-photo-crest",
        size: 44,
      })}</div>`;
    }
    return `<div class="pyramid-cell-photo is-empty" style="--pyramid-tint:${tint}"><div class="pyramid-photo-fallback" style="background:${tint};color:${escapeAttr(entry.textColor)}">?</div></div>`;
  }

  private portraitHtml(entry: PyramidEntry): string {
    const src = entry.player ? portraitAsset(entry.player) : null;
    const tint = escapeAttr(entry.color);
    if (!src) return this.teamCrestFallbackHtml(entry, tint);
    const mem = this.membershipForEntry(entry.playerId);
    const team = mem ? this.db.teams.get(mem.teamId) : null;
    const crest = team
      ? teamBadgeHtml(team, { className: "pyramid-photo-crest", size: 44 })
      : `<div class="pyramid-photo-fallback" style="background:${tint};color:${escapeAttr(entry.textColor)}">?</div>`;
    return `<div class="pyramid-cell-photo has-photo" style="--pyramid-tint:${tint}">
      <img class="pyramid-player-png" alt="" src="${escapeAttr(src)}" draggable="false" onerror="const el=this.closest('.pyramid-cell-photo');if(!el)return;el.classList.remove('has-photo');el.classList.add('is-empty','is-crest');this.remove();const fb=el.querySelector('.pyramid-photo-crest-slot');if(fb)fb.hidden=false;"/>
      <div class="pyramid-photo-crest-slot" hidden>${crest}</div>
    </div>`;
  }

  private entries(): PyramidEntry[] {
    return this.state().order.map((id, i) => this.entryFor(id, i));
  }

  /** Full re-render without jumping the pyramid body scroll (↑↓ / drag reorder). */
  private renderKeepingScroll(): void {
    const scroller = this.root.querySelector<HTMLElement>("[data-pyramid-scroll]");
    const top = scroller?.scrollTop ?? 0;
    this.render();
    const next = this.root.querySelector<HTMLElement>("[data-pyramid-scroll]");
    if (next) {
      next.scrollTop = top;
      requestAnimationFrame(() => {
        const again = this.root.querySelector<HTMLElement>("[data-pyramid-scroll]");
        if (again) again.scrollTop = top;
      });
    }
  }

  render(): void {
    const st = this.state();
    const view = st.view;
    const layout = this.pyramidDisplay;
    this.root.innerHTML = `
      <div class="pyramid-shell">
        <header class="pyramid-head">
          <div class="pyramid-head-copy">
            <p class="pyramid-eyebrow">VORTEX</p>
            <h2>PYRAMID<span class="pyramid-goat" aria-hidden="true">🐐</span></h2>
            <p class="pyramid-sub">${
              view === "bracket"
                ? "Playoff bracket from current standings · ADV / WIN · optional series score"
                : `Top ${PYRAMID_SIZE} ranked · #51–#${PYRAMID_SIZE + PYRAMID_POOL_SIZE} reserve (swap in · no Ring seat)`
            }</p>
          </div>
          <div class="pyramid-head-actions">
            ${
              view === "pyramid"
                ? `<div class="pyramid-view-toggle pyramid-layout-toggle" role="group" aria-label="Pyramid layout">
              <button type="button" class="pyramid-view-btn${layout === "steps" ? " on" : ""}" data-pyramid="layout" data-layout="steps"${titleAttr("1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 14")}>Steps</button>
              <button type="button" class="pyramid-view-btn${layout === "odds" ? " on" : ""}" data-pyramid="layout" data-layout="odds"${titleAttr("1 · 3 · 5 · 7 · 9 · 11 · 14")}>1-3-5</button>
              <button type="button" class="pyramid-view-btn${layout === "fib" ? " on" : ""}" data-pyramid="layout" data-layout="fib"${titleAttr("Fibonacci 1 · 2 · 3 · 5 · 8 · 13 · 18")}>Fib</button>
              <button type="button" class="pyramid-view-btn${layout === "positions" ? " on" : ""}" data-pyramid="layout" data-layout="positions"${titleAttr(
                this.positionsApexInTopTeam && layout === "positions"
                  ? "POS A · primary positions · click again: #1 alone on top"
                  : "POS A · best squads by primary position · click again: fold #1 into top five",
              )}>POS A</button>
              <button type="button" class="pyramid-view-btn${layout === "positionsB" ? " on" : ""}" data-pyramid="layout" data-layout="positionsB"${titleAttr(
                this.positionsApexInTopTeam && layout === "positionsB"
                  ? "POS B · secondary / flex · click again: #1 alone on top"
                  : "POS B · secondary or adjacent flex (PF→SF/C, PG→SG) · click again: fold #1 into top five",
              )}>POS B</button>
              <button type="button" class="pyramid-view-btn${layout === "list" ? " on" : ""}" data-pyramid="layout" data-layout="list"${titleAttr("Rank order · centred wrap · #1 top centre then #2…")}>List</button>
            </div>`
                : view === "bracket"
                  ? (() => {
                      const region = this.bracketState().region;
                      return `<div class="pyramid-view-toggle pyramid-layout-toggle" role="group" aria-label="Bracket region">
              <button type="button" class="pyramid-view-btn${region === "full" ? " on" : ""}" data-pyramid="bracket-region" data-region="full"${titleAttr("Full playoff bracket")}>Full</button>
              <button type="button" class="pyramid-view-btn${region === "east" ? " on" : ""}" data-pyramid="bracket-region" data-region="east"${titleAttr("Eastern Conference")}>East</button>
              <button type="button" class="pyramid-view-btn${region === "west" ? " on" : ""}" data-pyramid="bracket-region" data-region="west"${titleAttr("Western Conference")}>West</button>
            </div>`;
                    })()
                  : ""
            }
            <div class="pyramid-zoom" role="group" aria-label="Zoom">
              <button type="button" class="pyramid-btn ghost" data-pyramid="zoom-out" aria-label="Zoom out">−</button>
              <button type="button" class="pyramid-btn ghost" data-pyramid="zoom-reset" aria-label="Reset zoom">Zoom</button>
              <button type="button" class="pyramid-btn ghost" data-pyramid="zoom-in" aria-label="Zoom in">+</button>
            </div>
            <div class="pyramid-view-toggle" role="group" aria-label="Pyramid view">
              <button type="button" class="pyramid-view-btn${view === "pyramid" ? " on" : ""}" data-pyramid="view" data-view="pyramid">Pyramid</button>
              <button type="button" class="pyramid-view-btn${view === "ring" ? " on" : ""}" data-pyramid="view" data-view="ring">Ring</button>
              <button type="button" class="pyramid-view-btn${view === "jersey" ? " on" : ""}" data-pyramid="view" data-view="jersey">Jersey</button>
              <button type="button" class="pyramid-view-btn${view === "draft" ? " on" : ""}" data-pyramid="view" data-view="draft">Draft</button>
              <button type="button" class="pyramid-view-btn${view === "bracket" ? " on" : ""}" data-pyramid="view" data-view="bracket">Bracket</button>
            </div>
            <button type="button" class="pyramid-btn ghost" data-pyramid="reset"${titleAttr(
              view === "bracket" ? "Clear bracket picks" : "Restore default Top 50",
            )}>Reset</button>
            <button type="button" class="pyramid-btn" data-pyramid="back">Back</button>
          </div>
        </header>
        <div class="pyramid-body" data-pyramid-scroll>
          ${
            view === "ring"
              ? this.ringHtml()
              : view === "jersey"
                ? this.jerseyHtml()
                : view === "draft"
                  ? this.draftHtml()
                  : view === "bracket"
                    ? this.bracketHtml()
                    : this.pyramidHtml()
          }
        </div>
      </div>
    `;
    this.applyViewZoom();
    this.bindRingResizeObserver(view === "ring");
    requestAnimationFrame(() => {
      fitKitSurnameElements(this.root);
      if (view === "ring") {
        this.applyRingOrbitSize();
        requestAnimationFrame(() => this.applyRingOrbitSize());
      }
    });
    if (view === "ring") this.startRingSpin();
    else {
      this.stopRingSpin();
      if (view === "pyramid") this.bindPoolSearch();
      if (view === "draft") this.ensureDraftAiCatchUp();
      if (view === "bracket") this.bindBracketScoreInputs();
    }
  }

  private bindRingResizeObserver(active: boolean): void {
    this.ringResizeObserver?.disconnect();
    this.ringResizeObserver = null;
    if (!active || typeof ResizeObserver === "undefined") return;
    const vp = this.root.querySelector(".pyramid-ring-viewport");
    if (!vp) return;
    this.ringResizeObserver = new ResizeObserver(() => this.applyRingOrbitSize());
    this.ringResizeObserver.observe(vp);
  }

  private cellHtml(
    entry: PyramidEntry,
    opts?: { compact?: boolean; list?: boolean; seat?: string | null },
  ): string {
    const list = opts?.list === true;
    const compact = opts?.compact === true && !list;
    const seat = (opts?.seat ?? "").trim().toUpperCase();
    const card = `
      <article class="pyramid-cell${compact ? " is-compact" : ""}${list ? " is-list-cell" : ""}" draggable="true" data-pyramid-zone="order" data-pyramid-index="${entry.index}" data-player-id="${escapeAttr(entry.playerId)}"${titleAttr(`${entry.name} · #${entry.rank}${seat ? ` · ${seat}` : ""}`)}>
        <div class="pyramid-cell-kit-row">
          <button type="button" class="pyramid-move" data-pyramid="up" data-index="${entry.index}" aria-label="Move up" draggable="false" ${entry.index === 0 ? "disabled" : ""}>↑</button>
          <div class="pyramid-cell-kit">${this.kitBadgeHtml(entry)}</div>
          <button type="button" class="pyramid-move" data-pyramid="down" data-index="${entry.index}" aria-label="Move down" draggable="false" ${entry.index >= PYRAMID_SIZE - 1 ? "disabled" : ""}>↓</button>
        </div>
        ${this.portraitHtml(entry)}
        <div class="pyramid-cell-rank">${entry.rank}</div>
      </article>
    `;
    // POS A/B: seat label sits under the whole card, not on the portrait.
    if (!seat) return card;
    return `
      <div class="pyramid-cell-seat">
        ${card}
        <div class="pyramid-cell-pos" aria-label="Position ${escapeAttr(seat)}">${escapeHtml(seat)}</div>
      </div>
    `;
  }

  private poolCellHtml(entry: PyramidEntry, poolIndex: number): string {
    const rank = PYRAMID_SIZE + poolIndex + 1;
    return `
      <article class="pyramid-cell pyramid-pool-cell is-compact" draggable="true" data-pyramid-zone="pool" data-pyramid-pool-index="${poolIndex}" data-player-id="${escapeAttr(entry.playerId)}"${titleAttr(`${entry.name} · #${rank} reserve (no Ring)`)}>
        <div class="pyramid-cell-kit-row">
          <button type="button" class="pyramid-move pyramid-elevate" data-pyramid="elevate" data-pool-index="${poolIndex}" aria-label="Elevate into Top ${PYRAMID_SIZE}" draggable="false">↑</button>
          <div class="pyramid-cell-kit">${this.kitBadgeHtml(entry)}</div>
          <span class="pyramid-pool-tag">IN</span>
        </div>
        ${this.portraitHtml(entry)}
        <div class="pyramid-cell-rank">${rank}</div>
      </article>
    `;
  }

  private poolSearchHitsHtml(): string {
    const hits = this.searchOutsidePyramid(this.poolQuery);
    if (!this.poolQuery.trim()) return "";
    if (!hits.length) {
      return `<div class="pyramid-pool-search-hits"><div class="pyramid-pool-hit-meta">No players found outside #1–#100</div></div>`;
    }
    return `<div class="pyramid-pool-search-hits">
      ${hits
        .map(
          (h) => `<button type="button" class="pyramid-pool-hit" data-pyramid="pool-import" data-player-id="${escapeAttr(h.playerId)}"${titleAttr(`Add ${h.name} as #${PYRAMID_SIZE + PYRAMID_POOL_SIZE}`)}>
        <span>${escapeHtml(h.name)}</span>
        <span class="pyramid-pool-hit-meta">${escapeHtml(String(h.position))} · → #${PYRAMID_SIZE + PYRAMID_POOL_SIZE}</span>
      </button>`,
        )
        .join("")}
    </div>`;
  }

  private searchOutsidePyramid(query: string): PyramidEntry[] {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    const taken = new Set([...this.state().order, ...this.state().pool]);
    const hits: PyramidEntry[] = [];
    for (const player of this.db.players.values()) {
      if (taken.has(player.id)) continue;
      const label = `${player.displayName || ""} ${player.name || ""}`.toLowerCase();
      if (!label.includes(needle)) continue;
      hits.push(this.entryFor(player.id, PYRAMID_SIZE + PYRAMID_POOL_SIZE));
      if (hits.length >= 10) break;
    }
    hits.sort((a, b) => a.name.localeCompare(b.name));
    return hits;
  }

  private bindPoolSearch(): void {
    const input = this.root.querySelector<HTMLInputElement>("[data-pyramid-search]");
    if (!input) return;
    input.addEventListener("input", () => {
      this.poolQuery = input.value;
      const host = this.root.querySelector("[data-pyramid-search-host]");
      if (host) host.innerHTML = this.poolSearchHitsHtml();
    });
  }

  private pyramidHtml(): string {
    const st = this.state();
    const entries = this.entries();
    const byId = new Map(entries.map((e) => [e.playerId, e]));
    const poolEntries = st.pool.map((id, i) => this.entryFor(id, PYRAMID_SIZE + i));
    const listMode = this.pyramidDisplay === "list";
    const positionsMode =
      this.pyramidDisplay === "positions" || this.pyramidDisplay === "positionsB";
    const dealMode: PyramidPositionDealMode =
      this.pyramidDisplay === "positionsB" ? "secondary" : "primary";
    const patternCounts = positionsMode ? null : PYRAMID_TIER_PATTERNS[this.pyramidDisplay];
    const positionCounts = positionsMode
      ? this.positionsApexInTopTeam
        ? PYRAMID_POSITION_TEAM_COUNTS
        : PYRAMID_TIER_PATTERNS.positions
      : null;
    const scales = pyramidTierScalesFor(positionCounts ?? patternCounts ?? PYRAMID_TIER_COUNTS);

    const renderTierRows = (
      rows: ReturnType<typeof pyramidTierRows>,
      opts?: { showSeatPos?: boolean },
    ): string =>
      rows
        .map((row) => {
          const scale = scales[row.tier - 1] ?? 1;
          const dense = row.entries.length >= 12;
          return `<div class="pyramid-tier${dense ? " is-dense" : ""}" data-tier="${row.tier}" style="--tier-count:${row.entries.length};--tier-scale:${scale}">
        ${row.entries
          .map((slot) => {
            const entry = byId.get(slot.playerId) ?? this.entryFor(slot.playerId, slot.index);
            // Compact styling for mid-wide rows; dense base (37–50) wraps instead of crushing kits.
            return this.cellHtml(entry, {
              compact: row.entries.length >= 10 && !dense,
              seat: opts?.showSeatPos ? slot.seat ?? entry.position : null,
            });
          })
          .join("")}
      </div>`;
        })
        .join("");

    let tiers: string;
    if (listMode) {
      // One centred wrap in rank order — #1 starts the top row (centre of the band), #2 follows on the same line.
      tiers = `<div class="pyramid-tier pyramid-list-flow" data-tier="1" style="--tier-count:5;--tier-scale:1">${entries
        .map((entry) => this.cellHtml(entry, { list: true }))
        .join("")}</div>`;
    } else if (positionsMode) {
      const rows = pyramidPositionTeamRows(st.order, (id) => byId.get(id)?.position, {
        apexInTopTeam: this.positionsApexInTopTeam,
        counts: positionCounts ?? undefined,
        dealMode,
        secondaryOf: (id) => {
          try {
            return this.db.getPlayer(id).secondaryPositions ?? [];
          } catch {
            return [];
          }
        },
      });
      tiers = renderTierRows(rows, { showSeatPos: true });
    } else {
      tiers = renderTierRows(pyramidTierRows(st.order, patternCounts ?? undefined));
    }

    const pool = poolEntries
      .map((entry, i) => this.poolCellHtml(entry, i))
      .join("");
    return `<div class="pyramid-tiers${listMode ? " is-list" : ""}${positionsMode ? " is-positions" : ""}" role="list">${tiers}</div>
      <section class="pyramid-pool" aria-label="Ranks 51 to 100 reserve">
        <header class="pyramid-pool-head">
          <h3>#51–#100</h3>
          <p>Known reserve — drag onto a ranked slot or ↑ to swap with #${PYRAMID_SIZE}. No Ring position.</p>
          <div class="pyramid-pool-search">
            <input data-pyramid-search type="search" placeholder="Search database…" value="${escapeAttr(this.poolQuery)}" aria-label="Search players outside the Pyramid" />
            <div data-pyramid-search-host>${this.poolSearchHitsHtml()}</div>
          </div>
        </header>
        <div class="pyramid-pool-grid">${pool}</div>
      </section>`;
  }

  /** Team-coloured ring card: ↑ / kit / png / ↓. PNG counter-rotates; anchor spacing stays fixed. */
  private ringCardHtml(entry: PyramidEntry, opts?: { center?: boolean }): string {
    const center = opts?.center === true;
    const tint = escapeAttr(entry.color);
    const ink = escapeAttr(entry.textColor);
    const upDisabled = entry.index === 0 ? "disabled" : "";
    const downDisabled = entry.index >= PYRAMID_SIZE - 1 ? "disabled" : "";
    return `
      <div class="pyramid-ring-card${center ? " is-center" : ""}" style="--ring-tint:${tint};--ring-ink:${ink}" data-pyramid-index="${entry.index}" data-player-id="${escapeAttr(entry.playerId)}"${titleAttr(`#${entry.rank} ${entry.name}`)}>
        <button type="button" class="pyramid-ring-bound" data-pyramid="up" data-index="${entry.index}" aria-label="Move up a rank" draggable="false" ${upDisabled}>↑</button>
        <div class="pyramid-ring-card-kit">${this.kitBadgeHtml(entry)}</div>
        ${this.portraitHtml(entry)}
        <button type="button" class="pyramid-ring-bound" data-pyramid="down" data-index="${entry.index}" aria-label="Move down a rank" draggable="false" ${downDisabled}>↓</button>
        <div class="pyramid-ring-card-rank">${entry.rank}</div>
      </div>
    `;
  }

  private ringHtml(): string {
    const entries = this.entries();
    const byId = new Map(entries.map((e) => [e.playerId, e]));
    const { centerId, slots } = buildPyramidRingSlots(this.state().order, (id) => byId.get(id)?.position);
    const center = centerId ? byId.get(centerId) ?? this.entryFor(centerId, 0) : null;
    const wedges = PYRAMID_RING_POSITIONS.map((pos, i) => {
      const mid = (i + 0.5) * (360 / PYRAMID_RING_POSITIONS.length) - 90;
      return `<div class="pyramid-ring-wedge" style="--wedge-angle:${mid}deg" data-pos="${pos}">
        <span class="pyramid-ring-wedge-label">${pos}</span>
        <span class="pyramid-ring-wedge-ray" aria-hidden="true"></span>
      </div>`;
    }).join("");
    const orbit = slots
      .map((slot) => {
        const entry = byId.get(slot.playerId) ?? this.entryFor(slot.playerId, slot.index);
        // Per-position rings: radiusT + scale; applyRingOrbitSize writes left/top in px.
        // Outer rings stack above so layers 3–4 are not buried under inner cards.
        const z = 20 + Math.round(slot.radiusT * 60);
        return `<div class="pyramid-ring-node" data-pos="${slot.position}" data-angle="${slot.angleDeg}" data-radius-t="${slot.radiusT.toFixed(4)}" data-rank="${slot.rank}" data-scale="${slot.scale.toFixed(3)}" style="left:50%;top:50%;z-index:${z};--ring-card-scale:${slot.scale}">
          <div class="pyramid-ring-node-spin">
            ${this.ringCardHtml(entry)}
          </div>
        </div>`;
      })
      .join("");

    return `
      <div class="pyramid-ring-toolbar">
        <span class="pyramid-ring-hint">Drag to turn · cards stay level · ↑↓ move rank · Zoom in header</span>
      </div>
      <div class="pyramid-ring-viewport" data-pyramid="ring-stage">
        <div class="pyramid-ring-stage">
          <div class="pyramid-ring-orbit">
            <div class="pyramid-ring-wedges" aria-hidden="true">${wedges}</div>
            ${orbit}
          </div>
          <div class="pyramid-ring-center">
            ${center ? `<div class="pyramid-ring-center-spin">${this.ringCardHtml(center, { center: true })}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  private applyViewZoom(): void {
    const tiers = this.root.querySelector<HTMLElement>(".pyramid-tiers");
    if (tiers) tiers.style.setProperty("--pyramid-zoom", String(this.viewZoom));
    const stage = this.root.querySelector<HTMLElement>(".pyramid-ring-stage");
    const orbit = this.root.querySelector<HTMLElement>(".pyramid-ring-orbit");
    if (stage) stage.style.setProperty("--ring-zoom", String(this.viewZoom));
    if (orbit) orbit.style.setProperty("--ring-angle", `${this.ringAngle}deg`);
    const bracket = this.root.querySelector<HTMLElement>(".bracket-canvas");
    if (bracket) bracket.style.setProperty("--pyramid-zoom", String(this.viewZoom));
    this.applyRingOrbitSize();
  }

  /**
   * Place each ring card with explicit left/top from polar coords.
   * Clear hole for #1; each position steps outward on its own rings (1, then pairs).
   */
  private applyRingOrbitSize(): void {
    const vp = this.root.querySelector<HTMLElement>(".pyramid-ring-viewport");
    const stage = this.root.querySelector<HTMLElement>(".pyramid-ring-stage");
    if (!vp || !stage) return;
    const minSide = Math.max(320, Math.min(vp.clientWidth || 720, vp.clientHeight || 720));
    // Clear hole for #1; push the rim out so layers 3–4 have real radial gaps.
    const innerR = minSide * 0.2;
    const outerR = minSide * 0.52;
    stage.style.setProperty("--ring-orbit-px", `${outerR.toFixed(1)}px`);
    const nodes = [...this.root.querySelectorAll<HTMLElement>(".pyramid-ring-node")];
    const ringSteps = new Set(
      nodes.map((n) => Number(n.dataset.radiusT)).filter((t) => Number.isFinite(t)),
    );
    const stepCount = Math.max(1, ringSteps.size - 1);
    // Prefer at least ~58px between rings so scaled cards (~70px) do not sit on each other.
    const band = outerR - innerR;
    const minStep = 58;
    const needed = stepCount * minStep;
    const stretch = needed > band ? needed / band : 1;
    const useOuter = stretch > 1 ? innerR + needed : outerR;
    if (stretch > 1) stage.style.setProperty("--ring-orbit-px", `${useOuter.toFixed(1)}px`);
    for (const node of nodes) {
      const angle = Number(node.dataset.angle);
      const radiusT = Number(node.dataset.radiusT);
      if (!Number.isFinite(angle) || !Number.isFinite(radiusT)) continue;
      const r = innerR + Math.max(0, Math.min(1, radiusT)) * (useOuter - innerR);
      const rad = (angle * Math.PI) / 180;
      const x = Math.sin(rad) * r;
      const y = -Math.cos(rad) * r;
      node.style.left = `calc(50% + ${x.toFixed(1)}px)`;
      node.style.top = `calc(50% + ${y.toFixed(1)}px)`;
    }
  }

  private nudgeZoom(delta: number): void {
    this.viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, this.viewZoom + delta));
    this.applyViewZoom();
  }

  private startRingSpin(): void {
    this.stopRingSpin();
    this.ringLastTs = 0;
    const tick = (ts: number) => {
      if (!this.root.classList.contains("open") || this.state().view !== "ring") {
        this.ringRaf = 0;
        return;
      }
      if (!this.ringDragging) {
        const prev = this.ringLastTs || ts;
        const dt = Math.min(0.05, (ts - prev) / 1000);
        this.ringAngle = (this.ringAngle + RING_AUTO_DEG_PER_SEC * dt) % 360;
        this.applyViewZoom();
      }
      this.ringLastTs = ts;
      this.ringRaf = requestAnimationFrame(tick);
    };
    this.ringRaf = requestAnimationFrame(tick);
  }

  private stopRingSpin(): void {
    if (this.ringRaf) cancelAnimationFrame(this.ringRaf);
    this.ringRaf = 0;
    this.ringLastTs = 0;
  }

  private setView(view: PyramidViewId): void {
    if (view === "draft") {
      this.clearDraftAiReveal();
      const existing = this.state().draft ? normalizeDraftSave(this.state().draft) : restartDraft(null);
      // Empty boards always open in the lobby — Start is required (no auto AI).
      const empty = existing.seats.every((s) => s.roster.length === 0);
      const draft =
        empty || existing.status === "ready"
          ? { ...existing, status: "ready" as const, pickIndex: 0 }
          : existing;
      this.persist({ view, draft });
    } else if (view === "bracket") {
      this.persist({ view, bracket: this.bracketState() });
    } else {
      this.persist({ view });
    }
    if (view === "ring") this.viewZoom = RING_DEFAULT_ZOOM;
    else this.viewZoom = 1;
    if (view !== "jersey") this.jerseyPick = null;
    if (view !== "draft") {
      this.clearDraftAiReveal();
      this.draftInspectSeat = null;
      this.draftInspectPlayerId = null;
      this.draftInspectMode = "team";
      this.draftInspectFlipY = 0;
    }
    this.render();
  }

  private clearDraftAiReveal(): void {
    if (this.draftAiRevealTimer != null) {
      clearTimeout(this.draftAiRevealTimer);
      this.draftAiRevealTimer = null;
    }
    this.draftAiReveal = null;
  }

  /**
   * AI on the clock: keep the board up, gently flash the chosen card for 3s, then take it.
   */
  private ensureDraftAiCatchUp(): void {
    if (this.state().view !== "draft") return;
    if (this.draftAiReveal || this.draftInspectSeat != null) return;
    const before = this.draftState();
    // Never run AI in the lobby — Start must flip status to "picking" first.
    if (before.status !== "picking") return;
    const ctx = currentDraftPick(before);
    if (!ctx || ctx.seat.kind === "human" || before.status === "done") return;
    const best = chooseNeedsBasedPick(this.db, before, ctx);
    if (!best) {
      this.persistDraft({
        ...before,
        status: "done",
        pickIndex: draftTotalPicks(before.seats.length),
      });
      this.render();
      return;
    }
    this.draftAiReveal = {
      playerId: best.player.id,
      seatName: ctx.seat.name,
      seatIndex: ctx.seatIndex,
    };
    this.render();
    requestAnimationFrame(() => {
      const el = this.root.querySelector<HTMLElement>(".pyramid-draft-card.is-ai-flash");
      el?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    this.draftAiRevealTimer = setTimeout(() => {
      this.draftAiRevealTimer = null;
      const reveal = this.draftAiReveal;
      this.draftAiReveal = null;
      if (this.state().view !== "draft" || !reveal) return;
      const next = applyDraftPick(this.draftState(), reveal.playerId, this.db);
      this.persistDraft(next);
      this.render();
    }, PyramidHub.DRAFT_AI_REVEAL_MS);
  }

  private resetDefault(): void {
    if (this.state().view === "bracket") {
      const bracket = clearBracketWinners(this.bracketState());
      this.persist({ bracket });
      this.render();
      return;
    }
    const known = new Set(this.db.players.keys());
    const fresh = defaultPyramidSave();
    const next = ensurePyramidSave({ data: { pyramid: { ...fresh, view: this.state().view } }, save: () => {} }, known);
    next.view = this.state().view;
    this.save.data.pyramid = next;
    this.save.save();
    this.render();
  }

  private bracketState(): BracketSave {
    return normalizeBracketSave(this.state().bracket ?? blankBracketSave());
  }

  private persistBracket(bracket: BracketSave): void {
    this.persist({ bracket });
  }

  private bindBracketScoreInputs(): void {
    this.root.querySelectorAll<HTMLInputElement>("input[data-bracket-score]").forEach((input) => {
      input.addEventListener("pointerdown", (e) => e.stopPropagation());
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("change", () => this.onBracketScoreChange(input));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        }
      });
    });
  }

  private onBracketScoreChange(input: HTMLInputElement): void {
    const matchId = input.getAttribute("data-match") as BracketMatchId | null;
    if (!matchId) return;
    const winEl = this.root.querySelector<HTMLInputElement>(
      `[data-bracket-match="${matchId}"] input[data-bracket-score="winner"]`,
    );
    const loseEl = this.root.querySelector<HTMLInputElement>(
      `[data-bracket-match="${matchId}"] input[data-bracket-score="loser"]`,
    );
    const clamp = (raw: string): number | null => {
      const t = raw.trim();
      if (t === "") return null;
      const n = Number(t);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(4, Math.round(n)));
    };
    const winner = clamp(winEl?.value ?? "");
    const loser = clamp(loseEl?.value ?? "");
    // Snap out-of-range typed values back into 0–4 without wiping the other field.
    if (winEl && winner != null && winEl.value.trim() !== "" && Number(winEl.value) !== winner) {
      winEl.value = String(winner);
    }
    if (loseEl && loser != null && loseEl.value.trim() !== "" && Number(loseEl.value) !== loser) {
      loseEl.value = String(loser);
    }
    const score =
      winner != null && loser != null ? { winner, loser } : null;
    this.persistBracket(setBracketScore(this.bracketState(), matchId, score));
  }

  private bracketHtml(): string {
    const save = this.bracketState();
    const eastRows = standingsFor(this.db.fixtures, [...this.db.teams.values()], "EAST");
    const westRows = standingsFor(this.db.fixtures, [...this.db.teams.values()], "WEST");
    const resolved = resolveBracket(seedTeamIds(eastRows), seedTeamIds(westRows), save);
    const region = save.region;
    const showEast = region === "full" || region === "east";
    const showWest = region === "full" || region === "west";
    const showFinals = region === "full";

    return `
      <div class="bracket-shell">
        <p class="bracket-hint">Tap <strong>ADV</strong> to send a side through · optional score · <strong>WIN</strong> crowns the champion. Later rounds clear when you swap an earlier pick.</p>
        <div class="bracket-canvas" style="--pyramid-zoom:${this.viewZoom}">
          ${
            showEast && showWest
              ? `<div class="bracket-playin-row">
            ${this.bracketPlayInHtml(resolved.east, "East")}
            ${this.bracketPlayInHtml(resolved.west, "West")}
          </div>`
              : `${showEast ? this.bracketPlayInHtml(resolved.east, "East") : ""}${
                  showWest ? this.bracketPlayInHtml(resolved.west, "West") : ""
                }`
          }
          <div class="bracket-tree ${region === "full" ? "is-full" : region === "east" ? "is-east" : "is-west"}">
            ${showEast ? this.bracketConferenceTreeHtml(resolved.east, "east") : ""}
            ${showFinals ? this.bracketFinalsHtml(resolved.finals) : ""}
            ${showWest ? this.bracketConferenceTreeHtml(resolved.west, "west") : ""}
          </div>
        </div>
      </div>
    `;
  }

  private bracketPlayInHtml(conf: ConferenceBracket, title: string): string {
    return `
      <section class="bracket-playin" data-conf="${conf.conf}">
        <h3 class="bracket-section-title">${escapeHtml(title)} Play-In</h3>
        <div class="bracket-playin-grid">
          ${this.bracketMatchHtml(conf.playIn78)}
          ${this.bracketMatchHtml(conf.playIn910)}
          ${this.bracketMatchHtml(conf.playIn8)}
        </div>
      </section>
    `;
  }

  private bracketConferenceTreeHtml(conf: ConferenceBracket, side: "east" | "west"): string {
    const label = side === "east" ? "East" : "West";
    const mirror = side === "west";
    // R1 pairing feeds Semis: 1/8+4/5 → SF0, 2/7+3/6 → SF1; then both → Conf Finals.
    // West mirrors so Conf. Finals sit toward the NBA Finals (left of the West column).
    const topBranch = this.bracketBranchHtml(conf.r1[0]!, conf.r1[1]!, conf.sf[0]!, mirror);
    const botBranch = this.bracketBranchHtml(conf.r1[3]!, conf.r1[2]!, conf.sf[1]!, mirror);
    // Labels use the same grid shells as the match body so R1 / Semis / Conf. Finals
    // sit directly above their columns (East and West).
    const roundLabels = mirror
      ? `<div class="bracket-branch bracket-branch-labels" aria-hidden="true">
            <div class="bracket-round-label">Semis</div>
            <div class="bracket-line-spacer"></div>
            <div class="bracket-round-label">R1</div>
          </div>`
      : `<div class="bracket-branch bracket-branch-labels" aria-hidden="true">
            <div class="bracket-round-label">R1</div>
            <div class="bracket-line-spacer"></div>
            <div class="bracket-round-label">Semis</div>
          </div>`;
    const cfLabel = `<div class="bracket-cf-slot bracket-cf-label" aria-hidden="true"><div class="bracket-round-label">Conf. Finals</div></div>`;
    const labelSpacer = `<div class="bracket-line-spacer" aria-hidden="true"></div>`;
    const labelRow = mirror
      ? `${cfLabel}${labelSpacer}<div class="bracket-sf-stack">${roundLabels}</div>`
      : `<div class="bracket-sf-stack">${roundLabels}</div>${labelSpacer}${cfLabel}`;
    const stack = `<div class="bracket-sf-stack">${topBranch}${botBranch}</div>`;
    const cfLine = `<div class="bracket-line bracket-line-cf" aria-hidden="true"></div>`;
    const cfSlot = `<div class="bracket-cf-slot">${this.bracketMatchHtml(conf.final)}</div>`;
    const body = mirror
      ? `${cfSlot}${cfLine}${stack}`
      : `${stack}${cfLine}${cfSlot}`;
    return `
      <section class="bracket-conf bracket-conf-${side}">
        <h3 class="bracket-section-title">${label}</h3>
        <div class="bracket-flow" aria-label="${label} bracket">
          <div class="bracket-flow-body bracket-flow-labels">${labelRow}</div>
          <div class="bracket-flow-body">
            ${body}
          </div>
        </div>
      </section>
    `;
  }

  /** Two R1 games → gold elbow → one Semis game (centered on the pair). */
  private bracketBranchHtml(
    feedA: BracketMatchup,
    feedB: BracketMatchup,
    next: BracketMatchup,
    mirror = false,
  ): string {
    const feeds = `<div class="bracket-branch-feeds">
          ${this.bracketMatchHtml(feedA)}
          ${this.bracketMatchHtml(feedB)}
        </div>`;
    const line = `<div class="bracket-line bracket-line-sf" aria-hidden="true"></div>`;
    const semis = `<div class="bracket-branch-next">
          ${this.bracketMatchHtml(next)}
        </div>`;
    return `
      <div class="bracket-branch">
        ${mirror ? `${semis}${line}${feeds}` : `${feeds}${line}${semis}`}
      </div>
    `;
  }

  private bracketFinalsHtml(match: BracketMatchup): string {
    return `
      <section class="bracket-finals">
        <h3 class="bracket-section-title">NBA Finals</h3>
        ${this.bracketMatchHtml(match)}
      </section>
    `;
  }

  private bracketScoreInputHtml(
    matchId: BracketMatchId,
    side: "winner" | "loser",
    value: number | null,
    enabled: boolean,
  ): string {
    const val = value == null ? "" : String(value);
    return `<input type="number" class="bracket-score-input" data-bracket-score="${side}" data-match="${escapeAttr(matchId)}" min="0" max="4" step="1" inputmode="numeric" value="${escapeAttr(val)}" placeholder="" aria-label="${side === "winner" ? "Winner" : "Loser"} games" ${enabled ? "" : "disabled"}/>`;
  }

  private bracketMatchHtml(match: BracketMatchup): string {
    const scoreHint = isPlayInMatch(match.id) ? "Score" : "Series";
    const scoreVal = match.score;
    const canScore = !!match.winner;
    return `
      <article class="bracket-match${match.winner ? " has-pick" : ""}" data-bracket-match="${escapeAttr(match.id)}">
        <div class="bracket-match-label">${escapeHtml(match.label)}</div>
        <div class="bracket-sides">
          ${this.bracketSideHtml(match, match.a, "a")}
          ${this.bracketSideHtml(match, match.b, "b")}
        </div>
        <div class="bracket-score-row${canScore ? "" : " is-disabled"}">
          <span class="bracket-score-hint">${scoreHint}</span>
          ${this.bracketScoreInputHtml(match.id, "winner", scoreVal ? scoreVal.winner : null, canScore)}
          <span class="bracket-score-sep">–</span>
          ${this.bracketScoreInputHtml(match.id, "loser", scoreVal ? scoreVal.loser : null, canScore)}
        </div>
      </article>
    `;
  }

  private bracketSideHtml(match: BracketMatchup, teamId: string | null, slot: "a" | "b"): string {
    if (!teamId) {
      return `<div class="bracket-side is-empty"><span class="bracket-tbd">TBD</span></div>`;
    }
    const team = this.db.teams.get(teamId);
    const abbr = escapeHtml(team?.abbreviation || teamId);
    const name = escapeHtml(team?.name || teamId);
    const crest = team
      ? teamBadgeHtml(team, { className: "bracket-crest", size: 28 })
      : `<span class="bracket-crest bracket-crest-empty" aria-hidden="true"></span>`;
    const on = match.winner === teamId;
    const act = match.action === "win" ? "bracket-win" : "bracket-adv";
    const label = match.action === "win" ? "WIN" : "ADV";
    return `
      <div class="bracket-side${on ? " is-on" : ""}" data-slot="${slot}">
        ${crest}
        <span class="bracket-abbr"${titleAttr(name)}>${abbr}</span>
        <button type="button" class="bracket-pick-btn${on ? " on" : ""}" data-pyramid="${act}" data-match="${escapeAttr(match.id)}" data-team="${escapeAttr(teamId)}" aria-pressed="${on ? "true" : "false"}" aria-label="${label} ${name}">${label}</button>
      </div>
    `;
  }

  private move(index: number, dir: -1 | 1): void {
    const order = swapPyramidNeighbor(this.state().order, index, dir);
    this.persist({ order });
    this.renderKeepingScroll();
  }

  private elevateFromPool(poolIndex: number): void {
    const st = this.state();
    const next = elevatePoolToPyramid(st.order, st.pool, poolIndex);
    this.persist(next);
    this.renderKeepingScroll();
  }

  private onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const act = t.closest<HTMLElement>("[data-pyramid]")?.getAttribute("data-pyramid");
    if (!act) return;
    if (act === "back") {
      this.onAction?.("back");
      return;
    }
    if (act === "reset") {
      this.resetDefault();
      return;
    }
    if (act === "layout") {
      e.preventDefault();
      e.stopPropagation();
      const layout = t.closest<HTMLElement>("[data-layout]")?.getAttribute("data-layout");
      if (!isPyramidTierPatternId(layout)) return;
      // POS A / POS B: re-click toggles #1 alone ↔ #1 in the top five.
      if (
        (layout === "positions" || layout === "positionsB") &&
        this.pyramidDisplay === layout
      ) {
        this.positionsApexInTopTeam = !this.positionsApexInTopTeam;
        this.renderKeepingScroll();
        return;
      }
      if (this.pyramidDisplay === layout) return;
      this.pyramidDisplay = layout;
      if (layout === "positions" || layout === "positionsB") this.positionsApexInTopTeam = false;
      this.renderKeepingScroll();
      return;
    }
    if (act === "view") {
      const view = t.closest<HTMLElement>("[data-view]")?.getAttribute("data-view");
      if (
        view === "pyramid" ||
        view === "ring" ||
        view === "jersey" ||
        view === "draft" ||
        view === "bracket"
      ) {
        this.setView(view);
      }
      return;
    }
    if (act === "bracket-region") {
      const region = t.closest<HTMLElement>("[data-region]")?.getAttribute("data-region");
      if (!isBracketRegionView(region)) return;
      this.persistBracket(setBracketRegion(this.bracketState(), region));
      this.render();
      return;
    }
    if (act === "bracket-adv" || act === "bracket-win") {
      const matchId = t.closest<HTMLElement>("[data-match]")?.getAttribute("data-match") as BracketMatchId | null;
      const teamId = t.closest<HTMLElement>("[data-team]")?.getAttribute("data-team");
      if (!matchId || !teamId) return;
      e.preventDefault();
      e.stopPropagation();
      this.persistBracket(setBracketWinner(this.bracketState(), matchId, teamId));
      this.renderKeepingScroll();
      return;
    }
    if (act === "elevate") {
      const idx = Number(t.closest<HTMLElement>("[data-pool-index]")?.getAttribute("data-pool-index"));
      if (!Number.isFinite(idx)) return;
      e.preventDefault();
      e.stopPropagation();
      this.elevateFromPool(idx);
      return;
    }
    if (act === "pool-import") {
      const playerId = t.closest<HTMLElement>("[data-player-id]")?.getAttribute("data-player-id");
      if (!playerId) return;
      const st = this.state();
      const pool = placePlayerInPool(st.order, st.pool, playerId, st.pool.length - 1);
      this.poolQuery = "";
      this.persist({ pool });
      this.renderKeepingScroll();
      return;
    }
    if (act === "up" || act === "down") {
      const idx = Number(t.closest<HTMLElement>("[data-index]")?.getAttribute("data-index"));
      if (!Number.isFinite(idx)) return;
      e.preventDefault();
      e.stopPropagation();
      this.move(idx, act === "up" ? -1 : 1);
      return;
    }
    if (act === "zoom-in") {
      this.nudgeZoom(VIEW_ZOOM_STEP);
      return;
    }
    if (act === "zoom-out") {
      this.nudgeZoom(-VIEW_ZOOM_STEP);
      return;
    }
    if (act === "zoom-reset") {
      this.viewZoom = this.state().view === "ring" ? RING_DEFAULT_ZOOM : 1;
      this.applyViewZoom();
      return;
    }
    if (act === "jersey-open") {
      const n = Number(t.closest<HTMLElement>("[data-jersey]")?.getAttribute("data-jersey"));
      if (!Number.isInteger(n) || n < 0 || n > 99) return;
      this.jerseyPick = n;
      this.render();
      return;
    }
    if (act === "jersey-close") {
      this.jerseyPick = null;
      this.render();
      return;
    }
    if (act === "jersey-pick") {
      const n = Number(t.closest<HTMLElement>("[data-jersey]")?.getAttribute("data-jersey"));
      const playerId = t.closest<HTMLElement>("[data-player-id]")?.getAttribute("data-player-id");
      if (!Number.isInteger(n) || n < 0 || n > 99 || !playerId) return;
      const jerseyChoice = { ...(this.state().jerseyChoice ?? {}), [String(n)]: playerId };
      this.jerseyPick = null;
      this.persist({ jerseyChoice });
      this.render();
      return;
    }
    if (act === "draft-restart") {
      this.clearDraftAiReveal();
      this.draftInspectSeat = null;
      this.draftInspectPlayerId = null;
      this.draftInspectMode = "team";
      this.draftInspectFlipY = 0;
      this.persistDraft(restartDraft(this.draftState()));
      this.render();
      return;
    }
    if (act === "draft-start") {
      this.clearDraftAiReveal();
      this.persistDraft(startDraft(this.draftState()));
      this.render();
      return;
    }
    if (act === "draft-mode-team") {
      this.draftInspectMode = "team";
      this.render();
      return;
    }
    if (act === "draft-mode-player") {
      this.draftInspectMode = "player";
      this.draftInspectFlipY = 0;
      this.render();
      return;
    }
    if (act === "draft-nav-prev" || act === "draft-nav-next") {
      this.stepDraftInspectPlayer(act === "draft-nav-next" ? 1 : -1);
      return;
    }
    if (act === "draft-card-flip") {
      const dir = t.closest<HTMLElement>("[data-dir]")?.getAttribute("data-dir");
      this.stepDraftInspectPlayer(dir === "next" ? 1 : -1);
      return;
    }
    if (act === "draft-card-face") {
      const card = t.closest<HTMLElement>(".player-card");
      if (!card) return;
      const side = playerCardFlipSideFromClientX(card, e.clientX);
      this.draftInspectFlipY = nextPlayerCardFlipY(this.draftInspectFlipY, side);
      this.render();
      return;
    }
    if (act === "draft-profile-toggle") {
      this.draftInspectProfileView = nextProfileStatsMode(this.draftInspectProfileView);
      this.render();
      return;
    }
    if (act === "draft-start-team" || act === "draft-simulate") {
      // Layout parity with Formation — no match flow yet.
      return;
    }
    if (act === "draft-autofill") {
      this.clearDraftAiReveal();
      this.persistDraft(autoFillDraft(this.db, this.draftState()));
      this.render();
      return;
    }
    if (act === "draft-add-seat") {
      this.clearDraftAiReveal();
      this.persistDraft(addDraftSeat(this.draftState()));
      this.render();
      return;
    }
    if (act === "draft-toggle-seat") {
      if (this.draftAiReveal) return;
      e.stopPropagation();
      const idx = Number(t.closest<HTMLElement>("[data-seat-index]")?.getAttribute("data-seat-index"));
      if (!Number.isInteger(idx)) return;
      this.persistDraft(toggleDraftSeatKind(this.draftState(), idx));
      this.render();
      return;
    }
    if (act === "draft-filter") {
      this.clearDraftAiReveal();
      const id = t.closest<HTMLElement>("[data-draft-filter]")?.getAttribute("data-draft-filter");
      if (!isDraftFilterId(id)) return;
      this.persistDraft(setDraftFilter(this.draftState(), id));
      this.render();
      return;
    }
    if (act === "draft-inspect") {
      if (this.draftAiReveal) return;
      const idx = Number(t.closest<HTMLElement>("[data-seat-index]")?.getAttribute("data-seat-index"));
      if (!Number.isInteger(idx) || idx < 0) return;
      const seat = this.draftState().seats[idx];
      if (!seat || seat.roster.length < DRAFT_ROSTER_SIZE) return;
      this.draftInspectSeat = idx;
      this.draftInspectPlayerId = seat.roster[0]?.playerId ?? null;
      this.draftInspectMode = "team";
      this.draftInspectFlipY = 0;
      this.render();
      return;
    }
    if (act === "draft-inspect-back") {
      this.draftInspectSeat = null;
      this.draftInspectPlayerId = null;
      this.draftInspectMode = "team";
      this.draftInspectFlipY = 0;
      this.render();
      return;
    }
    if (act === "draft-inspect-pick") {
      const playerId = t.closest<HTMLElement>("[data-player-id]")?.getAttribute("data-player-id");
      if (!playerId || this.draftInspectSeat == null) return;
      if (this.suppressDraftInspectClick) {
        this.suppressDraftInspectClick = false;
        this.draftInspectPlayerId = playerId;
        this.draftInspectFlipY = 0;
        this.render();
        return;
      }
      const draft = this.draftState();
      const seat = draft.seats[this.draftInspectSeat];
      if (!seat) return;
      // PLAYER SELECT: tapping a player only focuses their card (no lineup swap).
      if (this.draftInspectMode === "player") {
        this.draftInspectPlayerId = playerId;
        this.draftInspectFlipY = 0;
        this.render();
        return;
      }
      const toSlot =
        t.closest<HTMLElement>("[data-slot]")?.getAttribute("data-slot") ??
        seat.roster.find((r) => r.playerId === playerId)?.slot ??
        null;
      const fromSlot =
        this.draftInspectPlayerId && this.draftInspectPlayerId !== playerId
          ? seat.roster.find((r) => r.playerId === this.draftInspectPlayerId)?.slot ?? null
          : null;
      if (fromSlot && toSlot && fromSlot !== toSlot) {
        this.applyDraftInspectSwap(fromSlot, toSlot);
        this.draftInspectPlayerId = playerId;
        this.render();
        return;
      }
      this.draftInspectPlayerId = playerId;
      this.render();
      return;
    }
    if (act === "draft-pick") {
      if (this.draftAiReveal || this.draftInspectSeat != null) return;
      const playerId = t.closest<HTMLElement>("[data-player-id]")?.getAttribute("data-player-id");
      if (!playerId) return;
      const draft = this.draftState();
      const ctx = currentDraftPick(draft);
      if (!ctx || ctx.seat.kind !== "human") return;
      const next = applyDraftPick(draft, playerId, this.db);
      this.persistDraft(next);
      this.render();
    }
  }

  private jerseyCandidatesByNumber(): Map<number, (PyramidEntry & { overall: number })[]> {
    type JerseyCand = PyramidEntry & { overall: number };
    const byNum = new Map<number, JerseyCand[]>();
    const order = this.state().order;
    const pool = this.state().pool;
    // Walk memberships so era kits (e.g. Kobe #24 on 09/10, #8 on 00/01) all appear,
    // even when Pyramid/Draft keep a single identity form.
    const seenSlot = new Set<string>();
    for (const mem of this.db.memberships) {
      const n = mem.shirtNumber;
      if (!Number.isFinite(n) || n < 0 || n > 99) continue;
      const player = this.db.players.get(mem.playerId);
      if (!player) continue;
      const slotKey = `${mem.playerId}:${n}:${mem.teamId}`;
      if (seenSlot.has(slotKey)) continue;
      seenSlot.add(slotKey);
      const orderIdx = order.indexOf(player.id);
      const poolIdx = pool.indexOf(player.id);
      const index = orderIdx >= 0 ? orderIdx : poolIdx >= 0 ? PYRAMID_SIZE + poolIdx : -1;
      const entry = this.entryFor(player.id, Math.max(0, index));
      // Keep the membership shirt for this cell (do not reuse another era’s number).
      entry.shirtNumber = n;
      entry.rank = orderIdx >= 0 ? orderIdx + 1 : poolIdx >= 0 ? PYRAMID_SIZE + poolIdx + 1 : 0;
      entry.index = index;
      const team = this.db.teams.get(mem.teamId);
      if (team?.primaryColor) entry.color = team.primaryColor;
      if (team?.secondaryColor?.trim()) entry.textColor = team.secondaryColor.trim();
      const overall = Number(player.overall ?? 0);
      const list = byNum.get(n) ?? [];
      list.push({ ...entry, overall });
      byNum.set(n, list);
    }
    for (const list of byNum.values()) {
      list.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
    }
    return byNum;
  }

  /** Drop jersey picks that do not actually wear that number (stale / wrong saves). */
  private sanitizeJerseyChoice(
    choice: Record<string, string> | undefined,
    byNum: Map<number, (PyramidEntry & { overall: number })[]>,
  ): Record<string, string> {
    if (!choice) return {};
    const next: Record<string, string> = {};
    let changed = false;
    for (const [key, playerId] of Object.entries(choice)) {
      const n = Number(key);
      if (!Number.isInteger(n) || n < 0 || n > 99 || !playerId) {
        changed = true;
        continue;
      }
      const list = byNum.get(n) ?? [];
      if (!list.some((c) => c.playerId === playerId)) {
        changed = true;
        continue;
      }
      next[key] = playerId;
    }
    if (changed) this.persist({ jerseyChoice: next });
    return next;
  }

  /**
   * Jersey 0–99 grid — every database player, grouped by shirt number.
   * Cell shows chosen (or highest-rated) wearer; click opens a replacement picker.
   */
  private jerseyHtml(): string {
    const byNum = this.jerseyCandidatesByNumber();
    const choice = this.sanitizeJerseyChoice(this.state().jerseyChoice, byNum);
    const cells: string[] = [];
    for (let n = 0; n < 100; n++) {
      const list = byNum.get(n) ?? [];
      const chosenId = choice[String(n)];
      // Only honour a saved pick if that player actually wears this number.
      const entry = (chosenId && list.find((c) => c.playerId === chosenId)) || list[0];
      if (entry) {
        const kitEntry = { ...entry, shirtNumber: n };
        cells.push(`
          <button type="button" class="pyramid-jersey-cell is-filled" data-pyramid="jersey-open" data-jersey="${n}" data-player-id="${escapeAttr(entry.playerId)}"${titleAttr(`${entry.name} · jersey ${n} · tap to change`)}>
            <div class="pyramid-cell-kit-row">
              <div class="pyramid-cell-kit">${this.kitBadgeHtml(kitEntry)}</div>
            </div>
            ${this.portraitHtml(entry)}
          </button>`);
      } else {
        cells.push(`
          <button type="button" class="pyramid-jersey-cell is-empty" data-pyramid="jersey-open" data-jersey="${n}"${titleAttr(`Jersey ${n} · tap for options`)}>
            <span class="pyramid-jersey-num">${n}</span>
          </button>`);
      }
    }
    return `
      <div class="pyramid-jersey">
        <div class="pyramid-jersey-toolbar">
          <span class="pyramid-jersey-hint">Tap a number to pick the player · sorted by rating</span>
        </div>
        <div class="pyramid-jersey-grid" role="list">${cells.join("")}</div>
        ${this.jerseyPick != null ? this.jerseyPickerHtml(this.jerseyPick, byNum.get(this.jerseyPick) ?? []) : ""}
      </div>
    `;
  }

  private jerseyPickerHtml(n: number, list: (PyramidEntry & { overall: number })[]): string {
    const choice = this.state().jerseyChoice?.[String(n)];
    const options = list.length
      ? list
          .map((entry) => {
            const selected = entry.playerId === choice || (!choice && entry === list[0]);
            const ovr = entry.overall > 0 ? `OVR ${entry.overall}` : "";
            return `
            <button type="button" class="pyramid-jersey-option${selected ? " is-on" : ""}" data-pyramid="jersey-pick" data-jersey="${n}" data-player-id="${escapeAttr(entry.playerId)}"${titleAttr(entry.name)}>
              <div class="pyramid-jersey-option-kit">${this.kitBadgeHtml(entry)}</div>
              ${this.portraitHtml(entry)}
              <span class="pyramid-jersey-option-name">${escapeHtml(entry.name)}</span>
              ${ovr ? `<span class="pyramid-jersey-option-ovr">${ovr}</span>` : ""}
            </button>`;
          })
          .join("")
      : `<div class="pyramid-jersey-picker-empty">No players wear #${n}</div>`;
    return `
      <div class="pyramid-jersey-picker" role="dialog" aria-label="Pick jersey ${n}">
        <div class="pyramid-jersey-picker-card">
          <header class="pyramid-jersey-picker-head">
            <h3>Jersey ${n}</h3>
            <button type="button" class="pyramid-btn ghost" data-pyramid="jersey-close">Close</button>
          </header>
          <div class="pyramid-jersey-picker-grid">${options}</div>
        </div>
      </div>
    `;
  }

  /**
   * Snake draft — best player available into 13-man squads (You + AI seats).
   * Filter chips narrow the board; placement fits position after the pick.
   */
  private draftHtml(): string {
    const draft = this.draftState();
    if (this.draftInspectSeat != null && draft.seats[this.draftInspectSeat]) {
      return this.draftInspectHtml(draft, this.draftInspectSeat);
    }
    const lobby = draft.status === "ready";
    const ctx = currentDraftPick(draft);
    const total = draftTotalPicks(draft.seats.length);
    const onClock = lobby
      ? "Ready — press Start"
      : ctx
        ? `${escapeHtml(ctx.seat.name)} · pick ${ctx.pickNumber}/${total}`
        : draft.status === "done"
          ? "Draft complete"
          : "—";
    const revealing = !!this.draftAiReveal;
    const humanTurn = !!ctx && ctx.seat.kind === "human" && !revealing;
    const filters = DRAFT_FILTERS.map(
      (f) =>
        `<button type="button" class="pyramid-draft-filter${draft.filter === f.id ? " on" : ""}" data-pyramid="draft-filter" data-draft-filter="${f.id}">${escapeHtml(f.label)}</button>`,
    ).join("");
    const seats = draft.seats
      .map((seat, i) => {
        const on = this.draftAiReveal != null ? this.draftAiReveal.seatIndex === i : ctx?.seatIndex === i;
        const slots = draftSlots()
          .map((slot) => {
            const row = seat.roster.find((r) => r.slot === slot);
            const label = slot.startsWith("BENCH_") ? `B${slot.slice(6)}` : slot;
            if (!row) {
              return `<div class="pyramid-draft-slot is-empty"><span class="pyramid-draft-slot-pos">${escapeHtml(label)}</span></div>`;
            }
            const sp = this.resolveDraftSquadPlayer(row.playerId, row.sourceTeamId);
            const name = sp?.player.name ?? row.playerId;
            const ovr = sp ? Math.round(sp.overall) : "—";
            return `<div class="pyramid-draft-slot is-filled"${titleAttr(`${name} · ${slot}`)}>
              <span class="pyramid-draft-slot-pos">${escapeHtml(label)}</span>
              <span class="pyramid-draft-slot-name">${escapeHtml(name)}</span>
              <span class="pyramid-draft-slot-ovr">${ovr}</span>
            </div>`;
          })
          .join("");
        const complete = seat.roster.length >= DRAFT_ROSTER_SIZE;
        return `
          <article class="pyramid-draft-seat${on ? " is-on" : ""}${complete ? " is-complete" : ""}">
            <header class="pyramid-draft-seat-head">
              <h3>${escapeHtml(seat.name)}</h3>
              <button type="button" class="pyramid-btn ghost" data-pyramid="draft-toggle-seat" data-seat-index="${i}"${titleAttr("Toggle human / AI")}>${seat.kind === "human" ? "YOU" : "AI"}</button>
            </header>
            <div class="pyramid-draft-slots">${slots}</div>
            <div class="pyramid-draft-seat-meta">${seat.roster.length}/${DRAFT_ROSTER_SIZE}</div>
            ${
              complete
                ? `<button type="button" class="pyramid-btn ghost pyramid-draft-seat-open" data-pyramid="draft-inspect" data-seat-index="${i}"${titleAttr(`Open ${seat.name} formation`)}>Formation</button>`
                : ""
            }
          </article>`;
      })
      .join("");
    // Human turn + AI flash show the capped BPA board. Lobby stays light (no card grid).
    const showBoard = revealing || (humanTurn && !!ctx);
    const board = lobby
      ? `<div class="pyramid-draft-empty">Press <strong>Start</strong> to open the board and begin the snake draft.</div>`
      : showBoard
        ? (() => {
            let list = draftCandidates(this.db, draft);
            const flashId = revealing ? this.draftAiReveal!.playerId : null;
            // Needs-based AI may pick outside the top-OVR window — pin that card on the board.
            if (flashId && !list.some((sp) => sp.player.id === flashId)) {
              const sp = this.resolveDraftSquadPlayer(flashId);
              if (sp) list = [sp, ...list];
            }
            return (
              list.map((sp) => this.draftCardHtml(sp, flashId, { pickable: !flashId })).join("") ||
              `<div class="pyramid-draft-empty">No players left in this filter.</div>`
            );
          })()
        : draft.status === "done"
          ? `<div class="pyramid-draft-empty">Draft complete — open a seat’s <strong>Formation</strong> to swap positions or view cards.</div>`
          : `<div class="pyramid-draft-empty">Waiting on ${escapeHtml(ctx?.seat.name ?? "AI")}…</div>`;
    const firstName = draft.seats[draft.firstSeat]?.name ?? "—";
    const statusLine = revealing
      ? `${escapeHtml(this.draftAiReveal!.seatName)} selects`
      : onClock;
    const startBtn = lobby
      ? `<button type="button" class="pyramid-btn" data-pyramid="draft-start">Start</button>`
      : "";
    return `
      <div class="pyramid-draft${revealing ? " is-ai-picking" : ""}${lobby ? " is-lobby" : ""}">
        <div class="pyramid-draft-toolbar">
          <div class="pyramid-draft-status">
            <span class="pyramid-draft-onclock">${statusLine}</span>
            <span class="pyramid-draft-first">First pick: ${escapeHtml(firstName)}</span>
          </div>
          <div class="pyramid-draft-actions">
            <button type="button" class="pyramid-btn ghost" data-pyramid="draft-add-seat" ${draft.seats.length >= DRAFT_MAX_SEATS || revealing ? "disabled" : ""}>+ Seat</button>
            <button type="button" class="pyramid-btn ghost" data-pyramid="draft-autofill" ${revealing ? "disabled" : ""}>Auto-fill</button>
            ${startBtn}
            <button type="button" class="pyramid-btn${lobby ? " ghost" : ""}" data-pyramid="draft-restart">Restart</button>
          </div>
        </div>
        <div class="pyramid-draft-filters" role="group" aria-label="Draft pool">${filters}</div>
        <div class="pyramid-draft-seats">${seats}</div>
        <div class="pyramid-draft-board" role="list">${board}</div>
      </div>
    `;
  }

  /** Formation panel for a completed draft seat — TEAM SELECT pitch or PLAYER SELECT card. */
  private draftInspectHtml(draft: DraftSave, seatIndex: number): string {
    const seat = draft.seats[seatIndex]!;
    const playerMode = this.draftInspectMode === "player";
    const tabs = draft.seats
      .filter((s) => s.roster.length >= DRAFT_ROSTER_SIZE)
      .map((s) => {
        const i = draft.seats.indexOf(s);
        return `<button type="button" class="pyramid-draft-inspect-tab${i === seatIndex ? " on" : ""}" data-pyramid="draft-inspect" data-seat-index="${i}">${escapeHtml(s.name)}</button>`;
      })
      .join("");
    return `
      <div class="pyramid-draft pyramid-draft-inspect-view">
        <div class="char-panel char-panel-team pyramid-draft-formation-panel">
          <div class="team-select-head">
            <div class="pyramid-draft-inspect-heading">
              <div class="pyramid-draft-inspect-title">
                <h3>${escapeHtml(seat.name)}</h3>
                <span>${seat.roster.length}/${DRAFT_ROSTER_SIZE} · ${seat.kind === "human" ? "YOU" : "AI"}</span>
              </div>
            </div>
            <div class="formation-toolbar" role="toolbar" aria-label="Draft formation">
              <span class="formation-chip formation-chip-static on" aria-label="Formation">BASKETBALL 5</span>
            </div>
            <div class="pyramid-draft-inspect-tabs" role="tablist">${tabs}</div>
          </div>
          ${this.draftFormationPanelHtml(seat)}
          <div class="char-modes">
            <button type="button" data-pyramid="draft-mode-player" class="${playerMode ? "on" : ""}">PLAYER SELECT</button>
            <button type="button" data-pyramid="draft-mode-team" class="${!playerMode ? "on" : ""}">TEAM SELECT</button>
          </div>
          <div class="char-nav">
            <button type="button" class="char-nav-step" data-pyramid="draft-nav-prev" aria-label="Previous">‹</button>
            <button type="button" data-pyramid="draft-inspect-back">BACK</button>
            <button type="button" data-pyramid="draft-start-team"${titleAttr("Coming soon")}>START AS TEAM</button>
            <button type="button" data-pyramid="draft-simulate"${titleAttr("Coming soon")}>SIMULATE</button>
            <button type="button" class="char-nav-step" data-pyramid="draft-nav-next" aria-label="Next">›</button>
          </div>
        </div>
      </div>
    `;
  }

  private stepDraftInspectPlayer(delta: number): void {
    if (this.draftInspectSeat == null) return;
    const seat = this.draftState().seats[this.draftInspectSeat];
    if (!seat?.roster.length) return;
    const ids = seat.roster.map((r) => r.playerId);
    const cur = Math.max(0, ids.indexOf(this.draftInspectPlayerId ?? ""));
    const next = (cur + delta + ids.length) % ids.length;
    this.draftInspectPlayerId = ids[next]!;
    this.draftInspectFlipY = 0;
    this.render();
  }

  private draftInspectPlayerCardHtml(sp: SquadPlayer): string {
    let html = playerCardShellHtml(sp, this.draftTeamContext(sp), {
      editing: false,
      editDirty: false,
      flipped: false,
      flipY: this.draftInspectFlipY,
      profileView: this.draftInspectProfileView,
      profileSize: 148,
      imagePaths: [],
    });
    // Draft inspect is view-only — drop EDIT; remap card controls onto pyramid actions.
    html = html.replace(/<div class="player-card-shell-head">[\s\S]*?<\/div>/, `<div class="player-card-shell-head"></div>`);
    html = html
      .replaceAll('data-char="card-face"', 'data-pyramid="draft-card-face"')
      .replaceAll('data-char="card-flip"', 'data-pyramid="draft-card-flip"')
      .replaceAll('data-char="profile-toggle"', 'data-pyramid="draft-profile-toggle"');
    return html;
  }

  private draftFormationPanelHtml(seat: DraftSeat): string {
    const form = getFormation(MITEAM_FORMATION);
    const bySlot = new Map(seat.roster.map((r) => [r.slot, r]));
    const positionBand = (pos: string): number => {
      const p = pos.trim().toUpperCase();
      if (p === "PG") return 0;
      if (p === "SG") return 1;
      if (p === "SF") return 2;
      if (p === "PF") return 3;
      if (p === "C") return 4;
      return 5;
    };
    const squad = seat.roster
      .map((row) => {
        const sp = this.resolveDraftSquadPlayer(row.playerId, row.sourceTeamId);
        return sp ? { row, sp } : null;
      })
      .filter((x): x is { row: (typeof seat.roster)[number]; sp: SquadPlayer } => !!x)
      .sort((a, b) => {
        const band =
          positionBand(String(a.sp.player.primaryPosition)) - positionBand(String(b.sp.player.primaryPosition));
        if (band) return band;
        const aBench = a.row.slot.startsWith("BENCH_") ? 1 : 0;
        const bBench = b.row.slot.startsWith("BENCH_") ? 1 : 0;
        if (aBench !== bBench) return aBench - bBench;
        return b.sp.overall - a.sp.overall || a.sp.player.name.localeCompare(b.sp.player.name);
      });
    const selectedId =
      (this.draftInspectPlayerId && squad.some((s) => s.sp.player.id === this.draftInspectPlayerId)
        ? this.draftInspectPlayerId
        : squad[0]?.sp.player.id) ?? null;
    const selected = squad.find((s) => s.sp.player.id === selectedId) ?? squad[0] ?? null;

    const raw = form.map((slot) => {
      const pos = formationToPitchPercent(slot.x, slot.z);
      return { id: slot.id, left: pos.left, bottom: pos.bottom, pinned: false };
    });
    const laidOut = separatePitchMarkers(raw);
    const starters = form
      .map((slot) => {
        const pos = laidOut.get(slot.id) ?? formationToPitchPercent(slot.x, slot.z);
        const row = bySlot.get(slot.id);
        if (!row) {
          return `<div class="pitch-slot empty" data-slot="${escapeAttr(slot.id)}" data-draft-lineup-drop="1" style="left:${pos.left}%;bottom:${pos.bottom}%"><span class="pitch-slot-label">${escapeHtml(slot.id)}</span></div>`;
        }
        const sp = this.resolveDraftSquadPlayer(row.playerId, row.sourceTeamId);
        if (!sp) {
          return `<div class="pitch-slot empty" data-slot="${escapeAttr(slot.id)}" data-draft-lineup-drop="1" style="left:${pos.left}%;bottom:${pos.bottom}%"><span class="pitch-slot-label">${escapeHtml(slot.id)}</span></div>`;
        }
        const colors = this.draftKitColors(sp);
        const on = sp.player.id === selectedId ? " on" : "";
        return `<div class="pitch-slot${on}" data-slot="${escapeAttr(slot.id)}" data-draft-lineup-drop="1" style="left:${pos.left}%;bottom:${pos.bottom}%">
          <button type="button" class="pitch-token${on}" draggable="true" data-draft-lineup="1" data-slot="${escapeAttr(slot.id)}" data-pyramid="draft-inspect-pick" data-player-id="${escapeAttr(sp.player.id)}" aria-label="${escapeAttr(sp.player.name)}">
            ${kitMarkerHtml(sp.player, row.shirtNumber, {
              primaryColor: colors.primary,
              textColor: colors.text,
            })}
          </button>
        </div>`;
      })
      .join("");
    const benchSlots = draftSlots().filter((s) => s.startsWith("BENCH_"));
    const bench = benchSlots
      .map((slot) => {
        const row = bySlot.get(slot);
        if (!row) {
          return `<div class="bench-card empty" data-slot="${escapeAttr(slot)}" data-draft-lineup-drop="1"><span class="bench-empty">+</span></div>`;
        }
        const sp = this.resolveDraftSquadPlayer(row.playerId, row.sourceTeamId);
        if (!sp) {
          return `<div class="bench-card empty" data-slot="${escapeAttr(slot)}" data-draft-lineup-drop="1"><span class="bench-empty">+</span></div>`;
        }
        const colors = this.draftKitColors(sp);
        const on = sp.player.id === selectedId ? " on" : "";
        return `<button type="button" class="bench-card${on}" draggable="true" data-draft-lineup="1" data-slot="${escapeAttr(slot)}" data-draft-lineup-drop="1" data-pyramid="draft-inspect-pick" data-player-id="${escapeAttr(sp.player.id)}" aria-label="${escapeAttr(sp.player.name)}">
          ${kitMarkerHtml(sp.player, row.shirtNumber, {
            primaryColor: colors.primary,
            textColor: colors.text,
            className: "kit-marker-bench",
          })}
        </button>`;
      })
      .join("");

    const rosterCard = selected
      ? (() => {
          const colors = this.draftKitColors(selected.sp);
          return `<div class="team-roster-card">
            ${portraitHtml(selected.sp.player, selected.row.shirtNumber, colors.primary, {
              surnameOnly: true,
              className: "kit-marker-roster",
              textColor: colors.text,
            })}
            <h3>${selected.row.shirtNumber}. ${escapeHtml(kitInitialSurnameLabel(selected.sp.player.displayName, selected.sp.player.name))}</h3>
            <div class="char-meta">${escapeHtml(String(selected.sp.player.primaryPosition))} · OVR ${Math.round(selected.sp.overall)}</div>
          </div>`;
        })()
      : `<div class="team-roster-card"><div class="char-meta">No players</div></div>`;

    const rosterRows = squad
      .map(({ row, sp }) => {
        const active = sp.player.id === selectedId ? " on" : "";
        const name = kitSurnameFromName(sp.player.displayName || sp.player.name);
        return `<button type="button" class="roster-row${active}" draggable="true" data-draft-lineup="1" data-slot="${escapeAttr(row.slot)}" data-pyramid="draft-inspect-pick" data-player-id="${escapeAttr(sp.player.id)}">
          <span class="roster-num">${row.shirtNumber}</span>
          <span class="roster-name">${escapeHtml(name)}</span>
          <span class="roster-pos">${escapeHtml(String(sp.player.primaryPosition))}</span>
          <span class="roster-role">${Math.round(sp.overall)}</span>
        </button>`;
      })
      .join("");

    const pitchWell =
      this.draftInspectMode === "player" && selected
        ? `<div class="team-pitch team-pitch-panel" aria-label="Player select">
            <div class="pitch-overlay-card player-pitch-select">
              ${this.draftInspectPlayerCardHtml(selected.sp)}
            </div>
          </div>`
        : `<div class="team-pitch team-pitch-court" aria-label="${escapeAttr(seat.name)} formation">
            <div class="team-pitch-markings court-markings" aria-hidden="true"></div>
            ${starters}
          </div>`;

    return `
      <div class="team-select-body">
        <aside class="team-roster">
          ${rosterCard}
          <div class="team-roster-list">${rosterRows}</div>
        </aside>
        ${pitchWell}
        <aside class="team-bench">
          <div class="team-bench-title">BENCH</div>
          <div class="team-bench-list">${bench}</div>
        </aside>
      </div>
    `;
  }

  private applyDraftInspectSwap(fromSlot: string, toSlot: string): boolean {
    if (this.draftInspectSeat == null || fromSlot === toSlot) return false;
    const draft = this.draftState();
    const seat = draft.seats[this.draftInspectSeat];
    if (!seat) return false;
    const roster = swapDraftRosterSlots(seat.roster, fromSlot, toSlot);
    if (roster === seat.roster) return false;
    const seats = draft.seats.map((s, i) => (i === this.draftInspectSeat ? { ...s, roster } : s));
    this.persistDraft({ ...draft, seats });
    return true;
  }

  private draftKitColors(sp: SquadPlayer): { primary: string; secondary: string; text: string } {
    const team = this.db.teams.get(sp.membership.teamId);
    const primary = team?.primaryColor ?? "#1a2740";
    const secondary = team?.secondaryColor ?? "#f3f6fb";
    return { primary, secondary, text: contrastingKitText(primary, secondary) };
  }

  private draftCardFaceHtml(sp: SquadPlayer): string {
    return playerCardShellHtml(sp, this.draftTeamContext(sp), {
      editing: false,
      editDirty: false,
      flipped: false,
      flipY: 0,
      profileView: "hex",
      hideProfile: true,
      imagePaths: [],
    })
      .replace(/<div class="player-card-shell-head">[\s\S]*?<\/div>/, "")
      .replace(/<div class="player-card-flip-nav"[\s\S]*?<\/div>/, "");
  }

  private draftCardHtml(
    sp: SquadPlayer,
    flashPlayerId: string | null = null,
    opts?: { pickable?: boolean },
  ): string {
    const flashing = !!flashPlayerId && flashPlayerId === sp.player.id;
    const pickable = opts?.pickable !== false && !flashing;
    const hint = flashing ? " · AI pick" : pickable ? " · tap to draft" : "";
    return `<button type="button" class="pyramid-draft-card${flashing ? " is-ai-flash" : ""}" data-pyramid="draft-pick" data-player-id="${escapeAttr(sp.player.id)}"${pickable ? "" : " disabled"}${titleAttr(`${sp.player.name} · ${sp.player.primaryPosition} · OVR ${Math.round(sp.overall)}${hint}`)}>
      ${this.draftCardFaceHtml(sp)}
    </button>`;
  }

  private draftTeamContext(sp: SquadPlayer): PlayerCardTeamContext {
    const team = this.db.teams.get(sp.membership.teamId) ?? null;
    return {
      teamName: team?.name ?? "VORTEX",
      teamColor: team?.primaryColor ?? "#1a2740",
      teamSecondaryColor: team?.secondaryColor ?? "#f3f6fb",
      team,
    };
  }

  private resolveDraftSquadPlayer(playerId: string, preferredTeamId?: string): SquadPlayer | null {
    if (preferredTeamId) {
      const hit = this.db.getSquad(preferredTeamId).find((s) => s.player.id === playerId);
      if (hit) return hit;
    }
    for (const team of this.db.teams.values()) {
      const hit = this.db.getSquad(team.id).find((s) => s.player.id === playerId);
      if (hit) return hit;
    }
    return null;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      if (this.jerseyPick != null) {
        this.jerseyPick = null;
        this.render();
        return;
      }
      this.onAction?.("back");
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.state().view !== "ring") return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest?.("[data-pyramid='ring-stage'], .pyramid-ring-viewport")) return;
    // Rank arrows / kit controls must click; only empty stage (or card chrome drag) turns the ring.
    if (t.closest("button, .pyramid-ring-bound, .pyramid-ring-toolbar, .pyramid-zoom, a, input, select")) return;
    this.ringDragging = true;
    this.ringLastX = e.clientX;
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.ringDragging) return;
    const dx = e.clientX - this.ringLastX;
    this.ringLastX = e.clientX;
    this.ringAngle = (this.ringAngle + dx * 0.35) % 360;
    this.applyViewZoom();
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.ringDragging) return;
    this.ringDragging = false;
    try {
      (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private onWheel(e: WheelEvent): void {
    const t = e.target as HTMLElement | null;
    // Pyramid list: let the body scroll naturally (do not steal the wheel).
    if (this.state().view === "pyramid") {
      if (t?.closest?.("[data-pyramid-scroll], .pyramid-body, .pyramid-tiers")) return;
      return;
    }
    // Bracket: allow scroll; header ± still zooms.
    if (this.state().view === "bracket") {
      if (t?.closest?.("input, textarea, select, button")) return;
      return;
    }
    // Ring: wheel zooms when over the stage; otherwise leave alone.
    if (!t?.closest?.(".pyramid-ring-viewport")) return;
    e.preventDefault();
    this.nudgeZoom(e.deltaY > 0 ? -0.08 : 0.08);
  }

  private onDragStart(e: DragEvent): void {
    if (this.state().view === "draft" && this.draftInspectSeat != null) {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-draft-lineup='1'][data-slot]");
      const slot = el?.getAttribute("data-slot");
      if (!el || !slot || !e.dataTransfer) {
        e.preventDefault();
        return;
      }
      this.draftLineupDragSlot = slot;
      e.dataTransfer.setData("text/plain", slot);
      e.dataTransfer.effectAllowed = "move";
      el.classList.add("dragging");
      return;
    }
    if (this.state().view !== "pyramid") {
      e.preventDefault();
      return;
    }
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("button, .pyramid-move, .pyramid-cell-kit, .pyramid-elevate")) {
      e.preventDefault();
      return;
    }
    const cell = t?.closest?.<HTMLElement>(".pyramid-cell[data-pyramid-zone]");
    if (!cell) {
      e.preventDefault();
      return;
    }
    const zone = cell.getAttribute("data-pyramid-zone");
    if (zone === "pool") {
      const idx = Number(cell.getAttribute("data-pyramid-pool-index"));
      if (!Number.isFinite(idx)) {
        e.preventDefault();
        return;
      }
      this.dragFrom = { kind: "pool", index: idx };
    } else {
      const idx = Number(cell.getAttribute("data-pyramid-index"));
      if (!Number.isFinite(idx)) {
        e.preventDefault();
        return;
      }
      this.dragFrom = { kind: "order", index: idx };
    }
    e.dataTransfer?.setData("text/plain", `${this.dragFrom.kind}:${this.dragFrom.index}`);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    cell.classList.add("is-dragging");
  }

  private onDragOver(e: DragEvent): void {
    if (this.state().view === "draft" && this.draftInspectSeat != null && this.draftLineupDragSlot) {
      const target = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(
        "[data-draft-lineup-drop='1'][data-slot], [data-draft-lineup='1'][data-slot]",
      );
      if (!target) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      this.root.querySelectorAll(".pitch-slot.drag-over, .bench-card.drag-over, .roster-row.drag-over").forEach((el) => {
        if (el !== target) el.classList.remove("drag-over");
      });
      target.classList.add("drag-over");
      return;
    }
    if (this.state().view !== "pyramid") return;
    const cell = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".pyramid-cell[data-pyramid-zone]");
    if (!cell) return;
    e.preventDefault();
    this.root.querySelectorAll(".pyramid-cell.is-drag-over").forEach((el) => {
      if (el !== cell) el.classList.remove("is-drag-over");
    });
    cell.classList.add("is-drag-over");
  }

  private onDrop(e: DragEvent): void {
    if (this.state().view === "draft" && this.draftInspectSeat != null) {
      const target = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(
        "[data-draft-lineup-drop='1'][data-slot], [data-draft-lineup='1'][data-slot]",
      );
      const fromSlot = this.draftLineupDragSlot ?? e.dataTransfer?.getData("text/plain") ?? null;
      const toSlot = target?.getAttribute("data-slot") ?? null;
      this.root
        .querySelectorAll(".pitch-slot.drag-over, .bench-card.drag-over, .roster-row.drag-over, .dragging")
        .forEach((el) => el.classList.remove("drag-over", "dragging"));
      this.draftLineupDragSlot = null;
      if (!fromSlot || !toSlot || fromSlot === toSlot) return;
      e.preventDefault();
      if (this.applyDraftInspectSwap(fromSlot, toSlot)) {
        this.suppressDraftInspectClick = true;
        const draft = this.draftState();
        const seat = draft.seats[this.draftInspectSeat];
        const moved = seat?.roster.find((r) => r.slot === toSlot);
        if (moved) this.draftInspectPlayerId = moved.playerId;
        this.render();
      }
      return;
    }
    const cell = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".pyramid-cell[data-pyramid-zone]");
    this.root.querySelectorAll(".pyramid-cell.is-dragging, .pyramid-cell.is-drag-over").forEach((el) => {
      el.classList.remove("is-dragging", "is-drag-over");
    });
    if (!cell || this.dragFrom == null) return;
    e.preventDefault();
    const zone = cell.getAttribute("data-pyramid-zone");
    const st = this.state();
    if (this.dragFrom.kind === "order" && zone === "order") {
      const to = Number(cell.getAttribute("data-pyramid-index"));
      if (!Number.isFinite(to)) return;
      this.persist({ order: movePyramidIndex(st.order, this.dragFrom.index, to) });
    } else if (this.dragFrom.kind === "pool" && zone === "order") {
      const to = Number(cell.getAttribute("data-pyramid-index"));
      if (!Number.isFinite(to)) return;
      this.persist(swapPyramidWithPool(st.order, st.pool, to, this.dragFrom.index));
    } else if (this.dragFrom.kind === "order" && zone === "pool") {
      const to = Number(cell.getAttribute("data-pyramid-pool-index"));
      if (!Number.isFinite(to)) return;
      this.persist(swapPyramidWithPool(st.order, st.pool, this.dragFrom.index, to));
    } else if (this.dragFrom.kind === "pool" && zone === "pool") {
      const to = Number(cell.getAttribute("data-pyramid-pool-index"));
      if (!Number.isFinite(to)) return;
      const pool = movePyramidIndex(st.pool, this.dragFrom.index, to);
      this.persist({ pool });
    }
    this.dragFrom = null;
    this.renderKeepingScroll();
  }
}
