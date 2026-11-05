import type { GameDatabase } from "../core/Database";
import type { FixtureRecord, TeamRecord } from "../data/schema";
import { todayIso } from "../data/leagueSchedule";
import {
  PREDICTION_SLOT_COUNT,
  clampPredictionViewWeek,
  fixtureWinner,
  fixturesInWindow,
  liveWeekPoints,
  maxPredictionWeekStart,
  minPredictionWeekStart,
  predictionWeekEnd,
  predictionWeekStart,
  shiftPredictionWeek,
  weekByStart,
  type PredictionPick,
  type PredictionWinner,
  type PredictionsState,
} from "../football/predictions/Predictions";
import { buildTeamWinPctMap, likelyWinner } from "../football/predictions/LikelyWinner";
import { titleAttr } from "./infoOverlays";
import { teamBadgeHtml } from "./Portrait";

export type PredictionsViewMode = "predict" | "admin";

export function predictionsPanelHtml(
  db: GameDatabase,
  state: PredictionsState,
  mode: PredictionsViewMode,
  viewWeekStart: string,
  asOf = todayIso(),
  adminDraft?: Set<string>,
  showModelHints = false,
): string {
  const weekStart = clampPredictionViewWeek(viewWeekStart, state, asOf);
  const week = weekByStart(state, weekStart);
  const weekEnd = predictionWeekEnd(weekStart);
  const live = week ? liveWeekPoints(week, db.fixtures) : 0;
  const minWeek = minPredictionWeekStart(state, asOf);
  const maxWeek = maxPredictionWeekStart(asOf);
  const canPrev = weekStart > minWeek;
  const canNext = weekStart < maxWeek;

  if (mode === "admin") {
    const selected = adminDraft ?? new Set(week?.fixtureIds ?? []);
    return adminPanelHtml(db, selected, weekStart, weekEnd, state.totalPoints, canPrev, canNext);
  }

  const winPct = showModelHints ? buildTeamWinPctMap(db.fixtures, db.teams.values()) : undefined;
  const rows =
    week?.fixtureIds.length
      ? week.fixtureIds
          .map((id) => {
            const fixture = db.fixtures.find((f) => f.id === id);
            const pick = week.picks.find((p) => p.fixtureId === id);
            return predictionRowHtml(fixture, pick, db, showModelHints, winPct);
          })
          .join("")
      : `<p class="hint pred-empty">No prediction slate yet. An admin can set ten games, or they auto-select for this Sat–Fri window.</p>`;

  return `
    <div class="panel-head pred-panel-head">
      <button type="button" data-act="panel-back">Back</button>
      <button type="button" class="pred-hint-btn ${showModelHints ? "on" : ""}" data-pred="hints" aria-pressed="${showModelHints ? "true" : "false"}"${titleAttr(showModelHints ? "Hide likely winners" : "Show likely winners")}>PREDICT</button>
      <button type="button" class="pred-admin-btn" data-pred="admin">Admin</button>
    </div>
    ${weekNavHtml(weekStart, weekEnd, canPrev, canNext, live, state.totalPoints)}
    <div class="pred-list">${rows}</div>
  `;
}

function weekNavHtml(
  weekStart: string,
  weekEnd: string,
  canPrev: boolean,
  canNext: boolean,
  live: number,
  totalPoints: number,
): string {
  return `
    <div class="pred-week-nav">
      <button type="button" data-pred="week-prev" ${canPrev ? "" : "disabled"} aria-label="Previous week">‹</button>
      <div class="pred-week-label">
        <strong>${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}</strong>
        <span class="pred-points">Week ${live} · Total <strong>${totalPoints}</strong></span>
      </div>
      <button type="button" data-pred="week-next" ${canNext ? "" : "disabled"} aria-label="Next week">›</button>
    </div>
  `;
}

function adminPanelHtml(
  db: GameDatabase,
  selected: Set<string>,
  weekStart: string,
  weekEnd: string,
  totalPoints: number,
  canPrev: boolean,
  canNext: boolean,
): string {
  const pool = fixturesInWindow(db.fixtures, weekStart);
  const list =
    pool
      .map((f) => {
        const home = db.teams.get(f.homeTeamId);
        const away = db.teams.get(f.awayTeamId);
        const on = selected.has(f.id);
        return `<label class="pred-admin-row ${on ? "on" : ""}">
          <input type="checkbox" data-pred-pick="${escapeHtml(f.id)}" ${on ? "checked" : ""} ${selected.size >= PREDICTION_SLOT_COUNT && !on ? "disabled" : ""}/>
          <span class="pred-admin-date">${formatShortDate(f.date)}</span>
          <span class="pred-admin-match">${adminSideHtml(home, f.homeTeamId)}<span class="pred-admin-vs">vs</span>${adminSideHtml(away, f.awayTeamId)}</span>
        </label>`;
      })
      .join("") || `<p class="hint">No conference fixtures in this Sat–Fri window.</p>`;

  return `
    <div class="panel-head">
      <button type="button" data-pred="admin-back">Back</button>
      <h2>Prediction Admin</h2>
    </div>
    ${weekNavHtml(weekStart, weekEnd, canPrev, canNext, selected.size, totalPoints)}
    <p class="hint pred-rules">Choose or re-set the gold prediction games for this week. Password gate comes later.</p>
    <div class="pred-admin-actions">
      <button type="button" data-pred="admin-save" ${selected.size === 0 ? "disabled" : ""}>Save slate</button>
      <button type="button" data-pred="admin-clear">Clear / re-set</button>
      <button type="button" data-pred="admin-auto">Auto-select</button>
    </div>
    <div class="pred-admin-list">${list}</div>
  `;
}

