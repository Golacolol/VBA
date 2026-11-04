/** Foil pack open + lightweight confetti (no deps). Gold 80–89, diamond 90–94, purple 95+, black = top 3. */

import { assetUrl } from "../core/assetUrl";
import type { GameDatabase } from "../core/Database";
import { MITEAM_TEAM_ID } from "../core/SaveManager";
import { playerIdentityKey } from "../football/miteam/MiTeamPool";
import { portraitAsset, teamBadgeAsset } from "./Portrait";
import type { SquadPlayer } from "../core/Database";

export type PackPhase = "foil" | "opening" | "revealed";
export type PackTier = "silver" | "gold" | "diamond" | "purple" | "black";

/** Sealed gold foil — strong pulls 80–89. */
export const MITEAM_GOLD_OVR = 80;
/** Sealed diamond foil — elite pulls 90–94. */
export const MITEAM_DIAMOND_OVR = 90;
/** Sealed purple foil — legends 95+ (except black top-N). */
export const MITEAM_PURPLE_OVR = 95;
/** Absolute apex — black/gold foil for the N highest overall cards. */
export const MITEAM_BLACK_TOP_N = 3;

function preloadImage(url: string | null | undefined): Promise<void> {
  const src = url?.trim();
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = assetUrl(src);
  });
}

/** Warm portrait + crest so the reveal card is painted before the foil opens. */
export function preloadMiTeamRevealAssets(
  sp: SquadPlayer,
  team: { id?: string; badgeAsset?: string | null },
): Promise<void> {
  return Promise.all([preloadImage(portraitAsset(sp.player)), preloadImage(teamBadgeAsset(team))]).then(
    () => undefined,
  );
}

/** Wait until <img> nodes under `root` have loaded (or failed / timed out). */
export function waitForElementImages(root: ParentNode | null, timeoutMs = 1400): Promise<void> {
  if (!root) return Promise.resolve();
  const imgs = [...root.querySelectorAll("img")];
  if (!imgs.length) return Promise.resolve();
  const loaded = Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  ).then(() => undefined);
  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
  return Promise.race([loaded, timeout]);
}

/**
 * Identity keys for the N highest overall cards in the DB (deduped by person).
 * Used so black foil tracks the live apex, not a hard-coded OVR cutoff.
 */
export function blackPackIdentityKeys(
  db: GameDatabase,
  n = MITEAM_BLACK_TOP_N,
): Set<string> {
  const best = new Map<string, number>();
  for (const team of db.teams.values()) {
    if (team.id === MITEAM_TEAM_ID) continue;
    for (const sp of db.getSquad(team.id)) {
      const key = playerIdentityKey(sp.player);
      const prev = best.get(key);
      if (prev === undefined || sp.overall > prev) best.set(key, sp.overall);
    }
  }
  return new Set(
    [...best.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, Math.max(0, n))
      .map(([key]) => key),
  );
}

export function packTierForOverall(
  overall: number,
  opts?: { black?: boolean },
): PackTier {
  if (opts?.black) return "black";
  if (overall >= MITEAM_PURPLE_OVR) return "purple";
  if (overall >= MITEAM_DIAMOND_OVR) return "diamond";
  if (overall >= MITEAM_GOLD_OVR) return "gold";
  return "silver";
}

/**
 * Zigzag tear edges on top and bottom only — left/right stay straight so the long
 * sides read as foil wrapping around the pack. Notches are deep enough to reveal
 * the card peek layer sitting behind the foil.
 */
/** Tear tooth depth as % of pack height — keep in sync with --foil-tooth in CSS. */
export const MITEAM_FOIL_TOOTH_PCT = 2.8;

export function miteamFoilSerrationClip(): string {
  const step = 2.5;
  // Shallow teeth on the shorter pack; lip/tear CSS starts just inside this depth.
  const depth = MITEAM_FOIL_TOOTH_PCT;
  const pts: string[] = [];
  const push = (x: number, y: number) => pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  // Serrated tear strip across the top (L→R), always ending at x=100.
  for (let i = 0; ; i++) {
    const x = Math.min(100, i * step);
    push(x, i % 2 === 0 ? 0 : depth);
    if (x >= 100) break;
  }
  // Serrated tear strip across the bottom (R→L). Sides stay a single vertical edge.
  for (let i = 0; ; i++) {
    const x = Math.max(0, 100 - i * step);
    push(x, i % 2 === 0 ? 100 : 100 - depth);
    if (x <= 0) break;
  }
  return `polygon(${pts.join(", ")})`;
}

const FOIL_LABEL: Record<PackTier, string> = {
  silver: "SILVER PACK",
  gold: "GOLD PACK",
  diamond: "DIAMOND PACK",
  purple: "PURPLE PACK",
  black: "BLACK PACK",
};

