/** Foil pack open + lightweight confetti (no deps). Gold 90+, purple 95+. */

import { assetUrl } from "../core/assetUrl";
import { portraitAsset, teamBadgeAsset } from "./Portrait";
import type { SquadPlayer } from "../core/Database";

export type PackPhase = "foil" | "opening" | "revealed";
export type PackTier = "silver" | "gold" | "purple";

export const MITEAM_GOLD_OVR = 90;
/** Sealed purple foil — legends / peak 95+. */
export const MITEAM_PURPLE_OVR = 95;

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

export function packTierForOverall(overall: number): PackTier {
  if (overall >= MITEAM_PURPLE_OVR) return "purple";
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
  purple: "PURPLE PACK",
};

const FOIL_ARIA: Record<PackTier, string> = {
  silver: "Open silver pack (Space)",
  gold: "Open gold pack (Space)",
  purple: "Open purple pack (Space)",
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
          <span class="miteam-foil-hint">TAP TO OPEN</span>
        </span>
      </button>
    </span>
  `;
}

const CONFETTI_COLORS: Record<PackTier, string[]> = {
  silver: ["#C0C7D2", "#E8ECF2", "#FFFFFF", "#8B93A7", "#A8B4C4", "#D7DEE8"],
  gold: ["#FFE9A8", "#F5D76E", "#D4AF37", "#FFF6D6", "#C9A227", "#FFFFFF", "#B8860B"],
  purple: ["#E8D4FF", "#C9A0FF", "#8B5CF6", "#F5EAFF", "#A855F7", "#FFFFFF", "#6D28D9", "#DDD6FE"],
};

export function burstConfetti(host: HTMLElement, tier: PackTier = "silver"): void {
  const layer = document.createElement("div");
  layer.className = `miteam-confetti miteam-confetti-${tier}`;
  layer.setAttribute("aria-hidden", "true");
  const colors = CONFETTI_COLORS[tier];
  const count = tier === "purple" ? 56 : tier === "gold" ? 48 : 36;
  const distMax = tier === "purple" ? 170 : tier === "gold" ? 150 : 120;
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
