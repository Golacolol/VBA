/**
 * Shared player sports-card markup (Formation PLAYER SELECT + Player Database).
 */
import type { SquadPlayer } from "../core/Database";
import type { PlayerAttributes, PositionCode, TeamRecord } from "../data/schema";
import { listProfileAttrSpokes } from "../football/players/PlayerStats";
import { contrastingKitText } from "./kitContrast";
import { imageLabel } from "./playerImages";
import {
  kitSurnameFromName,
  portraitAsset,
  surnameFitPx,
  surnameLetterSpacingEm,
  teamBadgeHtml,
} from "./Portrait";
import { titleAttr } from "./infoOverlays";
import { menuPlayerPngsEnabled } from "./menuPlayerPngs";
import { profileStatsBlock, type ProfileStatsMode } from "./ProfileHex";

export const EDIT_POSITIONS: PositionCode[] = ["PG", "SG", "SF", "PF", "C"];

export type EditStatKey = keyof PlayerAttributes;

export const EDIT_STAT_GROUPS: {
  title: string;
  fields: { key: EditStatKey; label: string; optional?: boolean }[];
}[] = [
  {
    title: "Shooting",
    fields: [
      { key: "finishing", label: "Finishing" },
      { key: "midRange", label: "Mid-range" },
      { key: "threePoint", label: "3-Point" },
      { key: "freeThrow", label: "Free throw" },
    ],
  },
  {
    title: "Ball / Pass",
    fields: [
      { key: "ballHandle", label: "Handle" },
      { key: "passAccuracy", label: "Pass" },
    ],
  },
  {
    title: "Defense",
    fields: [
      { key: "perimeterD", label: "Perimeter D" },
      { key: "interiorD", label: "Interior D" },
      { key: "rebound", label: "Rebound" },
      { key: "steal", label: "Steal" },
      { key: "block", label: "Block" },
    ],
  },
  {
    title: "Athleticism",
    fields: [
      { key: "speed", label: "Speed" },
      { key: "acceleration", label: "Accel", optional: true },
      { key: "vertical", label: "Vertical" },
      { key: "strength", label: "Strength" },
      { key: "stamina", label: "Stamina" },
    ],
  },
  {
    title: "Mental",
    fields: [
      { key: "iq", label: "IQ" },
      { key: "clutch", label: "Clutch" },
    ],
  },
];

/** Payload from card editor → persist to player + membership DBs. */
export type SquadPlayerEdit = {
  playerId: string;
  teamId: string;
  name: string;
  displayName: string;
  shirtNumber: number;
  primaryPosition: PositionCode;
  portraitAsset: string | null;
  heightCm: number | null;
  weightKg: number | null;
  stats: Partial<Record<EditStatKey, number | null>>;
};

export type PlayerCardTeamContext = {
  teamName: string;
  teamColor: string;
  teamSecondaryColor: string;
  team?: Pick<TeamRecord, "id" | "name" | "abbreviation" | "badgeAsset" | "primaryColor" | "secondaryColor"> | null;
};

export type PlayerCardRenderState = {
  editing: boolean;
  editDirty: boolean;
  flipped: boolean;
  /** Cumulative rotateY for side-aware flips (0 = front; odd×180 = back). */
  flipY?: number;
  profileView: ProfileStatsMode;
  /** Hex / radar size on the sports card front (default 172). */
  profileSize?: number;
  /** Draft / compact pick faces — portrait + kit only (no hex / bars). */
  hideProfile?: boolean;
  /** Pyramid draft: always allow headshot PNGs regardless of Display → Player PNGs. */
  forcePortrait?: boolean;
  imagePaths: string[];
};

export type PlayerCardFlipSide = "left" | "right";

/** Which half of the card was tapped (screen space). */
export function playerCardFlipSideFromClientX(card: HTMLElement, clientX: number): PlayerCardFlipSide {
  const rect = card.getBoundingClientRect();
  return clientX < rect.left + rect.width / 2 ? "left" : "right";
}

/** Tap left → −180°; tap right → +180° (clicked edge leads the turn). */
export function nextPlayerCardFlipY(currentY: number, side: PlayerCardFlipSide): number {
  return currentY + (side === "left" ? -180 : 180);
}

export function isPlayerCardShowingBack(flipY: number): boolean {
  return Math.abs(Math.round(flipY / 180)) % 2 === 1;
}

