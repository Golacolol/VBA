/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { GameDatabase } from "../core/Database";
import { SaveManager } from "../core/SaveManager";
import {
  DEFAULT_PYRAMID_ORDER,
  DEFAULT_PYRAMID_POOL,
  PYRAMID_POOL_SIZE,
  PYRAMID_SIZE,
} from "../football/pyramid/defaultPyramid";
import { PyramidHub } from "./Pyramid";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true });

describe("PyramidHub", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens the pyramid tiers with Top 50 cells and persists reorder", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const save = new SaveManager();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const hub = new PyramidHub(host);
    hub.open(db, save);

    expect(hub.root.classList.contains("open")).toBe(true);
    expect(hub.root.querySelectorAll('.pyramid-cell[data-pyramid-zone="order"]')).toHaveLength(PYRAMID_SIZE);
    expect(hub.root.querySelectorAll(".pyramid-pool-cell")).toHaveLength(PYRAMID_POOL_SIZE);
    expect(hub.root.querySelector(".pyramid-pool-cell .pyramid-cell-rank")?.textContent).toBe("51");
    expect(hub.root.querySelector("[data-pyramid-search]")).toBeTruthy();
    expect(hub.root.querySelector(".pyramid-cell-kit-row")).toBeTruthy();
    expect(hub.root.querySelector(".pyramid-zoom [data-pyramid='zoom-in']")).toBeTruthy();
    expect(hub.root.querySelector(".pyramid-kit-badge .sur")?.textContent).toMatch(/JORDAN/i);
    expect(save.data.pyramid?.order[0]).toBe(DEFAULT_PYRAMID_ORDER[0]);
    expect(save.data.pyramid?.pool).toHaveLength(PYRAMID_POOL_SIZE);

    hub.root.querySelector<HTMLElement>('[data-pyramid="down"][data-index="0"]')?.click();
    expect(save.data.pyramid?.order[0]).toBe(DEFAULT_PYRAMID_ORDER[1]);
    expect(save.data.pyramid?.order[1]).toBe(DEFAULT_PYRAMID_ORDER[0]);

    const beforeLast = save.data.pyramid!.order[PYRAMID_SIZE - 1];
    const elevateId = save.data.pyramid!.pool[0];
    hub.root.querySelector<HTMLElement>('[data-pyramid="elevate"][data-pool-index="0"]')?.click();
    expect(save.data.pyramid?.order[PYRAMID_SIZE - 1]).toBe(elevateId);
    expect(save.data.pyramid?.pool[0]).toBe(beforeLast);

    hub.root.querySelector<HTMLElement>('[data-pyramid="view"][data-view="ring"]')?.click();
    expect(save.data.pyramid?.view).toBe("ring");
    expect(hub.root.querySelector(".pyramid-ring-center .pyramid-ring-card.is-center")).toBeTruthy();
    expect(hub.root.querySelectorAll(".pyramid-ring-node").length).toBe(PYRAMID_SIZE - 1);
    expect(hub.root.querySelectorAll(".pyramid-ring-card").length).toBe(PYRAMID_SIZE);
    expect(hub.root.querySelector(".pyramid-ring-bound")).toBeTruthy();
    expect(hub.root.querySelector(".pyramid-pool")).toBeNull();
    expect(hub.root.querySelector(".pyramid-ring-stage")?.style.getPropertyValue("--ring-orbit-px")).toMatch(/px/);
    const nodes = [...hub.root.querySelectorAll<HTMLElement>(".pyramid-ring-node")];
    expect(nodes.length).toBe(PYRAMID_SIZE - 1);
    const dist = (el: HTMLElement) => {
      const x = Number(/([-\d.]+)px/.exec(el.style.left || "")?.[1] || 0);
      const y = Number(/([-\d.]+)px/.exec(el.style.top || "")?.[1] || 0);
      return Math.hypot(x, y);
    };
    const distances = nodes.map(dist).sort((a, b) => a - b);
    expect(distances[0]!).toBeGreaterThan(20);
    expect(distances[distances.length - 1]!).toBeGreaterThan(distances[0]! + 20);
    expect(nodes.some((n) => Number(n.dataset.scale) < 1)).toBe(true);

    hub.root.querySelector<HTMLElement>('[data-pyramid="view"][data-view="jersey"]')?.click();
    expect(save.data.pyramid?.view).toBe("jersey");
    expect(hub.root.querySelectorAll(".pyramid-jersey-cell").length).toBe(100);
    expect(hub.root.querySelectorAll(".pyramid-jersey-cell.is-filled").length).toBeGreaterThan(40);
    expect(hub.root.querySelector(".pyramid-jersey-name")).toBeNull();
    expect(hub.root.querySelector(".pyramid-jersey-extra")).toBeNull();
    expect(hub.root.querySelector(".pyramid-jersey-cell .pyramid-move")).toBeNull();
    expect(hub.root.querySelector(".pyramid-pool")).toBeNull();

    const filled = hub.root.querySelector<HTMLElement>(".pyramid-jersey-cell.is-filled");
    expect(filled?.querySelector(".pyramid-cell-kit")).toBeTruthy();
    expect(filled?.querySelector(".pyramid-cell-photo")).toBeTruthy();
    filled?.click();
    expect(hub.root.querySelector(".pyramid-jersey-picker")).toBeTruthy();
    hub.root.querySelector<HTMLElement>('[data-pyramid="jersey-close"]')?.click();
    expect(hub.root.querySelector(".pyramid-jersey-picker")).toBeNull();

    hub.root.querySelector<HTMLElement>('[data-pyramid="view"][data-view="draft"]')?.click();
    expect(save.data.pyramid?.view).toBe("draft");
    expect(hub.root.querySelector(".pyramid-draft")).toBeTruthy();
    expect(hub.root.querySelectorAll(".pyramid-draft-seat").length).toBeGreaterThanOrEqual(5);
    expect(hub.root.querySelectorAll(".pyramid-draft-filter").length).toBe(7);
    expect(hub.root.querySelector('[data-pyramid="draft-autofill"]')).toBeTruthy();
    expect(hub.root.querySelector('[data-pyramid="draft-restart"]')).toBeTruthy();

    hub.hide();
    host.remove();
  });

  it("keeps default seed ids that exist in the database", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const missing = [...DEFAULT_PYRAMID_ORDER, ...DEFAULT_PYRAMID_POOL].filter((id) => !db.players.has(id));
    expect(missing).toEqual([]);
  });

  it("switches layout to list from the List control", async () => {
    const db = await GameDatabase.load(new SaveManager());
    const save = new SaveManager();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const hub = new PyramidHub(host);
    hub.open(db, save);

    hub.root.querySelector<HTMLElement>('[data-pyramid="layout"][data-layout="list"]')?.click();
    expect(hub.root.querySelector(".pyramid-tiers.is-list")).toBeTruthy();
    expect(hub.root.querySelector(".pyramid-list-apex")).toBeNull();
    expect(hub.root.querySelector(".pyramid-list-flow")).toBeTruthy();
    const listCells = [...hub.root.querySelectorAll(".pyramid-list-flow .pyramid-cell.is-list-cell")];
    expect(listCells).toHaveLength(PYRAMID_SIZE);
    expect(listCells[0]?.querySelector(".pyramid-cell-rank")?.textContent).toBe("1");
    expect(listCells[1]?.querySelector(".pyramid-cell-rank")?.textContent).toBe("2");
    expect(hub.root.querySelector('[data-layout="list"]')?.classList.contains("on")).toBe(true);

    hub.root.querySelector<HTMLElement>('[data-pyramid="layout"][data-layout="fib"]')?.click();
    expect(hub.root.querySelector('[data-layout="fib"]')?.classList.contains("on")).toBe(true);
    const fibTiers = [...hub.root.querySelectorAll(".pyramid-tiers .pyramid-tier")];
    expect(fibTiers.map((el) => el.querySelectorAll(".pyramid-cell").length)).toEqual([1, 2, 3, 5, 8, 13, 18]);

    hub.hide();
    host.remove();
  });
});
