import { assetUrl } from "../core/assetUrl";
import { resolvePlayerPortraitUrl, resolveTeamCrestUrl } from "../data/AssetPack";
import { menuPlayerPngsEnabled } from "./menuPlayerPngs";

export interface PortraitSource {
  id?: string;
  name?: string;
  displayName?: string;
  appearance?: { portraitAsset?: string | null; fullBodyAsset?: string | null };
}

export interface PortraitFallback {
  kind: "badge";
  number: number;
  initials: string;
  color: string;
}

export interface KitMarkerOptions {
  /** Primary kit / badge fill. */
  primaryColor?: string;
  /** Number + surname text colour on the kit disc. */
  textColor?: string;
  /** Colour for the under-disc "12. SURNAME" caption (uniform on pitch/bench). */
  captionColor?: string;
  /** Extra class on the outer wrapper (e.g. bench sizing). */
  className?: string;
  /**
   * Disc fallback label under the shirt number.
   * Formation / roster use surname; match HUD uses initials (name lives beside the card).
   */
  badgeMode?: "surname" | "initials";
  /**
   * When true, always allow headshot PNGs (Pyramid).
   * Otherwise respects Options → Display → Player PNGs (default off → jersey badge).
   */
  forcePortrait?: boolean;
}

/**
 * Known portrait URL only (explicit appearance path).
 * Do not speculative-resolve convention `/assets/players/{id}.png` here — missing files
 * would flash number/name under the formation disc until img.onerror.
 */
export function portraitAsset(player: PortraitSource | undefined): string | null {
  const explicit = player?.appearance?.portraitAsset;
  if (explicit && typeof explicit === "string" && explicit.trim()) return assetUrl(explicit.trim());
  return null;
}

/** Team crest / emblem URL from TeamRecord.badgeAsset (asset pack or explicit). */
export function teamBadgeAsset(team: { id?: string; badgeAsset?: string | null } | undefined): string | null {
  const explicit = team?.badgeAsset;
  if (explicit && typeof explicit === "string" && explicit.trim()) return assetUrl(explicit.trim());
  if (team?.id) return resolveTeamCrestUrl(team.id, null);
  return null;
}

/**
 * HTML for a club crest. Falls back to abbreviation initials in club colours.
 */
export function teamBadgeHtml(
  team: { id?: string; name?: string; abbreviation?: string; badgeAsset?: string | null; primaryColor?: string; secondaryColor?: string },
  options?: { className?: string; size?: number },
): string {
  const cls = ["team-badge", options?.className].filter(Boolean).join(" ");
  const primary = team.primaryColor || "#333333";
  const secondary = team.secondaryColor || "#ffffff";
  const label = (team.abbreviation || team.name || "?").slice(0, 3).toUpperCase();
  const src = teamBadgeAsset(team);
  const size = options?.size ? `width:${options.size}px;height:${options.size}px;` : "";
  const fallback = `<span class="team-badge-fallback" style="background:${escapePortrait(primary)};color:${escapePortrait(secondary)}">${escapePortrait(label)}</span>`;
  if (!src) return `<div class="${cls}" style="${size}">${fallback}</div>`;
  return `<div class="${cls}" style="${size}"><img alt="" src="${escapePortrait(src)}" onerror="this.style.display='none';const fb=this.nextElementSibling;if(fb){fb.hidden=false;fb.classList.remove('is-hidden')}"/><span class="team-badge-fallback is-hidden" hidden style="background:${escapePortrait(primary)};color:${escapePortrait(secondary)}">${escapePortrait(label)}</span></div>`;
}