const FOIL_ARIA: Record<PackTier, string> = {
  silver: "Open silver pack (Space). Press B to skip for another sealed pack",
  gold: "Open gold pack (Space). Press B to skip for another sealed pack",
  diamond: "Open diamond pack (Space). Press B to skip for another sealed pack",
  purple: "Open purple pack (Space). Press B to skip for another sealed pack",
  black: "Open black pack (Space). Press B to skip for another sealed pack",
};

export function miteamFoilHtml(tier: PackTier = "silver"): string {
  const label = FOIL_LABEL[tier];
  const aria = FOIL_ARIA[tier];
  const clip = miteamFoilSerrationClip();
  return `
    <span class="miteam-foil-shell miteam-foil-shell-${tier}">
      <span class="miteam-foil-well" aria-hidden="true"></span>
      <span class="miteam-foil-card-peek" aria-hidden="true">
        <span class="miteam-foil-card-face"></span>
        <span class="miteam-foil-card-rim"></span>
      </span>
      <button type="button" class="miteam-foil miteam-foil-${tier}" data-miteam="open-pack" data-tier="${tier}" aria-label="${aria}" style="clip-path:${clip}; -webkit-clip-path:${clip}">
        <span class="miteam-foil-base" aria-hidden="true"></span>
        <span class="miteam-foil-grain" aria-hidden="true"></span>
        <span class="miteam-foil-holo" aria-hidden="true"></span>
        <span class="miteam-foil-ridges" aria-hidden="true"></span>
        <span class="miteam-foil-wrap miteam-foil-wrap-left" aria-hidden="true"></span>
        <span class="miteam-foil-wrap miteam-foil-wrap-right" aria-hidden="true"></span>
        <span class="miteam-foil-fold" aria-hidden="true"></span>
        <span class="miteam-foil-lip miteam-foil-lip-top" aria-hidden="true"></span>
        <span class="miteam-foil-lip miteam-foil-lip-bottom" aria-hidden="true"></span>
        <span class="miteam-foil-tear miteam-foil-tear-top" aria-hidden="true"></span>
        <span class="miteam-foil-tear miteam-foil-tear-bottom" aria-hidden="true"></span>
        <span class="miteam-foil-edge" aria-hidden="true"></span>
        <span class="miteam-foil-glare" aria-hidden="true"></span>
        <img class="miteam-foil-logo" src="/vba-logo.png" alt="" aria-hidden="true" />
        <span class="miteam-foil-content">
          <span class="miteam-foil-label">${label}</span>
          <span class="miteam-foil-hint">TAP TO OPEN · B SKIP</span>
        </span>
      </button>
    </span>
  `;
}

const CONFETTI_COLORS: Record<PackTier, string[]> = {
  silver: ["#C0C7D2", "#E8ECF2", "#FFFFFF", "#8B93A7", "#A8B4C4", "#D7DEE8"],
  gold: ["#FFE9A8", "#F5D76E", "#D4AF37", "#FFF6D6", "#C9A227", "#FFFFFF", "#B8860B"],
  diamond: ["#E8F9FF", "#A5F3FC", "#67E8F9", "#FFFFFF", "#C4B5FD", "#F0ABFC", "#7DD3FC", "#FDF4FF"],
  purple: ["#E8D4FF", "#C9A0FF", "#8B5CF6", "#F5EAFF", "#A855F7", "#FFFFFF", "#6D28D9", "#DDD6FE"],
  black: ["#0A0A0A", "#1A1A1A", "#D4AF37", "#FFE9A8", "#F5D76E", "#FFFFFF", "#C9A227", "#3A2A08"],
};

export function burstConfetti(host: HTMLElement, tier: PackTier = "silver"): void {
  const layer = document.createElement("div");
  layer.className = `miteam-confetti miteam-confetti-${tier}`;
  layer.setAttribute("aria-hidden", "true");
  const colors = CONFETTI_COLORS[tier];
  const count =
    tier === "black" ? 72 : tier === "purple" ? 64 : tier === "diamond" ? 56 : tier === "gold" ? 48 : 36;
  const distMax =
    tier === "black" ? 210 : tier === "purple" ? 190 : tier === "diamond" ? 170 : tier === "gold" ? 150 : 120;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    bit.className = "miteam-confetti-bit";
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 60 + Math.random() * distMax;
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist - 40}px`);
    bit.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    bit.style.background = colors[i % colors.length]!;
    bit.style.left = "50%";
    bit.style.top = "42%";
    layer.appendChild(bit);
  }
  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1200);
}

export function playFoilOpen(foil: HTMLElement, onDone: () => void): void {
  foil.classList.add("miteam-foil-opening");
  const finish = () => {
    foil.removeEventListener("animationend", finish);
    onDone();
  };
  foil.addEventListener("animationend", finish);
  window.setTimeout(finish, 700);
}
