/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { kitMarkerHtml } from "./Portrait";
import { menuPlayerPngsEnabled, setMenuPlayerPngsEnabled } from "./menuPlayerPngs";

describe("menuPlayerPngs", () => {
  afterEach(() => {
    setMenuPlayerPngsEnabled(false);
  });

  it("defaults off", () => {
    setMenuPlayerPngsEnabled(false);
    expect(menuPlayerPngsEnabled()).toBe(false);
  });

  it("kit markers use jersey badge when PNGs are off", () => {
    setMenuPlayerPngsEnabled(false);
    const html = kitMarkerHtml(
      { id: "p1", name: "Test Player", appearance: { portraitAsset: "/assets/portraits/classic/ray-allen.png" } },
      34,
      { primaryColor: "#c8102e" },
    );
    expect(html).toContain("portrait-badge-kit");
    expect(html).not.toContain("kit-marker-photo");
    expect(html).not.toContain("<img");
  });

  it("kit markers can still show PNGs when the option is on", () => {
    setMenuPlayerPngsEnabled(true);
    const html = kitMarkerHtml(
      { id: "p1", name: "Test Player", appearance: { portraitAsset: "/assets/portraits/classic/ray-allen.png" } },
      34,
      { primaryColor: "#c8102e" },
    );
    expect(html).toContain("kit-marker-photo");
    expect(html).toContain("<img");
  });

  it("Pyramid forcePortrait still shows PNGs while the option is off", () => {
    setMenuPlayerPngsEnabled(false);
    const html = kitMarkerHtml(
      { id: "p1", name: "Test Player", appearance: { portraitAsset: "/assets/portraits/classic/ray-allen.png" } },
      34,
      { primaryColor: "#c8102e", forcePortrait: true },
    );
    expect(html).toContain("kit-marker-photo");
    expect(html).toContain("<img");
  });
});
