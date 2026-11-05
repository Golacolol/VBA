import * as THREE from "three";
import type { GameDatabase } from "../../core/Database";
import type { ScoreboardConfig } from "../../data/schema";
import { standingsFor } from "../league/Standings";

export interface ScoreboardStandingRow {
  rank: number;
  abbr: string;
  won: number;
  lost: number;
}

export interface ScoreboardFixtureRow {
  date: string;
  time: string;
  homeAbbr: string;
  awayAbbr: string;
}

/** Shared East/West tables + upcoming fixtures for the four-sided arena jumbotron. */
export function jumbotronPanelData(db: GameDatabase): {
  upcomingFixtures: ScoreboardFixtureRow[];
  eastStandings: ScoreboardStandingRow[];
  westStandings: ScoreboardStandingRow[];
} {
  const teams = [...db.teams.values()];
  const east = standingsFor(db.fixtures, teams, "EAST")
    .slice(0, 8)
    .map((r, i) => ({
      rank: i + 1,
      abbr: r.abbreviation,
      won: r.won,
      lost: r.lost,
    }));
  const west = standingsFor(db.fixtures, teams, "WEST")
    .slice(0, 8)
    .map((r, i) => ({
      rank: i + 1,
      abbr: r.abbreviation,
      won: r.won,
      lost: r.lost,
    }));
  const abbr = (id: string) => db.teams.get(id)?.abbreviation ?? id.slice(-3).toUpperCase();
  const upcoming = db.fixtures
    .filter((f) => !f.played)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 7)
    .map((f) => ({
      date: f.date,
      time: f.time,
      homeAbbr: abbr(f.homeTeamId),
      awayAbbr: abbr(f.awayTeamId),
    }));
  return { upcomingFixtures: upcoming, eastStandings: east, westStandings: west };
}

export interface ScoreboardView {
  homeAbbr: string;
  awayAbbr: string;
  homeName: string;
  awayName: string;
  home: number;
  away: number;
  clock: string;
  state: string;
  scorer?: string;
  scorerNumber?: number;
  homeColor: string;
  awayColor: string;
  /** Upcoming fixtures for the camera-facing jumbotron panel. */
  upcomingFixtures?: ScoreboardFixtureRow[];
  /** Eastern Conference table for the +X (camera-right) panel. */
  eastStandings?: ScoreboardStandingRow[];
  /** Western Conference table for the −X (camera-left) panel. */
  westStandings?: ScoreboardStandingRow[];
}

export type ScoreboardMount = "wall" | "jumbotron";

type JumboFaceId = "front" | "back" | "east" | "west";

interface JumboFace {
  id: JumboFaceId;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
  mesh: THREE.Mesh;
}

export class Scoreboard {
  readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  readonly type: ScoreboardConfig["type"];
  readonly mount: ScoreboardMount;
  private lastKey = "";
  private jumboFaces: JumboFace[] = [];

  constructor(config: ScoreboardConfig, mount: ScoreboardMount = "wall") {
    this.type = config.type;
    this.mount = mount;
    this.canvas = document.createElement("canvas");
    this.canvas.width = config.type === "LED_VIDEO_SCREEN" ? 1024 : 512;
    this.canvas.height = config.type === "LED_VIDEO_SCREEN" ? 512 : 256;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: this.texture,
      emissive: 0x222222,
      emissiveMap: this.texture,
      emissiveIntensity: config.type === "LED_VIDEO_SCREEN" ? 0.95 : 0.15,
      roughness: 0.35,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(config.width, config.height), mat);
    this.mesh.position.set(...config.position);
    this.mesh.rotation.set(...config.rotation);
    if (config.type === "NONE") this.mesh.visible = false;

