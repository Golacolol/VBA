/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { SquadPlayer } from "../core/Database";
import {
  formatCardHeight,
  formatCardWeight,
  formatPlayerCardTeamName,
  playerCardBackBioHtml,
} from "./playerCardShared";

describe("formatPlayerCardTeamName", () => {
  it("keeps fan / current names without season suffixes", () => {
    expect(formatPlayerCardTeamName("Plymouth Argyle Fans")).toBe("Plymouth Argyle Fans");
    expect(formatPlayerCardTeamName("Plymouth Argyle — FANS")).toBe("Plymouth Argyle Fans");
    expect(formatPlayerCardTeamName("Plymouth Argyle - Fans")).toBe("Plymouth Argyle Fans");
    expect(formatPlayerCardTeamName("Plymouth Argyle")).toBe("Plymouth Argyle");
  });

  it("drops the dash and century digits from classic seasons", () => {
    expect(formatPlayerCardTeamName("Inter Milan — 1993/94")).toBe("Inter Milan 93/94");
    expect(formatPlayerCardTeamName("Inter Milan - 1993/94")).toBe("Inter Milan 93/94");
    expect(formatPlayerCardTeamName("Plymouth Argyle — 2021/22")).toBe("Plymouth Argyle 21/22");
    expect(formatPlayerCardTeamName("Chelsea — 2004/05 Mourinho")).toBe("Chelsea 04/05 Mourinho");
    expect(formatPlayerCardTeamName("Liverpool — 2004/05 Istanbul")).toBe("Liverpool 04/05 Istanbul");
  });

  it("formats single-year teams with the full year and no dash", () => {
    expect(formatPlayerCardTeamName("Italy — 1982")).toBe("Italy 1982");
    expect(formatPlayerCardTeamName("Italy - 1982")).toBe("Italy 1982");
    expect(formatPlayerCardTeamName("Portugal — 2016")).toBe("Portugal 2016");
    expect(formatPlayerCardTeamName("Germany — 2014")).toBe("Germany 2014");
    expect(formatPlayerCardTeamName("Boca Juniors — 2000")).toBe("Boca Juniors 2000");
    expect(formatPlayerCardTeamName("Argentina — 2022")).toBe("Argentina 2022");
    expect(formatPlayerCardTeamName("Italy 1982")).toBe("Italy 1982");
  });
});

describe("player card back bio", () => {
  it("formats height and weight in NBA style", () => {
    expect(formatCardHeight(203)).toBe(`6'8" (203 cm)`);
    expect(formatCardWeight(113)).toBe("249 lb (113 kg)");
    expect(formatCardHeight(null)).toBe("");
    expect(formatCardWeight(undefined)).toBe("");
  });

  it("lists compact bio rows and omits empty / removed fields", () => {
    const sp = {
      player: {
        id: "p1",
        name: "Jordan",
        displayName: "M. Jordan",
        primaryPosition: "SG",
        secondaryPositions: ["SF"],
        heightCm: 198,
        weightKg: 98,
        age: 35,
        preferredHand: "R",
        appearance: {
          fullName: "Michael Jeffrey Jordan",
          nickname: "Air Jordan",
          college: "North Carolina",
          birthplace: "Brooklyn, NY, USA",
        },
      },
      membership: { playerId: "p1", teamId: "nba_chi", shirtNumber: 23 },
      attrs: {},
      overall: 99,
      shirtNumber: 23,
    } as unknown as SquadPlayer;

    const html = playerCardBackBioHtml(sp, {
      teamName: "Chicago Bulls — 1995/96",
      teamColor: "#ce1141",
      teamSecondaryColor: "#000",
    });
    expect(html).toContain(">Name<");
    expect(html).toContain("Michael Jeffrey Jordan");
    expect(html).toContain("Chicago Bulls 95/96");
    expect(html).toContain("Air Jordan");
    expect(html).toContain("North Carolina");
    expect(html).toContain("Ht / Wt");
    expect(html).toMatch(/6'6".*216 lb|6'6" · 216 lb/);
    expect(html).toContain("Also Plays");
    expect(html).not.toContain("Birthplace");
    expect(html).not.toContain("Brooklyn");
    expect(html).not.toContain("Hand");
    expect(html).not.toContain("Full Name");
    expect(html).not.toContain(">Position<");

    const sparse = playerCardBackBioHtml(
      {
        ...sp,
        player: {
          ...sp.player,
          appearance: { fullName: "Michael Jeffrey Jordan" },
          heightCm: undefined,
          weightKg: undefined,
          age: undefined,
          secondaryPositions: [],
        },
      } as unknown as SquadPlayer,
      { teamName: "Bulls", teamColor: "#ce1141", teamSecondaryColor: "#000" },
    );
    expect(sparse).toContain("Michael Jeffrey Jordan");
    expect(sparse).not.toContain("Nickname");
    expect(sparse).not.toContain("College");
    expect(sparse).not.toContain("Ht / Wt");
  });
});
