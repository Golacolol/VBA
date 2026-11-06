/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { SettingsMenu } from "./Settings";
import { DEFAULT_SETTINGS } from "../core/SaveManager";

describe("Options → Player PNGs persistence", () => {
  it("keeps showMenuPlayerPngs when saving after switching away from Display", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const settings = new SettingsMenu(host);

    settings.render(
      { ...DEFAULT_SETTINGS, showMenuPlayerPngs: false },
      [],
      { embedHost: host, section: "display" },
    );

    const checkbox = host.querySelector("#menu-player-pngs") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.checked = true;

    // Leave Display (snapshot merges the checked flag into the Options session base).
    host.querySelector<HTMLButtonElement>('[data-options-tab="match"]')!.click();
    expect(host.querySelector("#menu-player-pngs")).toBeNull();

    const patch = settings.read();
    expect(patch.showMenuPlayerPngs).toBe(true);

    settings.hide();
    host.remove();
  });
});