    if (mount === "jumbotron" && config.type === "LED_VIDEO_SCREEN") {
      this.buildJumbotron(config, mat);
      return;
    }

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + 0.55, config.height + 0.7, 0.55),
      new THREE.MeshStandardMaterial({ color: config.type === "LED_VIDEO_SCREEN" ? 0x111418 : 0x5a3b22, roughness: 0.55, metalness: 0.12 }),
    );
    frame.position.z = -0.32;
    this.mesh.add(frame);
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + 0.15, config.height + 0.15, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }),
    );
    bezel.position.z = -0.02;
    this.mesh.add(bezel);
    if (config.type === "LED_VIDEO_SCREEN") {
      const legGeo = new THREE.BoxGeometry(0.28, 6.5, 0.28);
      const steel = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.45, metalness: 0.35 });
      for (const x of [-config.width * 0.38, config.width * 0.38]) {
        const leg = new THREE.Mesh(legGeo, steel);
        leg.position.set(x, -config.height * 0.5 - 3.1, -0.5);
        this.mesh.add(leg);
      }
      const gantry = new THREE.Mesh(new THREE.BoxGeometry(config.width + 1.4, 0.22, 1.1), steel);
      gantry.position.set(0, config.height * 0.5 + 0.4, -0.6);
      this.mesh.add(gantry);
    }
  }

  /** Center-hung NBA cube: four independent LED faces + top ring. */
  private buildJumbotron(config: ScoreboardConfig, frontMat: THREE.MeshStandardMaterial): void {
    const w = config.width;
    const h = config.height;
    const depth = Math.min(w, 5.4);
    const halfW = w / 2;
    const halfD = depth / 2;
    const steel = new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.4, metalness: 0.45 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.55 });

    // Root mesh is an invisible anchor at the cube centre (children still render).
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const anchorMat = new THREE.MeshBasicMaterial({ visible: false });
    if (Array.isArray(this.mesh.material)) {
      for (const m of this.mesh.material) m.dispose();
    } else {
      this.mesh.material.dispose();
    }
    this.mesh.material = anchorMat;
    this.mesh.position.set(config.position[0], config.position[1], config.position[2]);
    this.mesh.rotation.set(0, 0, 0);

    const addBezel = (panel: THREE.Mesh, faceW: number): void => {
      // Frame sits behind the LED plane (local −Z) so it never covers the canvas.
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.22, h + 0.22, 0.12), steel);
      bezel.position.z = -0.07;
      panel.add(bezel);
    };

    const makeLedFace = (
      id: JumboFaceId,
      yaw: number,
      x: number,
      z: number,
      faceW: number,
      material: THREE.MeshStandardMaterial,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      texture: THREE.CanvasTexture,
    ): void => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(faceW, h), material);
      panel.position.set(x, 0, z);
      panel.rotation.y = yaw;
      this.mesh.add(panel);
      addBezel(panel, faceW);
      this.jumboFaces.push({ id, canvas, ctx, texture, material, mesh: panel });
    };

    // Front (+Z, camera): reuse the primary canvas / material.
    makeLedFace("front", 0, 0, halfD + 0.02, w, frontMat, this.canvas, this.ctx, this.texture);

    const makeSideCanvas = (): {
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      texture: THREE.CanvasTexture;
      material: THREE.MeshStandardMaterial;
    } => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext("2d")!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0x222222,
        emissiveMap: texture,
        emissiveIntensity: 0.95,
        roughness: 0.35,
      });
      return { canvas, ctx, texture, material };
    };

    // PlaneGeometry normals face +Z. Yaw so each side faces outward.
    // Camera on +Z looking −Z: left (−X) = West, right (+X) = East. Side width = cube depth.
    const west = makeSideCanvas();
    makeLedFace("west", -Math.PI / 2, -(halfW + 0.02), 0, depth, west.material, west.canvas, west.ctx, west.texture);
    const east = makeSideCanvas();
    makeLedFace("east", Math.PI / 2, halfW + 0.02, 0, depth, east.material, east.canvas, east.ctx, east.texture);
    const back = makeSideCanvas();
    makeLedFace("back", Math.PI, 0, -(halfD + 0.02), w, back.material, back.canvas, back.ctx, back.texture);

    const core = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h + 0.35, depth - 0.08), black);
    this.mesh.add(core);

    // Thin crown bezel only — no floating square deck above the cube.
    const ring = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.22, depth + 0.35), steel);
    ring.position.set(0, h * 0.5 + 0.2, 0);
    this.mesh.add(ring);

    const cableMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.5, metalness: 0.3 });
    for (const [ox, oz] of [
      [w * 0.35, depth * 0.35],
      [w * 0.35, -depth * 0.35],
      [-w * 0.35, depth * 0.35],
      [-w * 0.35, -depth * 0.35],
    ] as const) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.2, 6), cableMat);
      cable.position.set(ox, h * 0.5 + 2.9, oz);
      this.mesh.add(cable);
    }
  }

  draw(view: ScoreboardView): void {
    if (this.mount === "jumbotron" && this.jumboFaces.length) {
      this.drawJumbotron(view);
      return;
    }
    const key = `${view.home}|${view.away}|${view.clock}|${view.state}|${view.scorer ?? ""}|${view.scorerNumber ?? ""}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const { ctx, canvas } = this;
    if (this.type === "TRADITIONAL_SCOREBOARD") {
      ctx.fillStyle = "#5c3b1e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f0e6c8";
      ctx.font = "bold 42px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("HOME", canvas.width * 0.28, 70);
      ctx.fillText("AWAY", canvas.width * 0.72, 70);
      ctx.fillStyle = "#111";
      ctx.fillRect(50, 100, 150, 110);
      ctx.fillRect(canvas.width - 200, 100, 150, 110);
      ctx.fillStyle = "#e23";
      ctx.font = "bold 88px monospace";
      ctx.fillText(String(view.home), 125, 185);
      ctx.fillText(String(view.away), canvas.width - 125, 185);
      ctx.fillStyle = "#f0e6c8";
      ctx.font = "24px Georgia, serif";
      ctx.fillText(view.clock, canvas.width / 2, 236);
      this.texture.needsUpdate = true;
      return;
    }
    this.paintLiveScore(ctx, canvas, view);
    this.texture.needsUpdate = true;
  }

  private drawJumbotron(view: ScoreboardView): void {
    const fixKey = (view.upcomingFixtures ?? []).map((f) => `${f.date}${f.homeAbbr}${f.awayAbbr}`).join("|");
    const eastKey = (view.eastStandings ?? []).map((r) => `${r.abbr}${r.won}${r.lost}`).join("|");
    const westKey = (view.westStandings ?? []).map((r) => `${r.abbr}${r.won}${r.lost}`).join("|");
    const key = `${view.home}|${view.away}|${view.clock}|${view.state}|${view.scorer ?? ""}|${fixKey}|${eastKey}|${westKey}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    for (const face of this.jumboFaces) {
      if (face.id === "front") {
        this.paintFixtures(face.ctx, face.canvas, view);
      } else if (face.id === "east") {
        this.paintStandings(face.ctx, face.canvas, "EASTERN CONFERENCE", "#1d428a", view.eastStandings ?? []);
      } else if (face.id === "west") {
        this.paintStandings(face.ctx, face.canvas, "WESTERN CONFERENCE", "#c8102e", view.westStandings ?? []);
      } else {
        this.paintLiveScore(face.ctx, face.canvas, view);
      }
      face.texture.needsUpdate = true;
    }
  }

  private paintLiveScore(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    view: ScoreboardView,
  ): void {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (view.state === "GOAL" || view.state === "GOAL_CELEBRATION") {
      ctx.fillStyle = view.homeColor;
      ctx.fillRect(0, 0, canvas.width, 90);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 72px Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", canvas.width / 2, 70);
      ctx.font = "bold 40px Arial";
      ctx.fillText(view.scorer ?? "", canvas.width / 2, 160);
      if (view.scorerNumber) ctx.fillText(`#${view.scorerNumber}`, canvas.width / 2, 210);
    } else {
      ctx.fillStyle = view.homeColor;
      ctx.fillRect(0, 0, canvas.width / 2, 120);
      ctx.fillStyle = view.awayColor;
      ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, 120);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 42px Arial";
      ctx.textAlign = "center";
      ctx.fillText(view.homeName.toUpperCase().slice(0, 14), canvas.width * 0.25, 50);
      ctx.fillText(view.awayName.toUpperCase().slice(0, 14), canvas.width * 0.75, 50);
      ctx.font = "bold 28px Arial";
      ctx.fillText(view.homeAbbr, canvas.width * 0.25, 95);
      ctx.fillText(view.awayAbbr, canvas.width * 0.75, 95);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${view.home}  -  ${view.away}`, canvas.width / 2, 340);
    ctx.font = "bold 48px Arial";
    ctx.fillText(view.clock, canvas.width / 2, 430);
    ctx.font = "24px Arial";
    ctx.fillStyle = "#9f9";
    ctx.fillText(view.state.replaceAll("_", " "), canvas.width / 2, 490);
  }

  private paintFixtures(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    view: ScoreboardView,
  ): void {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111820";
    ctx.fillRect(0, 0, canvas.width, 78);
    ctx.fillStyle = "#f2f4f0";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("UPCOMING FIXTURES", canvas.width / 2, 52);

    const rows = view.upcomingFixtures ?? [];
    if (!rows.length) {
      ctx.fillStyle = "#889";
      ctx.font = "28px Arial";
      ctx.fillText("No upcoming fixtures", canvas.width / 2, 260);
      // Keep live score strip so the front still shows the current game.
      ctx.fillStyle = "#1a222c";
      ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px Arial";
      ctx.fillText(`${view.homeAbbr} ${view.home}  -  ${view.away} ${view.awayAbbr}   ${view.clock}`, canvas.width / 2, canvas.height - 24);
      return;
    }

    const top = 108;
    const lineH = 48;
    const maxRows = Math.min(rows.length, 7);
    ctx.textAlign = "left";
    for (let i = 0; i < maxRows; i++) {
      const f = rows[i]!;
      const y = top + i * lineH;
      if (i % 2 === 0) {
        ctx.fillStyle = "#0c1016";
        ctx.fillRect(24, y - 32, canvas.width - 48, lineH - 4);
      }
      ctx.fillStyle = "#8a93a0";
      ctx.font = "22px Arial";
      const when = `${f.date.slice(5)}  ${f.time}`;
      ctx.fillText(when, 48, y);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${f.homeAbbr}  vs  ${f.awayAbbr}`, canvas.width / 2 + 40, y);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#1a222c";
    ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${view.homeAbbr} ${view.home}  -  ${view.away} ${view.awayAbbr}   ${view.clock}`, canvas.width / 2, canvas.height - 24);
  }

  private paintStandings(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    title: string,
    accent: string,
    rows: ScoreboardStandingRow[],
  ): void {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, canvas.width, 78);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, 50);

    ctx.fillStyle = "#889";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText("#", 48, 112);
    ctx.fillText("TEAM", 100, 112);
    ctx.textAlign = "right";
    ctx.fillText("W", canvas.width - 160, 112);
    ctx.fillText("L", canvas.width - 70, 112);

    const maxRows = Math.min(rows.length, 8);
    for (let i = 0; i < maxRows; i++) {
      const r = rows[i]!;
      const y = 152 + i * 42;
      if (i % 2 === 0) {
        ctx.fillStyle = "#0c1016";
        ctx.fillRect(24, y - 28, canvas.width - 48, 40);
      }
      ctx.fillStyle = i < 6 ? "#f2f4f0" : "#a8b0bc";
      ctx.font = "bold 26px Arial";
      ctx.textAlign = "left";
      ctx.fillText(String(r.rank), 48, y);
      ctx.fillText(r.abbr.toUpperCase(), 100, y);
      ctx.textAlign = "right";
      ctx.fillText(String(r.won), canvas.width - 160, y);
      ctx.fillText(String(r.lost), canvas.width - 70, y);
    }

    if (!rows.length) {
      ctx.fillStyle = "#889";
      ctx.font = "28px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Standings loading…", canvas.width / 2, 280);
    }
  }

  setEmissive(intensity: number): void {
    const led = this.type === "LED_VIDEO_SCREEN" ? intensity : Math.min(0.2, intensity * 0.2);
    if (this.jumboFaces.length) {
      for (const face of this.jumboFaces) face.material.emissiveIntensity = led;
      return;
    }
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = led;
  }
}