/** Apply rotateY + face attrs without remounting (keeps the CSS transition). */
export function applyPlayerCardFlip(card: HTMLElement, flipY: number): void {
  const back = isPlayerCardShowingBack(flipY);
  card.style.setProperty("--card-flip-y", `${flipY}deg`);
  card.classList.toggle("is-flipped", back);
  card.setAttribute("data-face", back ? "back" : "front");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Player-card header label:
 * - "Inter Milan — 1993/94" → "Inter Milan 93/94"
 * - "Italy — 1982" / "Portugal — 2016" → "Italy 1982" / "Portugal 2016"
 * - "Plymouth Argyle — FANS" → "Plymouth Argyle Fans"
 */
export function formatPlayerCardTeamName(name: string): string {
  let s = name.trim();
  if (!s) return s;
  // "Club — FANS" / "Club - Fans" → "Club Fans"
  s = s.replace(/\s*[—–-]\s*(Fans)\b/gi, " $1");
  // "Club — 1993/94 …" / "Club - 2004/05 Istanbul" → "Club 93/94 …"
  s = s.replace(/\s*[—–-]\s*(?=(?:19|20)\d{2}\/\d{2}\b)/g, " ");
  s = s.replace(/\b(?:19|20)(\d{2})\/(\d{2})\b/g, "$1/$2");
  // Single calendar year: keep the full year, drop the dash — "Italy — 1982" → "Italy 1982"
  s = s.replace(/\s*[—–-]\s*((?:19|20)\d{2})\b/g, " $1");
  // Title-case the Fans tag after a strip so it doesn't stay ALL CAPS.
  s = s.replace(/\bFANS\b/g, "Fans");
  return s.replace(/\s{2,}/g, " ").trim();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function kitSurname(name: string): string {
  return kitSurnameFromName(name);
}

function kitHeadingName(player: { displayName?: string; name?: string }): string {
  const raw = (player.displayName || player.name || "").trim();
  return kitSurname(raw) || raw || "PLAYER";
}

function portraitOptionsHtml(imagePaths: string[], current: string): string {
  const paths = [...imagePaths];
  if (current && !paths.includes(current)) paths.unshift(current);
  const opts = [`<option value="">(none)</option>`];
  for (const path of paths) {
    const selected = path === current ? " selected" : "";
    opts.push(`<option value="${escapeAttr(path)}"${selected}>${escapeHtml(imageLabel(path))}</option>`);
  }
  return opts.join("");
}

function actionBtnHtml(state: PlayerCardRenderState): string {
  if (state.editing && state.editDirty) {
    return `<button type="button" class="player-card-action primary" data-char="card-save"${titleAttr("Save player changes")}>SAVE</button>`;
  }
  if (state.editing) {
    return `<button type="button" class="player-card-action" data-char="card-view"${titleAttr("Back to player card")}>CARD</button>`;
  }
  return `<button type="button" class="player-card-action" data-char="card-edit"${titleAttr("Edit player details")}>EDIT</button>`;
}

function flipNavHtml(_sp: SquadPlayer): string {
  return `<div class="player-card-flip-nav" role="group" aria-label="Browse players">
    <button type="button" class="player-card-flip-btn" data-char="card-flip" data-dir="prev" aria-label="Previous player">‹</button>
    <span class="player-card-flip-spacer" aria-hidden="true"></span>
    <button type="button" class="player-card-flip-btn" data-char="card-flip" data-dir="next" aria-label="Next player">›</button>
  </div>`;
}

function crestHtml(team: PlayerCardTeamContext): string {
  const t = team.team;
  if (!t) {
    return `<div class="player-card-crest-fallback" style="background:${escapeAttr(team.teamColor)}"></div>`;
  }
  return teamBadgeHtml(
    {
      id: t.id,
      name: t.name ?? team.teamName,
      abbreviation: t.abbreviation,
      badgeAsset: t.badgeAsset,
      primaryColor: t.primaryColor ?? team.teamColor,
      secondaryColor: t.secondaryColor ?? team.teamSecondaryColor,
    },
    { className: "player-card-crest" },
  );
}

function photoHtml(
  sp: SquadPlayer,
  team: PlayerCardTeamContext,
  opts?: { forcePortrait?: boolean },
): string {
  const crestBlock = `<div class="player-card-photo has-crest"><div class="player-card-crest-host">${crestHtml(team)}</div></div>`;
  // Display → Player PNGs off (default): club emblem on the sports card.
  // Pyramid draft passes forcePortrait so its cards stay on headshots.
  if (!opts?.forcePortrait && !menuPlayerPngsEnabled()) return crestBlock;
  const src = portraitAsset(sp.player);
  if (src) {
    return `<div class="player-card-photo has-photo" data-crest-fallback="${escapeAttr(encodeURIComponent(crestBlock))}">
      <img class="player-card-portrait" alt="" src="${escapeAttr(src)}" referrerpolicy="no-referrer" onerror="const box=this.closest('.player-card-photo');const fb=box?.dataset.crestFallback;if(!box||!fb){this.remove();return;}box.outerHTML=decodeURIComponent(fb);"/>
    </div>`;
  }
  return crestBlock;
}

function shirtHtml(sp: SquadPlayer, team: PlayerCardTeamContext, className = "player-card-shirt"): string {
  const text = contrastingKitText(team.teamColor, team.teamSecondaryColor);
  const surname = kitSurname(sp.player.displayName || sp.player.name);
  const surSize = surnameFitPx(surname, className.includes("shirt-back") ? 20 : 28);
  const tracking = surnameLetterSpacingEm(surname);
  const nameStyle = `font-size:${surSize}px;letter-spacing:${tracking}em;margin-inline-end:-${tracking}em`;
  return `<div class="${className}" style="background:${escapeAttr(team.teamColor)};color:${escapeAttr(text)}">
    <span class="player-card-shirt-name" style="${nameStyle}">${escapeHtml(surname)}</span>
    <span class="player-card-shirt-num">${sp.shirtNumber}</span>
  </div>`;
}

function ratingsHtml(sp: SquadPlayer, editing: boolean): string {
  if (editing) {
    return EDIT_STAT_GROUPS.map((group) => {
      const fields = group.fields
        .map((field) => {
          const raw = sp.attrs[field.key];
          const stored = (sp.player as PlayerAttributes)[field.key];
          const value =
            field.optional && (stored === undefined || stored === null)
              ? ""
              : String(typeof raw === "number" ? raw : stored ?? "");
          const ph = field.optional ? ` placeholder="auto"` : "";
          return `<label class="player-card-stat">${field.label}<input data-edit-stat="${field.key}" type="number" min="1" max="100" value="${escapeAttr(value)}"${ph} /></label>`;
        })
        .join("");
      return `<div class="player-card-stat-group"><div class="player-card-stat-title">${group.title}</div><div class="player-card-stat-grid">${fields}</div></div>`;
    }).join("");
  }
  const spokes = listProfileAttrSpokes(sp.attrs);
  return `<div class="player-card-ratings">
    ${spokes
      .map(
        (s) =>
          `<div class="player-card-rating-row"><span>${escapeHtml(s.label)}</span><b>${s.value}</b><i style="width:${s.value}%"></i></div>`,
      )
      .join("")}
  </div>`;
}

/** NBA-style height: 6'8" (203 cm). */
export function formatCardHeight(heightCm?: number | null): string {
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm <= 0) return "";
  const totalIn = heightCm / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}" (${Math.round(heightCm)} cm)`;
}

