import * as THREE from "three";
import type { CrowdSectionRecord, CrowdSupport, StadiumRecord } from "../../data/schema";
import { HALF_LENGTH, HALF_WIDTH } from "../constants";

type StandConfiguration = StadiumRecord["standConfiguration"];

interface FanSeed {
  x: number;
  y: number;
  z: number;
  phase: number;
  style: number;
  sit: boolean;
  height: number;
  facing?: number;
}

interface SectionMesh {
  mesh: THREE.InstancedMesh;
  support: CrowdSectionRecord["support"];
  fans: FanSeed[];
  intensity: number;
  mood: "idle" | "cheer" | "down";
  decay: number;
  dirty: boolean;
}

/** Matches Stadium.buildDeluxeShell bowl radius. */
export const DELUXE_BOWL_RADIUS = 10.2;

export type DeluxeCornerId = "ne" | "nw" | "se" | "sw";

export interface DeluxeCornerSpec {
  id: DeluxeCornerId;
  cx: number;
  cz: number;
  a0: number;
  a1: number;
  rows: number;
  rowDepth: number;
  rowRise: number;
  /** Prefer AWAY when the near/south stand is the away end. */
  favorAway: boolean;
}

export function deluxeCornerSpecs(halfL = HALF_LENGTH, halfW = HALF_WIDTH): DeluxeCornerSpec[] {
  const over = 0.12;
  return [
    { id: "ne", cx: halfL, cz: -halfW, a0: -Math.PI / 2 - over, a1: over, rows: 26, rowDepth: 0.9, rowRise: 0.62, favorAway: false },
    { id: "nw", cx: -halfL, cz: -halfW, a0: Math.PI - over, a1: (Math.PI * 3) / 2 + over, rows: 26, rowDepth: 0.9, rowRise: 0.62, favorAway: false },
    { id: "se", cx: halfL, cz: halfW, a0: -over, a1: Math.PI / 2 + over, rows: 14, rowDepth: 0.85, rowRise: 0.48, favorAway: true },
    { id: "sw", cx: -halfL, cz: halfW, a0: Math.PI / 2 - over, a1: Math.PI + over, rows: 14, rowDepth: 0.85, rowRise: 0.48, favorAway: true },
  ];
}

export function goalCrowdLevels(scoring: "home" | "away"): { home: number; away: number } {
  return scoring === "home" ? { home: 1, away: 0.15 } : { home: 0.15, away: 1 };
}

/** Distance from touchline/baseline to the front of the crowd grid. Matches terrace placement in Stadium.ts. */
export const ONE_STAND_CROWD_INSET = 6.5;
/** NBA four-stand inset / bowl radius — matches Stadium basketball sideInset. */
export const ARENA_CROWD_INSET = 5.2;
export const ARENA_BOWL_RADIUS = ARENA_CROWD_INSET;

function isArenaCourt(halfL: number): boolean {
  return halfL < 40;
}

/** Terrace row rise/depth for NBA arenas — must match Stadium basketball shell. */
export function arenaTerraceStep(stand: CrowdSectionRecord["stand"]): { rowRise: number; rowDepth: number } {
  if (stand === "south") return { rowRise: 0.48, rowDepth: 0.72 };
  return { rowRise: 0.55, rowDepth: 0.72 };
}

export function arenaCornerSpecs(halfL = HALF_LENGTH, halfW = HALF_WIDTH): DeluxeCornerSpec[] {
  const over = 0.1;
  const north = arenaTerraceStep("north");
  const south = arenaTerraceStep("south");
  return [
    { id: "ne", cx: halfL, cz: -halfW, a0: -Math.PI / 2 - over, a1: over, rows: 12, rowDepth: north.rowDepth, rowRise: north.rowRise, favorAway: false },
    { id: "nw", cx: -halfL, cz: -halfW, a0: Math.PI - over, a1: (Math.PI * 3) / 2 + over, rows: 12, rowDepth: north.rowDepth, rowRise: north.rowRise, favorAway: false },
    // Match south straight (8 rows) — extra corner rows used to float past the seat deck.
    { id: "se", cx: halfL, cz: halfW, a0: -over, a1: Math.PI / 2 + over, rows: 8, rowDepth: south.rowDepth, rowRise: south.rowRise, favorAway: true },
    { id: "sw", cx: -halfL, cz: halfW, a0: Math.PI / 2 - over, a1: Math.PI + over, rows: 8, rowDepth: south.rowDepth, rowRise: south.rowRise, favorAway: true },
  ];
}

