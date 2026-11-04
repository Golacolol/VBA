import * as THREE from "three";
import { COURT_LENGTH, RIM_HEIGHT, RIM_RADIUS, BACKBOARD_WIDTH, BACKBOARD_HEIGHT } from "../constants";

/** Basketball hoops at each baseline (replaces football goals). */
export function createHoops(halfLength = COURT_LENGTH / 2): THREE.Group {
  const group = new THREE.Group();
  group.name = "hoops";
  group.add(buildHoop(halfLength));
  group.add(buildHoop(-halfLength));
  return group;
}

function buildHoop(x: number): THREE.Group {
  const g = new THREE.Group();
  const dir = x >= 0 ? 1 : -1;
  const orange = new THREE.MeshStandardMaterial({ color: 0xe87722, roughness: 0.45, metalness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xdfe8f2,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.4, metalness: 0.55 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x1d428a, roughness: 0.7 });

  // Support stanchion behind the baseline
  const stanchionX = x + dir * 1.85;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, RIM_HEIGHT + 0.4, 0.35), steel);
  post.position.set(stanchionX, (RIM_HEIGHT + 0.4) / 2, 0);
  post.castShadow = true;
  g.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.18), steel);
  arm.position.set(x + dir * 0.95, RIM_HEIGHT + 0.15, 0);
  g.add(arm);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, BACKBOARD_HEIGHT, BACKBOARD_WIDTH), glass);
  board.position.set(x + dir * 0.35, RIM_HEIGHT + 0.45, 0);
  board.castShadow = true;
  g.add(board);

  // Target square
  const square = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.45, 0.59),
    new THREE.MeshStandardMaterial({ color: 0xe87722, roughness: 0.5 }),
  );
  square.position.set(x + dir * 0.28, RIM_HEIGHT + 0.2, 0);
  g.add(square);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_RADIUS, 0.03, 10, 24), orange);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x - dir * 0.22, RIM_HEIGHT, 0);
  rim.castShadow = true;
  g.add(rim);

  // Soft net suggestion
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(RIM_RADIUS * 0.95, RIM_RADIUS * 0.55, 0.45, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  net.position.set(x - dir * 0.22, RIM_HEIGHT - 0.28, 0);
  g.add(net);

  const basePad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.4), pad);
  basePad.position.set(stanchionX, 0.55, 0);
  g.add(basePad);

  return g;
}