/** NBA-style weight: 250 lb (113 kg). */
export function formatCardWeight(weightKg?: number | null): string {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return "";
  const lb = Math.round(weightKg * 2.2046226218);
  return `${lb} lb (${Math.round(weightKg)} kg)`;
}

/** Compact imperial height for card-back rows. */
export function formatCardHeightShort(heightCm?: number | null): string {
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm <= 0) return "";
  const totalIn = heightCm / 2.54;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}"`;
}

/** Compact imperial weight for card-back rows. */
export function formatCardWeightShort(weightKg?: number | null): string {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return "";
  return `${Math.round(weightKg * 2.2046226218)} lb`;
}

function bioRow(label: string, value: string): string {
  const shown = value.trim();
  if (!shown) return "";
  return `<div class="player-card-bio-row">
    <span class="player-card-bio-label">${escapeHtml(label)}</span>
    <span class="player-card-bio-value">${escapeHtml(shown)}</span>
  </div>`;
}

/** Compact bio strip for the card back (omit empty fields; ratings render separately). */
export function playerCardBackBioHtml(sp: SquadPlayer, team: PlayerCardTeamContext): string {
  const app = sp.player.appearance;
  const name =
    app?.fullName?.trim() || sp.player.displayName?.trim() || sp.player.name?.trim() || "";
  const teamLabel = formatPlayerCardTeamName(team.teamName) || team.teamName || "";
  const ht = formatCardHeightShort(sp.player.heightCm);
  const wt = formatCardWeightShort(sp.player.weightKg);
  const size = [ht, wt].filter(Boolean).join(" · ");
  const age =
    sp.player.age != null && Number.isFinite(sp.player.age) ? String(Math.round(sp.player.age)) : "";
  const secondaries = (sp.player.secondaryPositions ?? [])
    .filter((p) => p && p !== sp.player.primaryPosition)
    .join(" · ");

  const rows = [
    bioRow("Name", name),
    bioRow("Team", teamLabel),
    bioRow("Nickname", app?.nickname?.trim() || ""),
    bioRow("Ht / Wt", size),
    bioRow("College", app?.college?.trim() || ""),
    bioRow("Age", age),
    bioRow("Also Plays", secondaries),
  ].filter(Boolean);

  if (!rows.length) return "";
  return `<div class="player-card-bio">${rows.join("")}</div>`;
}

