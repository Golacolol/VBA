import * as THREE from "three";
import { hexColor } from "../../core/math";
import type { AdvertisingBoardRecord, StadiumRecord, TeamKit } from "../../data/schema";
import { createCourt, applyCourtWeather } from "../pitch/Court";
import { createPitch, applyPitchWeather } from "../pitch/Pitch";
import { AdvertisingBoards } from "./AdvertisingBoards";
import { Crowd, ONE_STAND_CROWD_INSET, DELUXE_BOWL_RADIUS } from "./Crowd";
import { Dugouts } from "./Dugouts";
import { createGoals } from "./Goals";
import { createHoops } from "./Hoops";
import { applyLighting } from "./Lighting";
import { Scoreboard } from "./Scoreboard";
import { Precipitation } from "../environment/Precipitation";
import { resolveEnvironment, type EnvironmentPreset } from "../environment/Environment";

function isBasketballVenue(venueType: string | undefined): boolean {
  return (
    venueType === "NBA_ARENA" ||
    venueType === "STREET_COURT" ||
    venueType === "GYM" ||
    venueType === "CLASSIC_ARENA"
  );
}

export function scoreboardIsSubordinate(width: number, height: number): boolean {
  return width <= 12 && height <= 4.5 && width * height <= 40;
}

/** Footpath centre X for park venues — clear of pitch + grass apron (pad 10 → ±5). */
export function parkPathCentreX(pitchLength: number): number {
  return pitchLength / 2 + 10;
}

export class Stadium {
  readonly group = new THREE.Group();
  readonly crowd: Crowd;
  readonly scoreboard: Scoreboard;
  readonly ads: AdvertisingBoards;
  readonly record: StadiumRecord;
  readonly precip = new Precipitation();
  readonly dugouts: Dugouts | null;
  private pitch: THREE.Group;
  private scene: THREE.Scene;
  private lights: THREE.Group;

  constructor(
    scene: THREE.Scene,
    record: StadiumRecord,
    ads: AdvertisingBoardRecord[],
    homeColor: string,
    awayColor: string,
    env: EnvironmentPreset = resolveEnvironment("EVENING", "MILD"),
    kits?: { home: TeamKit; away: TeamKit },
  ) {
    this.record = record;
    this.scene = scene;
    this.lights = applyLighting(scene, record, env);
    this.group.add(this.lights);
    const basketball = isBasketballVenue(record.venueType);
    this.pitch = basketball
      ? createCourt(record.pitchLength, record.pitchWidth)
      : createPitch(record.pitchLength, record.pitchWidth, {
          park: record.environment === "park",
        });
    this.group.add(this.pitch);
    this.group.add(
      basketball ? createHoops(record.pitchLength / 2) : createGoals(record.pitchLength / 2),
    );
    this.ads = new AdvertisingBoards(ads, record.pitchLength, record.pitchWidth);
    this.group.add(this.ads.group);
    this.crowd = new Crowd(
      record.crowdSections,
      record.crowdDensity,
      hexColor(homeColor),
      hexColor(awayColor),
      record.standConfiguration,
      record.pitchLength / 2,
      record.pitchWidth / 2,
    );
    this.group.add(this.crowd.group);
    this.scoreboard = new Scoreboard(record.scoreboard, basketball ? "jumbotron" : "wall");
    this.group.add(this.scoreboard.mesh);
    this.group.add(this.precip.group);
    if (record.benches) {
      const homeKit = kits?.home ?? { shirt: homeColor, shorts: "#1a1a1a", socks: homeColor };
      const awayKit = kits?.away ?? { shirt: awayColor, shorts: "#1a1a1a", socks: awayColor };
      this.dugouts = new Dugouts(
        homeKit,
        awayKit,
        homeColor,
        awayColor,
        record.pitchWidth / 2,
        basketball ? "arena" : "football",
      );
      this.group.add(this.dugouts.group);
    } else {
      this.dugouts = null;
    }
    this.buildShell(record);
    if (!basketball && record.environment === "park") this.buildPark();
    this.applyEnvironment(env);
    scene.add(this.group);
  }

