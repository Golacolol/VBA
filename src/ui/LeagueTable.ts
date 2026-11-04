import type { GameDatabase } from "../core/Database";
import { LEAGUE_TABS, standingsFor, type LeagueTabId } from "../football/league/Standings";
import { teamBadgeHtml } from "./Portrait";

export function leaguePanelHtml(db: GameDatabase, league: LeagueTabId, highlightId: string): string {
  const rows = standingsFor(db.fixtures, [...db.teams.values()], league);
  const label = LEAGUE_TABS.find((t) => t.id === league)?.label ?? "NBA";
  const byId = db.teams;
  return `
    <div class="panel-head">
      <button type="button" data-act="panel-back">Back</button>
      <div class="lf-tabs" role="tablist" aria-label="Standings or fixtures">
        <button type="button" class="on" data-act="lf-tab" data-lf="league" role="tab" aria-selected="true">Standings</button>
        <button type="button" data-act="lf-tab" data-lf="fixtures" role="tab" aria-selected="false">Fixtures</button>
      </div>
      <h2>${label}</h2>
    </div>
    <div class="league-tabs">
      ${LEAGUE_TABS.map(
        (tab) =>
          `<button type="button" class="${tab.id === league ? "on" : ""}" data-league="${tab.id}">${tab.label}</button>`,
      ).join("")}
    </div>
    <div class="table-wrap">
      <table class="league-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>PD</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row, i) => {
              const team = byId.get(row.teamId);
              const crest = team
                ? teamBadgeHtml(team, { className: "league-table-crest", size: 18 })
                : "";
              return `<tr class="${row.teamId === highlightId ? "user" : ""}">
                  <td>${i + 1}</td>
                  <td class="league-team-cell">${crest}<span>${escapeHtml(row.name)}</span></td>
                  <td>${row.played}</td>
                  <td>${row.won}</td>
                  <td>${row.lost}</td>
                  <td>${row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