export function standCrowdInset(config: StandConfiguration = "four", halfL = HALF_LENGTH): number {
  const arena = isArenaCourt(halfL);
  if (config === "one") return arena ? 4.2 : ONE_STAND_CROWD_INSET;
  if (config === "deluxe") return arena ? Math.min(DELUXE_BOWL_RADIUS, Math.max(4.5, halfL * 0.55)) : DELUXE_BOWL_RADIUS;
  return arena ? ARENA_CROWD_INSET : 8.6;
}

export function standCrowdGrid(
  stand: CrowdSectionRecord["stand"],
  config: StandConfiguration = "four",
  halfL = HALF_LENGTH,
  halfW = HALF_WIDTH,
): {
  cols: number;
  rows: number;
  colPitch: number;
  rowPitch: number;
} {
  // NBA arenas — pack fans on the same row depth as the terraced seats.
  if (isArenaCourt(halfL)) {
    const { rowDepth } = arenaTerraceStep(stand);
    const sideCols = Math.max(28, Math.round((halfL * 2) / 0.52));
    const endCols = Math.max(18, Math.round((halfW * 2) / 0.52));
    if (stand === "north") return { cols: sideCols, rows: 12, colPitch: 0.52, rowPitch: rowDepth };
    if (stand === "south") return { cols: sideCols, rows: 8, colPitch: 0.52, rowPitch: rowDepth };
    return { cols: endCols, rows: 10, colPitch: 0.52, rowPitch: rowDepth };
  }
  // Community single stand: match terracedStand(70, 8, …) in Stadium.ts.
  if (config === "one") {
    if (stand === "north") return { cols: 80, rows: 8, colPitch: 0.88, rowPitch: 0.92 };
    if (stand === "south") return { cols: 72, rows: 6, colPitch: 0.88, rowPitch: 0.92 };
    return { cols: 40, rows: 6, colPitch: 0.88, rowPitch: 0.92 };
  }
  // Premiership deluxe bowl — straights stop short of the arcs; corners fill the wrap.
  if (config === "deluxe") {
    if (stand === "north") return { cols: 112, rows: 26, colPitch: 0.86, rowPitch: 0.9 };
    if (stand === "south") return { cols: 104, rows: 12, colPitch: 0.86, rowPitch: 0.9 };
    return { cols: 68, rows: 22, colPitch: 0.86, rowPitch: 0.9 };
  }
  if (stand === "north") return { cols: 108, rows: 18, colPitch: 0.88, rowPitch: 0.92 };
  if (stand === "south") return { cols: 100, rows: 14, colPitch: 0.88, rowPitch: 0.92 };
  return { cols: 70, rows: 16, colPitch: 0.88, rowPitch: 0.92 };
}

export function deluxeCornerCrowdGrid(corner: DeluxeCornerSpec): { cols: number; rows: number } {
  return { cols: 18, rows: corner.rows };
}

export class Crowd {
  readonly group = new THREE.Group();
  readonly sections: SectionMesh[] = [];
  private dummy = new THREE.Object3D();
  private time = 0;
  private acc = 0;
  private cheerSlice = 0;
  private readonly standConfiguration: StandConfiguration;
  private readonly halfL: number;
  private readonly halfW: number;

  constructor(
    records: CrowdSectionRecord[],
    density: number,
    homeColor: number,
    awayColor: number,
    standConfiguration: StandConfiguration = "four",
    halfL = HALF_LENGTH,
    halfW = HALF_WIDTH,
  ) {
    this.standConfiguration = standConfiguration;
    this.halfL = halfL;
    this.halfW = halfW;
    for (const rec of records) {
      // Football four-stand keeps the camera sideline open; NBA arenas fill south.
      if (rec.stand === "south" && standConfiguration !== "deluxe" && !isArenaCourt(halfL)) continue;
      this.sections.push(this.buildSection(rec, density, rec.support === "AWAY" ? awayColor : homeColor));
    }
    const fillCorners = standConfiguration === "deluxe" || isArenaCourt(halfL);
    if (fillCorners) {
      const awayStand = records.find((r) => r.support === "AWAY")?.stand ?? "south";
      const dens = records.reduce((s, r) => s + r.density, 0) / Math.max(1, records.length);
      const corners =
        standConfiguration === "deluxe" ? deluxeCornerSpecs(halfL, halfW) : arenaCornerSpecs(halfL, halfW);
      const bowlR = standConfiguration === "deluxe" ? DELUXE_BOWL_RADIUS : ARENA_BOWL_RADIUS;
      for (const corner of corners) {
        const support: CrowdSupport =
          corner.favorAway && awayStand === "south"
            ? "AWAY"
            : awayStand === "east" && (corner.id === "ne" || corner.id === "se")
              ? "AWAY"
              : awayStand === "west" && (corner.id === "nw" || corner.id === "sw")
                ? "AWAY"
                : "HOME";
        const color = support === "AWAY" ? awayColor : homeColor;
        this.sections.push(this.buildCornerSection(corner, dens * density, support, color, bowlR));
      }
    }
  }

