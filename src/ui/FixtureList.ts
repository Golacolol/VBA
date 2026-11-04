import type { GameDatabase } from "../core/Database";
import type { EnglishLeague, FixtureRecord } from "../data/schema";
import { todayIso } from "../data/leagueSchedule";
import { competitionForLeague, LEAGUE_TABS } from "../football/league/Standings";
import { fixtureDates, pickWeekDate } from "../football/league/Simulate";

export function resolveFixtureDate(db: GameDatabase, league: EnglishLeague, current: string): string {
  const dates = fixtureDatesForConference(db, league);
  return dates.includes(current) ? current : pickWeekDate(dates, todayIso());
}

export function stepFixtureDate(db: GameDatabase, league: EnglishLeague, current: string, dir: "prev" | "next"): string {
  const dates = fixtureDatesForConference(db, league);
  const date = dates.includes(current) ? current : pickWeekDate(dates, todayIso());
  const i = dates.indexOf(date);
  const next = dir === "next" ? i + 1 : i - 1;
  return next >= 0 && next < dates.length ? dates[next] : date;
}

function conferenceTeamIds(db: GameDatabase, league: EnglishLeague): Set<string> {
  const ids = new Set<string>();
  for (const t of db.teams.values()) {
    if (t.teamType !== "CURRENT_TEAM") continue;
    if (t.conference === league || t.league === league) ids.add(t.id);
  }
  return ids;
}

function fixtureDatesForConference(db: GameDatabase, league: EnglishLeague): string[] {
  const competition = competitionForLeague(league);
  const ids = conferenceTeamIds(db, league);
  const dates = new Set<string>();
  for (const f of db.fixtures) {
    if (f.competition === competition || ids.has(f.homeTeamId) || ids.has(f.awayTeamId)) {
      dates.add(f.date);
    }
  }
  // Prefer dates that already have results when picking a week.
  return [...dates].sort();
}

export function fixturePanelHtml(
  db: GameDatabase,
  league: EnglishLeague,
  date: string,
  highlightId: string,
  predictionIds: Set<string> = new Set(),
): string {
  const competition = competitionForLeague(league);
  const dates = fixtureDatesForConference(db, league);
  const conferenceIds = conferenceTeamIds(db, league);
  const week = db.fixtures
    .filter(
      (f) =>
        f.date === date &&
        (f.competition === competition ||
          conferenceIds.has(f.homeTeamId) ||
          conferenceIds.has(f.awayTeamId)),
    )
    .sort((a, b) => {
      // Played results first, then kick-off time / id.
      if (!!a.played !== !!b.played) return a.played ? -1 : 1;
      return a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
    });
  const label = LEAGUE_TABS.find((t) => t.id === league)?.label ?? "Eastern Conference";
  return `
    <div class="panel-head">
      <button type="button" data-act="panel-back">Back</button>
      <div class="lf-tabs" role="tablist" aria-label="League or fixtures">
        <button type="button" data-act="lf-tab" data-lf="league" role="tab" aria-selected="false">League</button>
        <button type="button" class="on" data-act="lf-tab" data-lf="fixtures" role="tab" aria-selected="true">Fixtures</button>
      </div>
      <h2>Fixtures</h2>
    </div>
    <div class="league-tabs">
      ${LEAGUE_TABS.map(
        (tab) =>
          `<button type="button" class="${tab.id === league ? "on" : ""}" data-league="${tab.id}">${tab.label}</button>`,
      ).join("")}
    </div>
    <div class="week-nav">
      <button type="button" data-week="prev" ${dates[0] === date ? "disabled" : ""}>Previous</button>
      <strong>${formatWeekDate(date)} · ${label}</strong>
      <button type="button" data-week="next" ${dates[dates.length - 1] === date ? "disabled" : ""}>Next</button>
    </div>
    <div class="fixture-week">
      ${week.map((f) => fixtureRow(f, db, highlightId, predictionIds.has(f.id))).join("") || `<p class="hint">No fixtures this week.</p>`}
    </div>
  `;
}

function fixtureRow(fixture: FixtureRecord, db: GameDatabase, highlightId: string, predictionGold: boolean): string {
  const home = db.teams.get(fixture.homeTeamId);
  const away = db.teams.get(fixture.awayTeamId);
  const user = fixture.homeTeamId === highlightId || fixture.awayTeamId === highlightId;
  const score =
    fixture.played && fixture.homeScore !== undefined && fixture.awayScore !== undefined
      ? `<span class="fix-score">${fixture.homeScore}–${fixture.awayScore}</span>`
      : `<span class="vs">vs</span>`;
  return `<div class="fix-row ${user ? "user" : ""} ${fixture.played ? "played" : ""} ${predictionGold ? "prediction-gold" : ""}">
    <span>${escapeHtml(home?.name ?? fixture.homeTeamId)}</span>
    ${score}
    <span>${escapeHtml(away?.name ?? fixture.awayTeamId)}</span>
  </div>`;
}

function formatWeekDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