/** Bio strip + attribute bars for the sports-card back. */
export function playerCardBackBodyHtml(sp: SquadPlayer, team: PlayerCardTeamContext): string {
  return `${playerCardBackBioHtml(sp, team)}${ratingsHtml(sp, false)}`;
}

function sportsCardHtml(sp: SquadPlayer, team: PlayerCardTeamContext, state: PlayerCardRenderState): string {
  const flipY = state.flipY ?? (state.flipped ? 180 : 0);
  const flipped = isPlayerCardShowingBack(flipY);
  const teamLabel = formatPlayerCardTeamName(team.teamName) || "TEAM";
  return `<div class="player-card player-card-select${flipped ? " is-flipped" : ""}" data-char="card-face" data-face="${flipped ? "back" : "front"}" style="--card-accent:${escapeAttr(team.teamColor)};--card-flip-y:${flipY}deg"${titleAttr("Flip card")} role="button" tabindex="0">
    <div class="player-card-inner">
      <div class="player-card-face player-card-front">
        <div class="player-card-top">
          <em class="player-card-meta-label">POS</em>
          <span class="player-card-team">${escapeHtml(teamLabel)}</span>
          <em class="player-card-meta-label player-card-meta-label-end">OVR</em>
          <span class="player-card-pos-code">${escapeHtml(sp.player.primaryPosition)}</span>
          <span class="player-card-ovr-holo">${Math.round(sp.overall)}</span>
        </div>
        ${photoHtml(sp, team, { forcePortrait: state.forcePortrait })}
        ${
          state.hideProfile
            ? ""
            : profileStatsBlock(sp.attrs, { mode: state.profileView, size: state.profileSize ?? 148 })
        }
        ${shirtHtml(sp, team)}
      </div>
      <div class="player-card-face player-card-back">
        <div class="player-card-back-head">
          <div class="player-card-back-meta">
            <em class="player-card-meta-label">POS</em>
            <span class="player-card-pos-code">${escapeHtml(sp.player.primaryPosition)}</span>
          </div>
          ${shirtHtml(sp, team, "player-card-shirt player-card-shirt-back")}
          <div class="player-card-back-meta player-card-back-meta-end">
            <em class="player-card-meta-label player-card-meta-label-end">OVR</em>
            <span class="player-card-ovr-value">${Math.round(sp.overall)}</span>
          </div>
        </div>
        <div class="player-card-back-body">${playerCardBackBodyHtml(sp, team)}</div>
      </div>
    </div>
  </div>`;
}

