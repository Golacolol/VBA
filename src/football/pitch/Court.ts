import * as THREE from "three";
import type { EnvironmentPreset } from "../environment/Environment";
import {
  COURT_LENGTH,
  COURT_WIDTH,
  KEY_LENGTH,
  KEY_WIDTH,
  THREE_POINT_RADIUS,
  FREE_THROW_LINE,
  CENTER_CIRCLE_RADIUS,
  RESTRICTED_AREA_RADIUS,
} from "../constants";

const LINE = 0.08;

/** Hardwood NBA court with key, free-throw, and three-point markings. */
export function createCourt(length = COURT_LENGTH, width = COURT_WIDTH): THREE.Group {
  const group = new THREE.Group();
  const halfL = length / 2;
  const halfW = width / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(length + 2.4, width + 2.4),
    new THREE.MeshStandardMaterial({
      map: hardwoodTexture(),
      roughness: 0.52,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "grass"; // reuse Pitch weather target name
  group.add(floor);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(length + 14, width + 12),
    new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.92 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.03;
  apron.receiveShadow = true;
  apron.name = "surround";
  group.add(apron);

  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f8,
    roughness: 0.4,
    emissive: 0x222222,
    emissiveIntensity: 0.06,
  });
  const paintMat = new THREE.MeshStandardMaterial({
    color: 0x1d428a,
    roughness: 0.55,
    transparent: true,
    opacity: 0.35,
  });

  const addLine = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), lineMat);
    m.position.set(x, 0.02, z);
    m.receiveShadow = true;
    group.add(m);
  };

  // Boundary
  addLine(length, LINE, 0, halfW);
  addLine(length, LINE, 0, -halfW);
  addLine(LINE, width, halfL, 0);
  addLine(LINE, width, -halfL, 0);
  // Half-court
  addLine(LINE, width, 0, 0);

  // Centre circle
  const centre = new THREE.Mesh(
    new THREE.RingGeometry(CENTER_CIRCLE_RADIUS - LINE / 2, CENTER_CIRCLE_RADIUS + LINE / 2, 64),
    lineMat,
  );
  centre.rotation.x = -Math.PI / 2;
  centre.position.y = 0.022;
  group.add(centre);

  const addKey = (dir: number) => {
    const keyX = dir * (halfL - KEY_LENGTH / 2);
    // Painted lane
    const paint = new THREE.Mesh(new THREE.BoxGeometry(KEY_LENGTH, 0.012, KEY_WIDTH), paintMat);
    paint.position.set(keyX, 0.015, 0);
    group.add(paint);
    addLine(KEY_LENGTH, LINE, keyX, KEY_WIDTH / 2);
    addLine(KEY_LENGTH, LINE, keyX, -KEY_WIDTH / 2);
    addLine(LINE, KEY_WIDTH, dir * (halfL - KEY_LENGTH), 0);
    // Free-throw line
    const ftx = dir * (halfL - FREE_THROW_LINE);
    addLine(LINE, KEY_WIDTH, ftx, 0);
    const ftCircle = new THREE.Mesh(
      new THREE.RingGeometry(CENTER_CIRCLE_RADIUS - LINE / 2, CENTER_CIRCLE_RADIUS + LINE / 2, 48),
      lineMat,
    );
    ftCircle.rotation.x = -Math.PI / 2;
    ftCircle.position.set(ftx, 0.022, 0);
    group.add(ftCircle);
    // Restricted area arc near rim
    const restr = new THREE.Mesh(
      new THREE.RingGeometry(RESTRICTED_AREA_RADIUS - LINE / 2, RESTRICTED_AREA_RADIUS + LINE / 2, 32, 1, dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI),
      lineMat,
    );
    restr.rotation.x = -Math.PI / 2;
    restr.position.set(dir * (halfL - 1.22), 0.022, 0);
    group.add(restr);
  };
  addKey(1);
  addKey(-1);

  // Three-point arcs (simplified full semicircle + corners)
  const addThree = (dir: number) => {
    const cornerDist = halfW - 0.91;
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(THREE_POINT_RADIUS - LINE / 2, THREE_POINT_RADIUS + LINE / 2, 64, 1, dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI),
      lineMat,
    );
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(dir * (halfL - 1.575), 0.023, 0);
    group.add(arc);
    // Corner straight segments
    const cornerX = dir * (halfL - 4.27);
    addLine(Math.abs(halfL - Math.abs(cornerX) - 0.2), LINE, dir * ((halfL + Math.abs(cornerX)) / 2 - 0.1), cornerDist);
    addLine(Math.abs(halfL - Math.abs(cornerX) - 0.2), LINE, dir * ((halfL + Math.abs(cornerX)) / 2 - 0.1), -cornerDist);
  };
  addThree(1);
  addThree(-1);

  return group;
}

function hardwoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const planks = 28;
    for (let i = 0; i < planks; i++) {
      const t = i / planks;
      const base = 150 + Math.floor(Math.sin(t * 9) * 18);
      ctx.fillStyle = `rgb(${base + 20},${base - 10},${base - 40})`;
      ctx.fillRect(0, (i * canvas.height) / planks, canvas.width, canvas.height / planks + 1);
      ctx.fillStyle = `rgba(0,0,0,${0.04 + (i % 2) * 0.03})`;
      ctx.fillRect(0, (i * canvas.height) / planks, canvas.width, 2);
    }
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 12;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export function applyCourtWeather(court: THREE.Group, env: EnvironmentPreset): void {
  const floor = court.getObjectByName("grass") as THREE.Mesh | undefined;
  if (!floor) return;
  const mat = floor.material as THREE.MeshStandardMaterial;
  mat.roughness = Math.min(0.85, 0.45 + env.pitchWetness * 0.25);
  mat.metalness = env.pitchWetness * 0.08;
  mat.needsUpdate = true;
}
