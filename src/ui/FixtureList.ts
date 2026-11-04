import type { GameDatabase } from "../core/Database";
import type { FixtureRecord, TeamRecord } from "../data/schema";
import { todayIso } from "../data/leagueSchedule";
import { formatFixtureTipOffUk } from "../football/constants";
import {
  competitionForLeague,
  conferenceForTeam,
  isEnglishLeagueCompetition,
  LEAGUE_TABS,
  type LeagueTabId,
} from "../football/league/Standings";
import { pickWeekDate } from "../football/league/Simulate";
import { teamBadgeHtml } from "./Portrait";

export function resolveFixtureDate(db: GameDatabase, league: LeagueTabId, current: string): string {
  const dates = fixtureDatesForTab(db, league);
  return dates.includes(current) ? current : pickWeekDate(dates, todayIso());
}

export function stepFixtureDate(
  db: GameDatabase,
  league: LeagueTabId,
  current: string,
  dir: "prev" | "next",
): string {
  const dates = fixtureDatesForTab(db, league);
  const date = dates.includes(current) ? current : pickWeekDate(dates, todayIso());
  const i = dates.indexOf(date);
  const next = dir === "next" ? i + 1 : i - 1;
  return next >= 0 && next < dates.length ? dates[next]! : date;
}

function currentTeamIds(db: GameDatabase): Set<string> {
  const ids = new Set<string>();
  for (const t of db.teams.values()) {
    if (t.teamType === "CURRENT_TEAM") ids.add(t.id);
  }
  return ids;
}

function conferenceTeamIds(db: GameDatabase, league: "EAST" | "WEST"): Set<string> {
  const ids = new Set<string>();
  for (const t of db.teams.values()) {
    if (t.teamType !== "CURRENT_TEAM") continue;
    if (conferenceForTeam(t) === league) ids.add(t.id);
  }
  return ids;
}

function fixtureMatchesTab(fixture: FixtureRecord, db: GameDatabase, tab: LeagueTabId): boolean {
  if (tab === "NBA") {
    const ids = currentTeamIds(db);
    return (
      isEnglishLeagueCompetition(fixture.competition) ||
      ids.has(fixture.homeTeamId) ||
      ids.has(fixture.awayTeamId)
    );
  }
  const competition = competitionForLeague(tab);
  const ids = conferenceTeamIds(db, tab);
  return (
    fixture.competition === competition ||
    ids.has(fixture.homeTeamId) ||
    ids.has(fixture.awayTeamId)
  );
}

function fixtureDatesForTab(db: GameDatabase, tab: LeagueTabId): string[] {
  const dates = new Set<string>();
  for (const f of db.fixtures) {
    if (fixtureMatchesTab(f, db, tab)) dates.add(f.date);
  }
  return [...dates].sort();
}

export function fixturePanelHtml(
  db: GameDatabase,
  league: LeagueTabId,
  date: string,
  highlightId: string,
  predictionIds: Set<string> = new Set(),
): string {
  const dates = fixtureDatesForTab(db, league);
  const week = db.fixtures
    .filter((f) => f.date === date && fixtureMatchesTab(f, db, league))
    .sort((a, b) => {
      if (!!a.played !== !!b.played) return a.played ? -1 : 1;
      return a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
    });
  const label = LEAGUE_TABS.find((t) => t.id === league)?.label ?? "NBA";
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

function teamSideHtml(team: TeamRecord | undefined, fallbackId: string, side: "home" | "away"): string {
  const name = escapeHtml(team?.name ?? fallbackId);
  const crest = team
    ? teamBadgeHtml(team, { className: "fix-crest", size: 18 })
    : `<span class="fix-crest form-crest-empty" aria-hidden="true"></span>`;
  return `<span class="fix-side form-${side}">${crest}<span class="fix-name">${name}</span></span>`;
}

function fixtureRow(
  fixture: FixtureRecord,
  db: GameDatabase,
  highlightId: string,
  predictionGold: boolean,
): string {
  const home = db.teams.get(fixture.homeTeamId);
  const away = db.teams.get(fixture.awayTeamId);
  const user = fixture.homeTeamId === highlightId || fixture.awayTeamId === highlightId;
  const tip = formatFixtureTipOffUk(fixture.date, fixture.time);
  const mid =
    fixture.played && fixture.homeScore !== undefined && fixture.awayScore !== undefined
      ? `<span class="fix-mid"><span class="fix-score">${fixture.homeScore}–${fixture.awayScore}</span></span>`
      : `<span class="fix-mid"><span class="vs">vs</span>${
          tip ? `<span class="fix-time">${escapeHtml(tip)}</span>` : ""
        }</span>`;
  return `<div class="fix-row ${user ? "user" : ""} ${fixture.played ? "played" : ""} ${predictionGold ? "prediction-gold" : ""}">
    ${teamSideHtml(home, fixture.homeTeamId, "home")}
    ${mid}
    ${teamSideHtml(away, fixture.awayTeamId, "away")}
  </div>`;
}

function formatWeekDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