function editPanelHtml(sp: SquadPlayer, team: PlayerCardTeamContext, imagePaths: string[]): string {
  const details = `<section class="player-card-edit-section">
    <h4 class="player-card-edit-section-title">Details</h4>
    <div class="player-card-edit-identity">
      <div class="player-card-edit-portrait-row">
        <div class="player-card-edit-portrait-preview">${photoHtml(sp, team)}</div>
        <div class="player-card-edit-portrait-controls">
          <label>PNG portrait
            <select data-edit-field="portraitAsset"${titleAttr("Portrait from images/")}>${portraitOptionsHtml(imagePaths, sp.player.appearance?.portraitAsset?.trim() || "")}</select>
          </label>
          <label class="portrait-upload-btn squad-edit-upload">Upload PNG
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-edit-upload hidden />
          </label>
        </div>
      </div>
      <label>Name <input data-edit-field="name" type="text" value="${escapeAttr(sp.player.name)}" /></label>
      <label>Display name <input data-edit-field="displayName" type="text" value="${escapeAttr(sp.player.displayName || sp.player.name)}" /></label>
      <div class="player-card-edit-row">
        <label>Shirt # <input data-edit-field="shirtNumber" type="number" min="1" max="99" value="${sp.shirtNumber}" /></label>
        <label>Position <select data-edit-field="primaryPosition">${EDIT_POSITIONS.map(
          (pos) =>
            `<option value="${pos}"${pos === sp.player.primaryPosition ? " selected" : ""}>${pos}</option>`,
        ).join("")}</select></label>
      </div>
      <div class="player-card-edit-row">
        <label>Height (cm) <input data-edit-field="heightCm" type="number" min="150" max="220" value="${sp.player.heightCm ?? ""}" placeholder="auto" /></label>
        <label>Weight (kg) <input data-edit-field="weightKg" type="number" min="50" max="120" value="${sp.player.weightKg ?? ""}" placeholder="auto" /></label>
      </div>
    </div>
  </section>`;
  const stats = `<section class="player-card-edit-section">
    <h4 class="player-card-edit-section-title">Statistics</h4>
    ${ratingsHtml(sp, true)}
  </section>`;
  return `<div class="player-card-edit-panel" style="--card-accent:${escapeAttr(team.teamColor)}">${details}${stats}</div>`;
}

/** Full card chrome: head (EDIT/CARD/SAVE) + body + arrow nav. */
export function playerCardShellHtml(
  sp: SquadPlayer,
  team: PlayerCardTeamContext,
  state: PlayerCardRenderState,
): string {
  const editing = state.editing;
  return `<div class="player-card-shell player-card-shell-${editing ? "edit" : "select"}${editing ? " is-editing" : ""}">
    <div class="player-card-shell-head">
      ${actionBtnHtml(state)}
    </div>
    ${editing ? editPanelHtml(sp, team, state.imagePaths) : sportsCardHtml(sp, team, state)}
    ${flipNavHtml(sp)}
  </div>`;
}

/** Read edit-form fields from a card host into a SquadPlayerEdit payload. */
export function readSquadPlayerEditFromHost(
  host: ParentNode,
  sp: SquadPlayer,
  teamId: string,
): SquadPlayerEdit {
  const read = (field: string): string => {
    const el = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-edit-field="${field}"]`);
    return el?.value?.trim() ?? "";
  };
  const numOrNull = (raw: string): number | null => {
    if (!raw) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const clampAttr = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  const posRaw = read("primaryPosition") as PositionCode;
  const primaryPosition = EDIT_POSITIONS.includes(posRaw) ? posRaw : sp.player.primaryPosition;
  const stats: SquadPlayerEdit["stats"] = {};
  for (const group of EDIT_STAT_GROUPS) {
    for (const field of group.fields) {
      const el = host.querySelector<HTMLInputElement>(`[data-edit-stat="${field.key}"]`);
      const raw = el?.value?.trim() ?? "";
      if (!raw) {
        if (field.optional) stats[field.key] = null;
        continue;
      }
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      stats[field.key] = clampAttr(v);
    }
  }
  const heightRaw = numOrNull(read("heightCm"));
  const weightRaw = numOrNull(read("weightKg"));
  return {
    playerId: sp.player.id,
    teamId,
    name: read("name") || sp.player.name,
    displayName: read("displayName") || read("name") || sp.player.displayName,
    shirtNumber: Math.max(1, Math.min(99, Math.round(numOrNull(read("shirtNumber")) ?? sp.shirtNumber))),
    primaryPosition,
    portraitAsset: read("portraitAsset") || null,
    heightCm: heightRaw === null ? null : Math.max(150, Math.min(220, Math.round(heightRaw))),
    weightKg: weightRaw === null ? null : Math.max(50, Math.min(120, Math.round(weightRaw))),
    stats,
  };
}

export { escapeAttr, escapeHtml, kitHeadingName };