export function playerInitials(name: string): string {
  const parts = name.replace(/\./g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function portraitFallback(name: string, shirtNumber: number, color = "#007A3D"): PortraitFallback {
  return { kind: "badge", number: shirtNumber, initials: playerInitials(name), color };
}

/**
 * Particles that belong with the following surname token(s) on a kit
 * ("van der Sar", "Del Piero", "de Boer", "Di Livio", …).
 */
const SURNAME_PARTICLES = new Set([
  "van",
  "von",
  "der",
  "den",
  "de",
  "da",
  "das",
  "dos",
  "do",
  "del",
  "della",
  "delle",
  "dei",
  "degli",
  "di",
  "du",
  "des",
  "la",
  "le",
  "les",
  "lo",
  "los",
  "las",
  "ter",
  "ten",
  "te",
  "op",
  "aan",
  "af",
  "av",
  "zu",
  "zum",
  "zur",
  "vom",
  "y",
  "al",
  "el",
  "bin",
  "ibn",
  "bint",
  "ben",
  "st",
  "saint",
  "san",
]);

/**
 * Particles that are also common Western given names. When they lead the name
 * ("Ben Wallace", "Al Horford") they are the given name — not part of the surname.
 * Mid-name uses stay particles ("Osama bin Laden" → BIN LADEN).
 */
const LEADING_GIVEN_PARTICLES = new Set(["ben", "al", "el", "la", "le"]);

function isSurnameParticle(token: string): boolean {
  return SURNAME_PARTICLES.has(token.toLowerCase().replace(/['’]/g, ""));
}

function isLeadingGivenParticle(token: string): boolean {
  return LEADING_GIVEN_PARTICLES.has(token.toLowerCase().replace(/['’]/g, ""));
}

/** Generational suffixes that must not become the kit surname (Jr, Sr, III, …). */
const NAME_SUFFIXES = new Set([
  "jr",
  "junior",
  "sr",
  "senior",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "2nd",
  "3rd",
  "4th",
  "5th",
]);

function isNameSuffix(token: string): boolean {
  return NAME_SUFFIXES.has(token.toLowerCase().replace(/[.,]/g, ""));
}

/** Drop trailing Jr / Sr / III (and dotted forms) before surname extraction. */
function stripNameSuffixes(parts: string[]): string[] {
  const out = [...parts];
  while (out.length > 1 && isNameSuffix(out[out.length - 1]!)) out.pop();
  return out;
}

/**
 * Kit / badge surname: keep multi-word surnames with particles
 * (Van Der Sar, Del Piero) instead of only the final token.
 */
export function kitSurnameFromName(name: string): string {
  const parts = name.replace(/\./g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PLAYER";
  // Drop leading single-letter initials ("F. de Boer", "M. Cooper").
  let start = 0;
  while (start < parts.length - 1 && /^[A-Za-z]$/.test(parts[start]!)) start += 1;
  const tokens = stripNameSuffixes(parts.slice(start));
  if (!tokens.length) return "PLAYER";
  if (tokens.length === 1) return tokens[0]!.toUpperCase();
  // Fan / club monikers ending in a short acronym ("Argyle USA", "City AFC").
  const last = tokens[tokens.length - 1]!;
  if (tokens.length >= 2 && /^[A-Z]{2,4}$/.test(last) && !isSurnameParticle(tokens[0]!)) {
    return tokens.join(" ").toUpperCase();
  }
  // From the end: include the final word plus any preceding particles.
  let i = tokens.length - 1;
  while (i > 0 && isSurnameParticle(tokens[i - 1]!)) {
    // "Ben Wallace" / "Al Horford": leading token is the given name, not a particle.
    if (i - 1 === 0 && isLeadingGivenParticle(tokens[0]!)) break;
    i -= 1;
  }
  return tokens.slice(i).join(" ").toUpperCase();
}

/** First given-name initial when a full name is available (e.g. Edwin → E). */
export function kitGivenInitial(displayName: string | undefined, fullName?: string | undefined): string | null {
  const surname = kitSurnameFromName(displayName || fullName || "");
  const source = (fullName || displayName || "").replace(/\./g, " ").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const surCount = surname.split(/\s+/).length;
  for (let i = 0; i <= parts.length - surCount; i++) {
    const slice = parts
      .slice(i, i + surCount)
      .join(" ")
      .toUpperCase();
    if (slice !== surname) continue;
    if (i === 0) return null;
    const given = parts[i - 1]!;
    if (isSurnameParticle(given) || given.length < 1) return null;
    if (/^[A-Za-z]/.test(given)) return given[0]!.toUpperCase();
    return null;
  }
  const first = parts[0]!;
  if (!isSurnameParticle(first) && first.toUpperCase() !== surname && /^[A-Za-z]/.test(first) && first.length > 1) {
    return first[0]!.toUpperCase();
  }
  return null;
}

/** Under-photo caption name: surname only (`VAN DER SAR`) — number sits beside it. */
export function kitCaptionSurname(displayName: string | undefined, fullName?: string | undefined): string {
  return kitSurnameFromName(displayName || fullName || "?");
}

/**
 * Short kit label for roster / detail headings: given initial + surname
 * (`R. HARDIE`, `E. VAN DER SAR`) — never the full first name.
 */
export function kitInitialSurnameLabel(displayName: string | undefined, fullName?: string | undefined): string {
  const surname = kitSurnameFromName(displayName || fullName || "?");
  const initial = kitGivenInitial(displayName, fullName);
  return initial ? `${initial}. ${surname}` : surname;
}

/** Starting kit surname size — stay near `base`; only nudge down for very long labels. */
export function surnameFitPx(surname: string, base: number): number {
  const len = surname.replace(/[\s-]/g, "").length;
  if (len <= 10) return base;
  if (len <= 12) return Math.round(base * 0.9); // ANTETOKOUMPO-class
  if (len <= 14) return Math.round(base * 0.8);
  return Math.round(base * 0.7);
}

/** Letter-spacing: short names open up to fill width; long names stay tight. */
export function surnameLetterSpacingEm(surname: string): number {
  const len = surname.replace(/[\s-]/g, "").length;
  if (len <= 4) return 0.16; // BIRD grows sideways before it grows tall
  if (len <= 6) return 0.1;
  if (len <= 8) return 0.06;
  if (len <= 10) return 0.02;
  return 0;
}

/**
 * How much of the kit width a surname should aim to fill.
 * BIRD grows into the band; ceiling (not a tiny fill) stops over-growth.
 */
function surnameFillRatio(label: string): number {
  const len = label.replace(/[\s-]/g, "").length;
  if (len <= 3) return 0.52;
  if (len <= 4) return 0.58; // BIRD — grow, ceiling caps height
  if (len <= 5) return 0.72; // JAMES
  if (len <= 6) return 0.82; // JORDAN
  if (len <= 8) return 0.9;
  if (len <= 10) return 0.95;
  return 0.98;
}

/** Max font size from the kit's fixed name band (keeps glyphs inside the name slot). */
function kitNameBandCeilingPx(host: HTMLElement | null, fallback: number): number {
  if (!host) return fallback;
  const raw = getComputedStyle(host).getPropertyValue("--kit-name-band").trim();
  const band = parseFloat(raw);
  if (!(band > 0)) return fallback;
  // Leave a little air in the band so name never collides with the number gap.
  return Math.max(10, Math.round(band * 0.9));
}

/**
 * Fit a kit surname into `maxW` px of content width.
 * Grow toward a length-aware fill target; never past ceiling or panel width.
 * Ceiling is the over-grow brake (especially for BIRD) — names still grow up to it.
 * When `lockTypeSize` is set (under-counter captions), keep the start size and only
 * shrink for real overflow — short names must not drop below the shared number size.
 */
function fitSurnameToWidth(
  el: HTMLElement,
  maxW: number,
  opts: {
    startPx: number;
    floorPx: number;
    trackingEm: number;
    ceilingPx?: number;
    label?: string;
    lockTypeSize?: boolean;
  },
): void {
  if (maxW < 8) return;
  const label = opts.label ?? (el.textContent || "").trim();
  const ceiling = opts.ceilingPx ?? Math.max(opts.startPx, opts.startPx * 1.25);
  const softFloor = opts.floorPx;
  const hardFloor = Math.min(softFloor, 6);
  const lockType = !!opts.lockTypeSize;

  el.style.overflow = "visible";
  el.style.textOverflow = "clip";
  el.style.whiteSpace = "nowrap";
  el.style.minWidth = "0";
  el.style.lineHeight = "1";
  // Flex hosts break scrollWidth — measure as a shrink-wrapped block.
  el.style.display = "block";
  // Intrinsic measure — `width:100%` makes scrollWidth===box so sizing can't work.
  el.style.width = "max-content";
  el.style.maxWidth = "none";
  el.style.transform = "";

  // Start from a modest size so short names visibly grow toward the ceiling.
  let size = Math.min(opts.startPx, ceiling);
  let tracking = opts.trackingEm;
  const apply = () => {
    el.style.fontSize = `${size}px`;
    el.style.letterSpacing = `${tracking}em`;
    el.style.marginInlineEnd = tracking > 0 ? `-${tracking}em` : "";
  };
  apply();
  const textW = () => el.scrollWidth;

  let guard = 0;
  if (!lockType) {
    const fill = surnameFillRatio(label);
    const targetW = Math.max(20, maxW * fill);
    // Grow toward fill target (never past ceiling or maxW).
    while (textW() < targetW - 0.5 && size < ceiling && textW() < maxW - 0.5 && guard < 120) {
      size += 0.5;
      apply();
      guard += 1;
    }
    // If start was already over the fill target, ease back — but never below a grown soft floor
    // that still leaves short names larger than the CSS floor.
    while (textW() > targetW + 0.5 && size > softFloor && size > ceiling * 0.85 && guard < 200) {
      size -= 0.5;
      apply();
      guard += 1;
    }
  }
  // Panel overflow always wins — tracking first, then size (past soft floor if needed).
  while (textW() > maxW + 0.5 && tracking > 0 && guard < 260) {
    tracking = Math.max(0, tracking - 0.015);
    apply();
    guard += 1;
  }
  while (textW() > maxW + 0.5 && size > hardFloor && guard < 400) {
    size -= 0.5;
    apply();
    guard += 1;
  }
  // Last resort: scaleX, then lock back into the fixed name band.
  if (textW() > maxW + 0.5 && textW() > 0) {
    const scale = Math.max(0.35, maxW / textW());
    el.style.transform = `scaleX(${scale.toFixed(3)})`;
    el.style.transformOrigin = "center center";
  }
  // Cap to the measured band — max-content + maxWidth:100% can still spill past a
  // centred flex kit when the surname's intrinsic width exceeds the badge.
  el.style.width = "max-content";
  el.style.maxWidth = `${Math.max(8, Math.floor(maxW))}px`;
  el.style.overflow = "hidden";
}

/** Content-box width available for a surname node (accounts for its own padding). */
function surnameContentMaxW(el: HTMLElement, fallbackHost: HTMLElement | null, padFallback = 6): number {
  const cs = getComputedStyle(el);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const padX = padL + padR > 0 ? padL + padR : padFallback * 2;
  // Host is authoritative. A shrink-wrapped surname's clientWidth is the glyph run —
  // Math.max(self, host) would treat overflow as "already fits" and skip shrinking.
  const hostW = fallbackHost?.clientWidth || 0;
  const box = hostW > 0 ? hostW : el.clientWidth || 88;
  return Math.max(28, box - padX);
}

/**
 * Shrink kit surnames in-place until they fit their marker — never ellipsize with "…".
 * Uses the full marker width for names under the disc; keeps a readable floor.
 */
/**
 * Sports-card kit panel surname above the number — shrink to the shirt width.
 */
export function fitPlayerCardShirtNames(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(".player-card-shirt-name");
  for (const el of nodes) {
    const shirt = el.closest<HTMLElement>(".player-card-shirt");
    const back = !!shirt?.classList.contains("player-card-shirt-back");
    const maxW = surnameContentMaxW(el, shirt, 9);
    const label = (el.textContent || "").trim();
    // Surname stays clearly smaller than the shirt number (kit-back hierarchy).
    const base = back ? 14 : 14;
    const len = label.replace(/[\s-]/g, "").length;
    const numEl = shirt?.querySelector<HTMLElement>(".player-card-shirt-num");
    const numPx = numEl ? parseFloat(getComputedStyle(numEl).fontSize) || (back ? 24 : 34) : back ? 24 : 34;
    const vsNum = len <= 4 ? 0.38 : len <= 6 ? 0.42 : len <= 8 ? 0.46 : 0.5;
    const bandCap = kitNameBandCeilingPx(shirt, back ? 14 : 16);
    fitSurnameToWidth(el, maxW, {
      label,
      startPx: surnameFitPx(label, base),
      floorPx: len >= 12 ? 8 : 10,
      trackingEm: surnameLetterSpacingEm(label),
      ceilingPx: Math.min(back ? 16 : 18, bandCap, Math.round(numPx * vsNum)),
    });
  }
}

export function fitKitSurnameElements(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(
    ".portrait-badge-kit .sur, .kit-marker-caption .kit-marker-name, .pitch-name",
  );
  for (const el of nodes) {
    const caption = el.closest<HTMLElement>(".kit-marker-caption");
    const marker = el.closest<HTMLElement>(".kit-marker");
    const host =
      caption ??
      el.closest<HTMLElement>(".portrait-badge-kit, .pitch-kit") ??
      el.parentElement;
    const rosterSur = !!el.closest(".kit-marker-roster");
    const pyramidSur = !!el.closest(".pyramid-kit-badge");
    const benchCaption = !!el.closest(".kit-marker-bench");
    // Formation top-left kit: measure the jersey badge (name band), not the outer
    // portrait chrome — using the frame over-estimates width and lets long names spill.
    const widthHost = host;
    const markerW = marker?.clientWidth || widthHost?.clientWidth || 52;
    const numEl = caption?.querySelector<HTMLElement>(".kit-marker-num");
    const numW = numEl ? numEl.getBoundingClientRect().width + 6 : 0;
    const maxW = caption
      ? Math.max(36, Math.min(108, (caption.clientWidth || markerW || 112) - numW) - 4)
      : surnameContentMaxW(el, widthHost, rosterSur ? 6 : 5);
    if (maxW < 8) continue;
    const label = (el.textContent || "").trim();
    const len = label.replace(/[\s-]/g, "").length;
    const cssSize = parseFloat(getComputedStyle(el).fontSize) || 18;
    const base = pyramidSur
      ? Math.max(cssSize, 9)
      : rosterSur
        ? Math.max(cssSize, len >= 10 ? 22 : 28)
        : caption
          ? cssSize
          : Math.max(cssSize, 16);
    const captionNumPx = numEl ? parseFloat(getComputedStyle(numEl).fontSize) || (benchCaption ? 14 : 17) : benchCaption ? 14 : 17;
    const kitNumEl = host?.querySelector<HTMLElement>(".num");
    const numPx = caption
      ? captionNumPx
      : kitNumEl
        ? parseFloat(getComputedStyle(kitNumEl).fontSize) || (rosterSur ? 64 : 22)
        : rosterSur
          ? 64
          : 22;
    // Keep surname clearly below the number; band ceiling stops over-grow.
    // Under-counter captions share one type size with the number — only shrink for overflow.
    const vsNum = caption
      ? 1
      : len <= 4
        ? 0.42
        : len <= 6
          ? 0.48
          : len <= 8
            ? 0.55
            : 0.6;
    const bandHost = el.closest<HTMLElement>(".portrait-badge-kit, .player-card-shirt") ?? host;
    const bandCap = kitNameBandCeilingPx(bandHost, pyramidSur ? 10 : rosterSur ? 26 : 18);
    // Caption type = number size (CSS --caption-type); do not ease short names down via fill ratio.
    const captionTypePx = caption ? Math.max(cssSize, captionNumPx) : cssSize;
    fitSurnameToWidth(el, maxW, {
      label,
      startPx: caption ? captionTypePx : surnameFitPx(label, base),
      floorPx: caption
        ? benchCaption
          ? 7
          : 8
        : pyramidSur
          ? len >= 12
            ? 6
            : 7
          : rosterSur
            ? len >= 14
              ? 6
              : len >= 10
                ? 8
                : len >= 8
                  ? 10
                  : 14
            : 11,
      trackingEm: caption ? Math.min(0.04, surnameLetterSpacingEm(label)) : surnameLetterSpacingEm(label),
      ceilingPx: pyramidSur
        ? Math.min(10, bandCap)
        : rosterSur
          ? Math.min(len >= 10 ? 24 : 30, bandCap, Math.round(numPx * vsNum))
          : caption
            ? captionTypePx
            : Math.min(28, bandCap, Math.round(numPx * Math.max(vsNum, 0.72))),
      lockTypeSize: !!caption,
    });
  }
  fitRosterHeadingElements(root);
  fitRosterNameElements(root);
  fitPlayerCardTeamNames(root);
  fitPlayerCardShirtNames(root);
}

/**
 * Player-card front team name — shrink to the middle header column (no ellipsis).
 */
export function fitPlayerCardTeamNames(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(".player-card-team");
  for (const el of nodes) {
    const maxW = el.clientWidth;
    if (maxW < 8) continue;
    const draftCard = !!el.closest(".pyramid-draft-card");
    el.style.overflow = "hidden";
    el.style.textOverflow = "clip";
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "";
    el.style.letterSpacing = "";
    let size = parseFloat(getComputedStyle(el).fontSize) || (draftCard ? 12 : 24);
    let tracking = draftCard ? 0.05 : 0.1;
    const floor = draftCard ? 8 : 11;
    el.style.fontSize = `${size}px`;
    el.style.letterSpacing = `${tracking}em`;
    el.style.marginInlineEnd = `-${tracking}em`;
    let guard = 0;
    const over = () => el.scrollWidth > maxW + 0.5;
    while (over() && size > floor && guard < 48) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    while (over() && tracking > 0.02 && guard < 72) {
      tracking = Math.max(0.02, tracking - 0.01);
      el.style.letterSpacing = `${tracking}em`;
      el.style.marginInlineEnd = `-${tracking}em`;
      guard += 1;
    }
  }
}

/**
 * Squad-list surnames — shrink to the row name column instead of ellipsis.
 */
export function fitRosterNameElements(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(".roster-row .roster-name");
  for (const el of nodes) {
    const maxW = el.clientWidth;
    if (maxW < 8) continue;
    el.style.overflow = "hidden";
    el.style.textOverflow = "clip";
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "";
    el.style.letterSpacing = "";
    let size = parseFloat(getComputedStyle(el).fontSize) || 11;
    let tracking = 0.05;
    const floor = 7.5;
    el.style.fontSize = `${size}px`;
    el.style.letterSpacing = `${tracking}em`;
    let guard = 0;
    const over = () => el.scrollWidth > maxW + 0.5;
    while (over() && size > floor && guard < 40) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    while (over() && tracking > 0.01 && guard < 64) {
      tracking = Math.max(0.01, tracking - 0.01);
      el.style.letterSpacing = `${tracking}em`;
      guard += 1;
    }
  }
}

/**
 * Formation top-left `12. R. HARDIE` — use the card line width; shrink only when needed.
 */
export function fitRosterHeadingElements(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>(".team-roster-card h3");
  for (const el of nodes) {
    const card = el.closest<HTMLElement>(".team-roster-card");
    const maxW = Math.max(64, (card?.clientWidth ?? el.clientWidth ?? 168) - 8);
    if (maxW < 8) continue;
    el.style.overflow = "hidden";
    el.style.textOverflow = "clip";
    el.style.whiteSpace = "nowrap";
    el.style.fontSize = "";
    el.style.letterSpacing = "";
    // Prefer a large face that fills the line; only step down when it overflows.
    let size = 26;
    let tracking = 0.04;
    const floor = 13;
    el.style.fontSize = `${size}px`;
    el.style.letterSpacing = `${tracking}em`;
    let guard = 0;
    const over = () => el.scrollWidth > maxW + 0.5;
    while (over() && size > floor && guard < 48) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    while (over() && tracking > 0 && guard < 72) {
      tracking = Math.max(0, tracking - 0.01);
      el.style.letterSpacing = `${tracking}em`;
      guard += 1;
    }
  }
}

/**
 * Formation / substitute marker: circle badge with number above surname,
 * or PNG disc with number + surname under the image (only after the PNG loads).
 */
export function kitMarkerHtml(
  player: PortraitSource,
  shirtNumber: number,
  options: KitMarkerOptions = {},
): string {
  const primary = options.primaryColor ?? "#007A3D";
  const text = options.textColor ?? "#ffffff";
  const wrapClass = ["kit-marker", options.className].filter(Boolean).join(" ");
  const label = player.displayName ?? player.name ?? "?";
  const surname = kitSurnameFromName(label);
  const initials = playerInitials(label);
  const badgeMode = options.badgeMode ?? "surname";
  // Caption under PNG: number + surname only (no given-name initial).
  const captionLabel = kitCaptionSurname(player.displayName, player.name);
  // Trusted = explicit appearance path. Speculative convention paths only promote on load.
  // Display → Player PNGs off (default): jersey name/number badge only — Pyramid opts in via forcePortrait.
  const allowPng = options.forcePortrait === true || menuPlayerPngsEnabled();
  const trustedSrc = allowPng ? portraitAsset(player) : null;
  const speculativeSrc =
    allowPng && !trustedSrc && player.id ? resolvePlayerPortraitUrl(player.id, null) : null;
  const src = trustedSrc ?? speculativeSrc;
  const bench = (options.className ?? "").includes("kit-marker-bench");
  const roster = (options.className ?? "").includes("kit-marker-roster");
  // Roster square (no PNG): kit-back — smaller surname above a large number.
  const surSize = surnameFitPx(surname, roster ? 32 : bench ? 15 : 17);
  const tracking = surnameLetterSpacingEm(surname);
  // Captions share type size with the number — keep tracking tight (no short-name spread).
  const captionTracking = Math.min(0.04, surnameLetterSpacingEm(captionLabel));
  const nameStyle = `letter-spacing:${captionTracking}em;margin-inline-end:-${captionTracking}em`;
  const surStyle = `font-size:${surSize}px;letter-spacing:${tracking}em;margin-inline-end:-${tracking}em`;
  // Under PNG: "12. SURNAME". Disc badge (no PNG): surname (formation) or initials (match HUD).
  // Caption colour is uniform (not per-kit) so pitch + bench labels stay consistent.
  const captionColor = options.captionColor ?? "#f2f4f0";
  const caption = `<div class="kit-marker-caption" style="color:${escapePortrait(captionColor)}"><span class="kit-marker-num">${shirtNumber}.</span><span class="kit-marker-name" style="${nameStyle}">${escapePortrait(captionLabel.trim())}</span></div>`;
  const badgeLabel =
    badgeMode === "initials"
      ? `<span class="ini">${escapePortrait(initials)}</span>`
      : `<span class="sur" style="${surStyle}">${escapePortrait(surname.trim())}</span>`;
  const numSpan = `<span class="num">${shirtNumber}</span>`;
  // Top-left formation card only: surname above number. Pitch / bench / HUD keep number first.
  const badgeInner = roster ? `${badgeLabel}${numSpan}` : `${numSpan}${badgeLabel}`;
  const badge = `<div class="portrait-badge portrait-badge-kit" style="background:${escapePortrait(primary)};color:${escapePortrait(text)}">${badgeInner}</div>`;
  const badgeHidden = `<div class="portrait-badge portrait-badge-kit" hidden style="background:${escapePortrait(primary)};color:${escapePortrait(text)}">${badgeInner}</div>`;

  // Team tint for Pyramid-style PNG disc ring + radial fill (formation pitch/bench).
  const discTint = `style="--pyramid-tint:${escapePortrait(primary)}"`;

  if (!src) {
    return `<div class="${wrapClass}"><div class="portrait">${badge}</div></div>`;
  }

  // Photo markers: PNG in a framed box + caption under only (never number/name on the image).
  const onLoad =
    "const m=this.closest('.kit-marker');if(!m)return;m.classList.add('kit-marker-photo');this.style.display='block';const b=this.nextElementSibling;if(b)b.hidden=true;";
  const onError =
    "const m=this.closest('.kit-marker');if(!m)return;m.classList.remove('kit-marker-photo');this.style.display='none';const b=this.nextElementSibling;if(b)b.hidden=false;const c=m.querySelector('.kit-marker-caption');if(c)c.remove();";

  if (trustedSrc) {
    return `<div class="${wrapClass} kit-marker-photo"><div class="portrait" ${discTint}><img alt="" src="${escapePortrait(trustedSrc)}" onerror="${onError}"/>${badgeHidden}</div>${caption}</div>`;
  }

  // Speculative path: start as in-disc badge; promote to photo+under-caption only onload.
  return `<div class="${wrapClass}"><div class="portrait" ${discTint}><img alt="" src="${escapePortrait(src)}" style="display:none" onload="${onLoad}" onerror="${onError}"/>${badge}</div>${caption}</div>`;
}

export function portraitHtml(
  player: PortraitSource,
  shirtNumber: number,
  color = "#007A3D",
  options?: {
    surnameOnly?: boolean;
    textColor?: string;
    className?: string;
    badgeMode?: "surname" | "initials";
    /** Pyramid: always allow headshots. */
    forcePortrait?: boolean;
  },
): string {
  if (options?.surnameOnly || (!options?.forcePortrait && !menuPlayerPngsEnabled())) {
    return kitMarkerHtml(player, shirtNumber, {
      primaryColor: color,
      textColor: options.textColor ?? "#ffffff",
      className: options.className,
      badgeMode: options.badgeMode,
      forcePortrait: options?.forcePortrait,
    });
  }
  const src = portraitAsset(player);
  const label = player.displayName ?? player.name ?? "?";
  const fb = portraitFallback(label, shirtNumber, color);
  const surname = kitSurnameFromName(label);
  const surSize = surnameFitPx(surname, 11);
  const tracking = surnameLetterSpacingEm(surname);
  const text = options?.textColor?.trim() || "#ffffff";
  const badgeMode = options?.badgeMode ?? "surname";
  const badgeInner =
    badgeMode === "initials"
      ? `<span class="num">${fb.number}</span><span class="ini">${escapePortrait(fb.initials)}</span>`
      : `<span class="num">${fb.number}</span><span class="sur" style="font-size:${surSize}px;letter-spacing:${tracking}em">${escapePortrait(surname)}</span>`;
  const badge = `<div class="portrait-badge" style="background:${fb.color};color:${escapePortrait(text)}">${badgeInner}</div>`;
  if (!src) return `<div class="portrait">${badge}</div>`;
  return `<div class="portrait"><img alt="" src="${src}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.hidden=false"/><div class="portrait-badge" hidden style="background:${fb.color};color:${escapePortrait(text)}">${badgeInner}</div></div>`;
}

function escapePortrait(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