  private tintFan(color: number, support: CrowdSupport, style: number): THREE.Color {
    const shade = new THREE.Color(color);
    if (style < 0.24) shade.setHex(0xf3f6f0);
    else if (style < 0.36) shade.setHex(0x1a1f24);
    else if (style < 0.44) shade.setHex(support === "AWAY" ? 0xe8e0d4 : 0xc5a572);
    else if (style < 0.52) shade.setHex(0x2f4a3a);
    else shade.offsetHSL(0, 0, (Math.random() - 0.35) * 0.28);
    return shade;
  }

  private buildSection(rec: CrowdSectionRecord, density: number, color: number): SectionMesh {
    const { cols, rows, colPitch, rowPitch } = standCrowdGrid(
      rec.stand,
      this.standConfiguration,
      this.halfL,
      this.halfW,
    );
    const seats = cols * rows;
    const fanW = isArenaCourt(this.halfL) ? 0.22 : 0.28;
    const fanH = isArenaCourt(this.halfL) ? 0.7 : 0.82;
    const fanD = isArenaCourt(this.halfL) ? 0.18 : 0.22;
    const geo = new THREE.BoxGeometry(fanW, fanH, fanD);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geo, mat, seats);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    const fans: FanSeed[] = [];
    const { origin, u, v } = standFrame(rec.stand, this.standConfiguration, this.halfL, this.halfW);
    const inset = standCrowdInset(this.standConfiguration, this.halfL);
    let placed = 0;
    for (let i = 0; i < seats; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      if (col % 15 === 0) continue;
      // Keep straight-stand fans out of the curved corner zones on wrapped bowls.
      if (this.standConfiguration === "deluxe" || isArenaCourt(this.halfL)) {
        const along = (col - cols / 2) * colPitch;
        if (rec.stand === "north" || rec.stand === "south") {
          if (Math.abs(along) > this.halfL - inset * 0.55) continue;
        } else if (Math.abs(along) > this.halfW - inset * 0.55) continue;
      }
      const cluster = 0.94 + 0.06 * Math.sin(row * 0.45 + col * 0.21);
      const occupy = rec.density * density * cluster;
      if (Math.random() > occupy) continue;
      const arena = isArenaCourt(this.halfL);
      const jitterU = (Math.random() - 0.5) * (arena ? 0.16 : 0.28);
      // Keep depth jitter small so fans stay on the seat plank, not in the aisle void.
      const jitterV = (Math.random() - 0.5) * (arena ? 0.06 : 0.14);
      const x = origin.x + u.x * (col - cols / 2) * colPitch + v.x * row * rowPitch + jitterU;
      const rowRise = arena
        ? arenaTerraceStep(rec.stand).rowRise
        : this.standConfiguration === "deluxe"
          ? rec.stand === "south"
            ? 0.48
            : 0.62
          : 0.58;
      // Deck centres sit at 1.15 + row*rise; fan boxes are ~0.7 tall → sit just above the plank.
      const yBase = arena ? 1.52 : 2.05;
      const y = yBase + row * rowRise;
      const z = origin.z + u.z * (col - cols / 2) * colPitch + v.z * row * rowPitch + jitterV;
      const seed: FanSeed = {
        x,
        y,
        z,
        phase: Math.random() * Math.PI * 2,
        style: Math.random(),
        sit: Math.random() < 0.08,
        // Arena: keep scale near 1 so feet stay on the deck (scale grows both ways from centre).
        height: arena ? 0.96 + Math.random() * 0.08 : 0.92 + Math.random() * 0.22,
      };
      fans.push(seed);
      mesh.setColorAt(placed, this.tintFan(color, rec.support, seed.style));
      placed += 1;
    }
    mesh.count = placed;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    const section: SectionMesh = { mesh, support: rec.support, fans, intensity: 0.22, mood: "idle", decay: 0, dirty: false };
    this.poseIdle(section);
    return section;
  }

  private buildCornerSection(
    corner: DeluxeCornerSpec,
    density: number,
    support: CrowdSupport,
    color: number,
    frontR = DELUXE_BOWL_RADIUS,
  ): SectionMesh {
    const { cols, rows } = deluxeCornerCrowdGrid(corner);
    const seats = cols * rows;
    const arena = isArenaCourt(this.halfL);
    const geo = new THREE.BoxGeometry(arena ? 0.22 : 0.28, arena ? 0.7 : 0.82, arena ? 0.18 : 0.22);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(geo, mat, seats);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    const fans: FanSeed[] = [];
    const sweep = corner.a1 - corner.a0;
    let placed = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (col % 5 === 0) continue;
        const cluster = 0.94 + 0.06 * Math.sin(row * 0.45 + col * 0.21);
        if (Math.random() > density * cluster) continue;
        const mid = corner.a0 + sweep * ((col + 0.5) / cols);
        const radius = frontR + row * corner.rowDepth + (Math.random() - 0.5) * (arena ? 0.08 : 0.2);
        const x = corner.cx + Math.cos(mid) * radius;
        const z = corner.cz + Math.sin(mid) * radius;
        const y = (arena ? 1.52 : 2.05) + row * corner.rowRise;
        // Face the pitch (inward along -radial).
        const facing = Math.PI / 2 - mid + Math.PI;
        const seed: FanSeed = {
          x,
          y,
          z,
          phase: Math.random() * Math.PI * 2,
          style: Math.random(),
          sit: Math.random() < 0.08,
          height: arena ? 0.96 + Math.random() * 0.08 : 0.92 + Math.random() * 0.22,
          facing,
        };
        fans.push(seed);
        mesh.setColorAt(placed, this.tintFan(color, support, seed.style));
        placed += 1;
      }
    }
    mesh.count = placed;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    const section: SectionMesh = { mesh, support, fans, intensity: 0.22, mood: "idle", decay: 0, dirty: false };
    this.poseIdle(section);
    return section;
  }

  private poseIdle(s: SectionMesh): void {
    const n = s.fans.length;
    for (let i = 0; i < n; i++) {
      const f = s.fans[i];
      const sitDrop = f.sit ? 0.28 : 0;
      this.dummy.position.set(f.x, f.y - sitDrop, f.z);
      this.dummy.rotation.set(0, f.facing ?? 0, 0);
      this.dummy.scale.setScalar(f.height);
      this.dummy.updateMatrix();
      s.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
    s.dirty = false;
  }

  setReaction(support: CrowdSectionRecord["support"], mood: "cheer" | "down" | "idle", intensity: number): void {
    for (const s of this.sections) {
      if (s.support === support) {
        s.mood = mood;
        s.intensity = intensity;
        s.decay = mood === "idle" ? 0 : 6;
        s.dirty = mood !== "idle";
        if (mood === "idle") this.poseIdle(s);
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.acc += dt;
    let anyLive = false;
    for (const s of this.sections) {
      if (s.decay > 0) {
        s.decay -= dt;
        if (s.decay <= 0) {
          s.mood = "idle";
          this.poseIdle(s);
        }
      }
      if (s.mood !== "idle") anyLive = true;
    }
    if (!anyLive) return;
    if (this.acc < 0.085) return;
    this.acc = 0;
    this.cheerSlice = (this.cheerSlice + 1) % 4;
    for (const s of this.sections) {
      if (s.mood === "idle") continue;
      const target = s.mood === "cheer" ? 1 : 0.1;
      s.intensity += (target - s.intensity) * 0.35;
      const n = s.fans.length;
      for (let i = this.cheerSlice; i < n; i += 4) {
        const f = s.fans[i];
        const hop =
          s.mood === "cheer" ? Math.abs(Math.sin(this.time * (6.4 + f.style * 4) + f.phase)) * 0.42 * s.intensity : 0;
        const sitDrop = f.sit && s.mood !== "cheer" ? 0.28 : 0;
        const wave = s.mood === "cheer" ? Math.sin(this.time * 3.2 + f.x * 0.08) * 0.06 * s.intensity : 0;
        this.dummy.position.set(f.x + wave, f.y + hop - sitDrop, f.z);
        this.dummy.rotation.set(0, (f.facing ?? 0) + wave * 0.8, 0);
        this.dummy.scale.setScalar(f.height * (s.mood === "down" ? 0.9 : 1));
        this.dummy.updateMatrix();
        s.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      s.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

function standFrame(
  stand: CrowdSectionRecord["stand"],
  config: StandConfiguration = "four",
  halfL = HALF_LENGTH,
  halfW = HALF_WIDTH,
): {
  origin: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
} {
  const inset = standCrowdInset(config, halfL);
  if (stand === "north") {
    return {
      origin: new THREE.Vector3(0, 0, -halfW - inset),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, -1),
    };
  }
  if (stand === "south") {
    return {
      origin: new THREE.Vector3(0, 0, halfW + inset),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
    };
  }
  if (stand === "east") {
    return {
      origin: new THREE.Vector3(halfL + inset, 0, 0),
      u: new THREE.Vector3(0, 0, 1),
      v: new THREE.Vector3(1, 0, 0),
    };
  }
  return {
    origin: new THREE.Vector3(-halfL - inset, 0, 0),
    u: new THREE.Vector3(0, 0, 1),
    v: new THREE.Vector3(-1, 0, 0),
  };
}