function adminSideHtml(team: TeamRecord | undefined, fallbackId: string): string {
  const crest = team
    ? teamBadgeHtml(team, { className: "pred-crest", size: 18 })
    : `<span class="pred-crest pred-crest-empty" aria-hidden="true"></span>`;
  const label = escapeHtml(team?.abbreviation || team?.name || fallbackId);
  return `<span class="pred-admin-side">${crest}<span class="pred-admin-abbr">${label}</span></span>`;
}

function predictionRowHtml(
  fixture: FixtureRecord | undefined,
  pick: PredictionPick | undefined,
  db: GameDatabase,
  showModelHints: boolean,
  winPct?: Map<string, number>,
): string {
  if (!fixture || !pick) {
    return `<div class="pred-row empty"><span class="hint">Missing fixture</span></div>`;
  }
  const home = db.teams.get(fixture.homeTeamId);
  const away = db.teams.get(fixture.awayTeamId);
  const locked = pick.locked;
  const played = !!(
    fixture.played &&
    fixture.homeScore !== undefined &&
    fixture.awayScore !== undefined
  );
  const actualWinner = played ? fixtureWinner(fixture.homeScore, fixture.awayScore) : null;
  const modelFav =
    showModelHints && !played ? likelyWinner(fixture, db, winPct) : null;
  const disabled = locked || played;
  const actual = played
    ? `<span class="pred-actual">${fixture.homeScore}–${fixture.awayScore}</span>`
    : "";
  const correct =
    played && pick.winner && actualWinner ? (pick.winner === actualWinner ? "hit" : "miss") : "";
  return `
    <div class="pred-row ${locked ? "locked" : ""} ${played ? "played" : ""} ${correct}" data-fixture="${escapeHtml(fixture.id)}">
      <div class="pred-row-match">
        ${winnerSideHtml(fixture.id, "HOME", home, fixture.homeTeamId, pick.winner, actualWinner, disabled, modelFav)}
        <span class="pred-vs" aria-hidden="true">vs</span>
        ${winnerSideHtml(fixture.id, "AWAY", away, fixture.awayTeamId, pick.winner, actualWinner, disabled, modelFav)}
        ${actual}
      </div>
      <button type="button" class="pred-lock ${locked ? "on" : ""}" data-pred="lock" data-fixture="${escapeHtml(fixture.id)}" aria-label="${locked ? "Unlock" : "Lock"} prediction"${titleAttr(locked ? "Unlock" : "Lock")} ${played ? "disabled" : ""}>${locked ? "locked" : "lock"}</button>
    </div>
  `;
}

function winnerSideHtml(
  fixtureId: string,
  side: PredictionWinner,
  team: TeamRecord | undefined,
  fallbackId: string,
  pick: PredictionWinner | null,
  actual: PredictionWinner | null,
  disabled: boolean,
  modelFav: PredictionWinner | null,
): string {
  const on = pick === side;
  const won = actual === side;
  const fav = modelFav === side;
  const abbr = escapeHtml(team?.abbreviation || team?.name || fallbackId);
  const name = escapeHtml(team?.name || fallbackId);
  const crest = team
    ? teamBadgeHtml(team, { className: "pred-crest", size: 28 })
    : `<span class="pred-crest pred-crest-empty" aria-hidden="true"></span>`;
  const tag = disabled ? "div" : "button";
  const typeAttr = disabled ? "" : ` type="button"`;
  const dataAttr = disabled
    ? ""
    : ` data-pred-winner="${side}" data-fixture="${escapeHtml(fixtureId)}"`;
  const aria = disabled
    ? ""
    : ` aria-pressed="${on ? "true" : "false"}" aria-label="Pick ${name} to win"`;
  return `<${tag}${typeAttr} class="pred-side ${side === "HOME" ? "home" : "away"} ${on ? "on" : ""} ${won ? "actual-win" : ""} ${fav ? "model-fav" : ""}"${dataAttr}${aria}>
    ${crest}
    <span class="pred-side-abbr">${abbr}</span>
  </${tag}>`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export { shiftPredictionWeek, predictionWeekStart };