  applyEnvironment(env: EnvironmentPreset, graphics: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" = "HIGH"): void {
    if (isBasketballVenue(this.record.venueType)) applyCourtWeather(this.pitch, env);
    else applyPitchWeather(this.pitch, env);
    this.scoreboard.setEmissive(env.scoreboardEmissive);
    this.precip.configure(env, graphics);
    const nightish = env.timeOfDay === "NIGHT" || env.timeOfDay === "EVENING";
    this.group.traverse((obj) => {
      if (obj.name !== "parkFloodHead" || !(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = nightish ? (env.timeOfDay === "NIGHT" ? 1.15 : 0.75) : 0.2;
    });
  }

  setLighting(env: EnvironmentPreset, graphics: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" = "HIGH"): void {
    this.group.remove(this.lights);
    this.lights = applyLighting(this.scene, this.record, env);
    this.group.add(this.lights);
    this.applyEnvironment(env, graphics);
  }

  update(dt: number, cam?: THREE.Vector3): void {
    this.crowd.update(dt);
    this.dugouts?.update(dt);
    if (cam) {
      this.precip.update(dt, cam);
      this.syncRoofVisibility(cam);
    }
  }

  /**
   * Deluxe bowls: keep the camera-side (south) roof / cladding permanently clear, and
   * hide any other roof panel the lens is under so broadcast / wide angles never clip.
   */
  private syncRoofVisibility(cam: THREE.Vector3): void {
    if (this.record.standConfiguration !== "deluxe") return;
    const _wp = Stadium._roofWorld;
    this.group.traverse((obj) => {
      if (obj.userData.cameraNear) {
        obj.visible = false;
        return;
      }
      if (obj.name !== "standRoof") return;
      obj.getWorldPosition(_wp);
      const under = cam.y < _wp.y + 1.35 && Math.hypot(cam.x - _wp.x, cam.z - _wp.z) < 32;
      obj.visible = !under;
    });
  }

  private static readonly _roofWorld = new THREE.Vector3();

  private buildShell(record: StadiumRecord): void {
    const halfL = record.pitchLength / 2;
    const halfW = record.pitchWidth / 2;
    const basketball = isBasketballVenue(record.venueType);
    const conc = new THREE.MeshStandardMaterial({
      color: basketball ? 0x2a3038 : 0xd5cec2,
      roughness: 0.88,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.62, metalness: 0.08 });
    const greenSeat = new THREE.MeshStandardMaterial({
      color: basketball ? 0x1a2740 : 0x0f5c34,
      roughness: 0.7,
    });
    const whiteAcc = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.55 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.4, metalness: 0.3 });
    if (record.standConfiguration === "none") return;

    const terracedStand = (
      w: number,
      rows: number,
      x: number,
      z: number,
      rot: number,
      seatColor: THREE.Material,
      opts?: {
        rowDepth?: number;
        rowRise?: number;
        fascia?: THREE.Material;
        cladding?: THREE.Material;
        roofMetal?: THREE.Material;
        /** Skip back wall / concourse / fascia (camera-side stand). */
        omitRoof?: boolean;
        /** Mark as near-camera side — walls culled. */
        cameraNearRoof?: boolean;
        /** Never add a stand roof canopy (NBA arenas). */
        noRoof?: boolean;
      },
    ) => {
      const g = new THREE.Group();
      const rowDepth = opts?.rowDepth ?? 0.92;
      const rowRise = opts?.rowRise ?? 0.58;
      const wall = opts?.cladding ?? conc;
      const roofMat = opts?.roofMetal ?? dark;
      const fasciaMat = opts?.fascia ?? greenSeat;
      for (let r = 0; r < rows; r++) {
        const aisle = r % 6 === 5;
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(w - r * 0.12, aisle ? 0.18 : 0.38, rowDepth * 0.92),
          aisle ? whiteAcc : seatColor,
        );
        deck.position.set(0, 1.15 + r * rowRise, r * rowDepth);
        deck.receiveShadow = true;
        g.add(deck);
      }
      const backH = rows * rowRise + 5.2;
      // Camera-side stand: seats only — back wall / concourse / fascia are long boxes that
      // sit in front of the broadcast lens.
      if (!opts?.omitRoof && !opts?.cameraNearRoof) {
        const back = new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, backH, 2.4), wall);
        back.position.set(0, backH / 2, rows * rowDepth + 1.4);
        back.castShadow = true;
        g.add(back);
        const concourse = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 2.2, 4.2), wall);
        concourse.position.set(0, 3.4, rows * rowDepth + 4.2);
        g.add(concourse);
        if (!opts?.noRoof) {
          const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2.8, 0.32, rows * rowDepth + 5.5), roofMat);
          roof.position.set(0, rows * rowRise + 6.1, rows * rowDepth * 0.42);
          roof.name = "standRoof";
          g.add(roof);
        }
        // Court-facing face of the grey back wall (depth 2.4, centred at rows*rowDepth+1.4).
        const wallFrontZ = rows * rowDepth + 0.2;
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.05, 0.28), fasciaMat);
        fascia.position.set(0, backH - 0.65, wallFrontZ - 0.14);
        g.add(fascia);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      this.group.add(g);
      return g;
    };

    if (record.standConfiguration === "one") {
      terracedStand(Math.max(24, halfL * 4), 8, 0, -halfW - ONE_STAND_CROWD_INSET, Math.PI, greenSeat);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(halfL * 5, 1.1, 0.12), dark);
      rail.position.set(0, 0.7, halfW + 3.4);
      this.group.add(rail);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xeee8d8,
        emissive: 0xffe7b0,
        emissiveIntensity: 0.35,
        roughness: 0.45,
      });
      for (const x of [-halfL * 1.6, halfL * 1.6] as const) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 11, 8), dark);
        pole.position.set(x, 5.5, -halfW - ONE_STAND_CROWD_INSET - 1.2);
        this.group.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.15), lampMat);
        head.position.set(x, 11.1, -halfW - ONE_STAND_CROWD_INSET - 0.4);
        head.name = "parkFloodHead";
        this.group.add(head);
      }
      return;
    }

    if (record.standConfiguration === "deluxe") {
      this.buildDeluxeShell(record, terracedStand, { dark, steel });
      return;
    }

    // Camera sits on +Z. Basketball arenas fill the near (south) stand; football keeps it open.
    const sideInset = basketball ? 5.2 : 8.4;
    const rows = basketball ? 12 : 18;
    const endRows = basketball ? 10 : 16;
    const southRows = 8;
    const northRise = basketball ? 0.55 : 0.58;
    const northDepth = basketball ? 0.72 : 0.92;
    const southRise = 0.48;
    const southDepth = 0.72;
    // Straights stop at the court corners so quarter-circle wraps can connect them.
    const sideLen = basketball ? 2 * halfL : 98;
    const endLen = basketball ? 2 * halfW : 64;
    const arenaOpts = basketball
      ? { noRoof: true as const, rowRise: northRise, rowDepth: northDepth }
      : undefined;
    terracedStand(sideLen, rows, 0, -halfW - sideInset, Math.PI, greenSeat, arenaOpts);
    terracedStand(endLen, endRows, halfL + sideInset, 0, Math.PI / 2, greenSeat, arenaOpts);
    terracedStand(endLen, endRows, -halfL - sideInset, 0, -Math.PI / 2, greenSeat, arenaOpts);
    if (basketball) {
      // Near-camera stand — seats only, no roof / back wall in front of the lens.
      terracedStand(sideLen, southRows, 0, halfW + sideInset, 0, greenSeat, {
        rowRise: southRise,
        rowDepth: southDepth,
        noRoof: true,
        omitRoof: true,
        cameraNearRoof: true,
      });

      // Warp corners into continuous bowl arcs (no square blocks, no roof).
      const cornerMats = {
        seat: greenSeat,
        aisle: whiteAcc,
        cladding: conc,
        roof: dark,
        fascia: greenSeat,
      };
      const over = 0.1;
      this.buildDeluxeCornerArc(
        halfL, -halfW, -Math.PI / 2 - over, over, rows, sideInset, northDepth, northRise, cornerMats, false, true,
      );
      this.buildDeluxeCornerArc(
        -halfL, -halfW, Math.PI - over, (Math.PI * 3) / 2 + over, rows, sideInset, northDepth, northRise, cornerMats, false, true,
      );
      this.buildDeluxeCornerArc(
        halfL, halfW, -over, Math.PI / 2 + over, southRows, sideInset, southDepth, southRise, cornerMats, true, true,
      );
      this.buildDeluxeCornerArc(
        -halfL, halfW, Math.PI / 2 - over, Math.PI + over, southRows, sideInset, southDepth, southRise, cornerMats, true, true,
      );
    } else {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(16, 11, 16), conc);
      for (const [x, z] of [
        [halfL + sideInset + 2, -halfW - sideInset - 2],
        [-halfL - sideInset - 2, -halfW - sideInset - 2],
      ] as const) {
        const c = corner.clone();
        c.position.set(x, 5.5, z);
        this.group.add(c);
      }
    }

    this.mountScoreboard(record, dark, steel, basketball);

    if (record.floodlights && !basketball) {
      const poles: [number, number][] = [
        [-58, -48],
        [58, -48],
      ];
      for (const [x, z] of poles) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 28, 8), dark);
        pole.position.set(x, 14, z);
        this.group.add(pole);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(4.6, 1.15, 2.1),
          new THREE.MeshStandardMaterial({ color: 0xeee8d8, emissive: 0xfff2c8, emissiveIntensity: 0.85 }),
        );
        head.position.set(x, 27.6, z);
        this.group.add(head);
      }
    }

    if (record.tunnel) {
      const tun = new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.2, 8.5), conc);
      tun.position.set(0, 1.6, -halfW - sideInset - 0.8);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.4, 0.35), dark);
      mouth.position.set(0, 1.25, -halfW - sideInset + 3.5);
      this.group.add(tun, mouth);
    }
    // No ceiling / roof canopy — open bowl so the broadcast camera stays clear.
  }

  /**
   * Premiership bowl: taller terraces, continuous curved corners, a low camera-side stand,
   * larger LED house and roof-mounted flood banks — an upgrade of the pro four-stand shell.
   */
  private buildDeluxeShell(
    record: StadiumRecord,
    terracedStand: (
      w: number,
      rows: number,
      x: number,
      z: number,
      rot: number,
      seatColor: THREE.Material,
      opts?: {
        rowDepth?: number;
        rowRise?: number;
        fascia?: THREE.Material;
        cladding?: THREE.Material;
        roofMetal?: THREE.Material;
        omitRoof?: boolean;
        cameraNearRoof?: boolean;
        noRoof?: boolean;
      },
    ) => THREE.Group,
    mats: {
      dark: THREE.MeshStandardMaterial;
      steel: THREE.MeshStandardMaterial;
    },
  ): void {
    const cladding = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.48, metalness: 0.22 });
    const roofMetal = new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.35, metalness: 0.55 });
    const premiumSeat = new THREE.MeshStandardMaterial({ color: 0x0b4a2c, roughness: 0.62 });
    const whiteAcc = new THREE.MeshStandardMaterial({ color: 0xf2f4f0, roughness: 0.55 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x8ec8e8,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.42,
    });
    const goldTrim = new THREE.MeshStandardMaterial({ color: 0xc5a572, roughness: 0.45, metalness: 0.35 });
    const opts = { rowDepth: 0.9, rowRise: 0.62, fascia: goldTrim, cladding, roofMetal };

    const halfL = record.pitchLength / 2;
    const halfW = record.pitchWidth / 2;
    const R = Math.min(DELUXE_BOWL_RADIUS, Math.max(4.5, halfW * 0.7));
    const northRows = 26;
    const endRows = 22;
    const southRows = 12;
    const northRise = 0.62;
    const southRise = 0.48;
    const southDepth = 0.85;
    const rowDepth = 0.9;

    const sideLen = 2 * halfL + 5.5;
    const endLen = 2 * halfW + 5.5;
    terracedStand(sideLen, northRows, 0, -halfW - R, Math.PI, premiumSeat, opts);
    terracedStand(endLen, endRows, halfL + R, 0, Math.PI / 2, premiumSeat, opts);
    terracedStand(endLen, endRows, -halfL - R, 0, -Math.PI / 2, premiumSeat, opts);
    terracedStand(sideLen, southRows, 0, halfW + R, 0, premiumSeat, {
      ...opts,
      rowRise: southRise,
      rowDepth: southDepth,
      omitRoof: true,
      cameraNearRoof: true,
    });

    const cornerMats = { seat: premiumSeat, aisle: whiteAcc, cladding, roof: roofMetal, fascia: goldTrim };
    const over = 0.12;
    this.buildDeluxeCornerArc(halfL, -halfW, -Math.PI / 2 - over, over, northRows, R, rowDepth, northRise, cornerMats);
    this.buildDeluxeCornerArc(-halfL, -halfW, Math.PI - over, (Math.PI * 3) / 2 + over, northRows, R, rowDepth, northRise, cornerMats);
    this.buildDeluxeCornerArc(halfL, halfW, -over, Math.PI / 2 + over, southRows + 2, R, southDepth, southRise, cornerMats, true);
    this.buildDeluxeCornerArc(-halfL, halfW, Math.PI / 2 - over, Math.PI + over, southRows + 2, R, southDepth, southRise, cornerMats, true);

    const suite = new THREE.Mesh(new THREE.BoxGeometry(sideLen * 0.95, 3.2, 6.5), cladding);
    suite.position.set(0, 18.5, -halfW - R - 14);
    this.group.add(suite);
    const suiteGlass = new THREE.Mesh(new THREE.BoxGeometry(sideLen * 0.9, 2.4, 0.35), glass);
    suiteGlass.position.set(0, 18.6, -halfW - R - 10.6);
    this.group.add(suiteGlass);

    this.mountScoreboard(record, mats.dark, mats.steel, false);

    if (record.floodlights) {
      // Roof banks on the far (+north / −Z) corners only. Near-side gantries sat in front of
      // the broadcast camera as solid rectangles even after the south roof was omitted.
      const banks: [number, number, number][] = [
        [-64, -52, 34],
        [64, -52, 34],
      ];
      const lamp = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0c8, emissiveIntensity: 1.05 });
      for (const [x, z, h] of banks) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, h, 10), mats.dark);
        mast.position.set(x, h / 2, z);
        this.group.add(mast);
        const gantry = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.55, 3.4), mats.steel);
        gantry.position.set(x, h + 0.2, z);
        this.group.add(gantry);
        for (const ox of [-3.2, 0, 3.2]) {
          const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 2.0), lamp);
          head.position.set(x + ox, h + 1.0, z);
          this.group.add(head);
        }
      }
    }

    if (record.tunnel) {
      const tun = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.6, 10), cladding);
      tun.position.set(0, 1.8, -halfW - R - 1.2);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.4), mats.dark);
      mouth.position.set(0, 1.35, -halfW - R + 3.6);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.28, 0.35), goldTrim);
      trim.position.set(0, 2.85, -halfW - R + 3.55);
      this.group.add(tun, mouth, trim);
    }
  }

  /**
   * Quarter-circle terrace that joins a sideline stand to an end stand as one continuous bowl.
   * Seat decks, cladding and roof all follow the same arc so the corner reads as a wrap, not a block.
   */
  private buildDeluxeCornerArc(
    cx: number,
    cz: number,
    a0: number,
    a1: number,
    rows: number,
    frontR: number,
    rowDepth: number,
    rowRise: number,
    mats: {
      seat: THREE.Material;
      aisle: THREE.Material;
      cladding: THREE.Material;
      roof: THREE.Material;
      fascia: THREE.Material;
    },
    omitRoof = false,
    noRoof = false,
  ): void {
    const sweep = a1 - a0;
    const steps = 16;
    const g = new THREE.Group();

    for (let r = 0; r < rows; r++) {
      // Match terracedStand row centres: front row sits on the bowl radius R.
      const radius = frontR + r * rowDepth;
      const y = 1.15 + r * rowRise;
      const aisle = r % 6 === 5;
      const chord = (Math.abs(sweep) / steps) * radius * 1.18;
      for (let i = 0; i < steps; i++) {
        const mid = a0 + sweep * ((i + 0.5) / steps);
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(chord, aisle ? 0.18 : 0.38, rowDepth * 0.94),
          aisle ? mats.aisle : mats.seat,
        );
        deck.position.set(cx + Math.cos(mid) * radius, y, cz + Math.sin(mid) * radius);
        // Local +Z faces outward along the arc normal so rows stack away from the pitch.
        deck.rotation.y = Math.PI / 2 - mid;
        deck.receiveShadow = true;
        g.add(deck);
      }
    }

    const backR = frontR + rows * rowDepth + 1.6;
    const backH = rows * rowRise + 5.2;
    const wallSteps = steps + 2;
    const cameraNear = omitRoof || cz > 0;
    // Camera-side corners: seats only — cladding walls / roof / fascia read as a long
    // rectangle across the lens when the near sideline is in frame.
    if (!cameraNear) {
      for (let i = 0; i < wallSteps; i++) {
        const mid = a0 + sweep * ((i + 0.5) / wallSteps);
        const wallChord = (Math.abs(sweep) / wallSteps) * backR * 1.14;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wallChord, backH, 2.5), mats.cladding);
        wall.position.set(cx + Math.cos(mid) * (backR + 0.6), backH / 2, cz + Math.sin(mid) * (backR + 0.6));
        wall.rotation.y = Math.PI / 2 - mid;
        wall.castShadow = true;
        g.add(wall);

        if (!noRoof) {
          const roofR = frontR + rows * rowDepth * 0.55;
          const roofChord = (Math.abs(sweep) / wallSteps) * (roofR + 4) * 1.12;
          const roof = new THREE.Mesh(new THREE.BoxGeometry(roofChord, 0.34, rows * rowDepth + 5.2), mats.roof);
          roof.position.set(
            cx + Math.cos(mid) * roofR,
            rows * rowRise + 6.1,
            cz + Math.sin(mid) * roofR,
          );
          roof.rotation.y = Math.PI / 2 - mid;
          roof.name = "standRoof";
          g.add(roof);
        }
      }

      // Fascia rides on the court-facing face of the grey cladding arc (not floating at the bowl lip).
      const fasciaR = backR - 0.55;
      for (let i = 0; i < steps; i++) {
        const mid = a0 + sweep * ((i + 0.5) / steps);
        const fascia = new THREE.Mesh(
          new THREE.BoxGeometry(((Math.abs(sweep) / steps) * fasciaR) * 1.12, 1.0, 0.28),
          mats.fascia,
        );
        fascia.position.set(
          cx + Math.cos(mid) * fasciaR,
          backH - 0.65,
          cz + Math.sin(mid) * fasciaR,
        );
        fascia.rotation.y = Math.PI / 2 - mid;
        g.add(fascia);
      }
    }

    this.group.add(g);
  }

  private mountScoreboard(
    record: StadiumRecord,
    dark: THREE.Material,
    steel: THREE.Material,
    jumbotron = false,
  ): void {
    const cfg = record.scoreboard;
    if (cfg.type === "NONE") return;
    // Jumbotron cube is self-hung (cables on the Scoreboard mesh) — no overhead truss panel.
    if (jumbotron) return;
    const [x, y, z] = cfg.position;
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.width + 2.4, cfg.height + 2.6, 1.8),
      dark,
    );
    house.position.set(x, y - 0.2, z - 1.15);
    this.group.add(house);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 7.2, 0.32), steel);
    const strutR = strutL.clone();
    strutL.position.set(x - cfg.width * 0.32, y - cfg.height * 0.5 - 2.4, z - 0.7);
    strutR.position.set(x + cfg.width * 0.32, y - cfg.height * 0.5 - 2.4, z - 0.7);
    this.group.add(strutL, strutR);
  }

  private buildPark(): void {
    const halfL = this.record.pitchLength / 2;
    const halfW = this.record.pitchWidth / 2;
    const treeGeo = new THREE.ConeGeometry(2.2, 6, 7);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1d5c32, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22 });
    for (let i = 0; i < 18; i++) {
      // Keep trees off the grass — ring outside the pitch apron.
      const x = (i % 2 === 0 ? 1 : -1) * (halfL + 8 + (i % 5) * 3);
      const z = i < 8 ? -halfW + 4 + i * 6.5 : halfW * 0.15 + ((i - 8) % 5) * 7;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 2.4, 6), trunkMat);
      trunk.position.set(x, 1.2, z);
      const crown = new THREE.Mesh(treeGeo, treeMat);
      crown.position.set(x, 5.2, z);
      this.group.add(trunk, crown);
    }
    // Footpath outside the +X goal line — clear of pitch + grass apron (park pad = 10).
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(8, Math.min(80, this.record.pitchWidth + 12)),
      new THREE.MeshStandardMaterial({ color: 0xb7a48a, roughness: 1 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(parkPathCentreX(this.record.pitchLength), 0.02, 0);
    path.name = "parkPath";
    this.group.add(path);
  }
}
