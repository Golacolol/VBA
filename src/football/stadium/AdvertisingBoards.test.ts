import { describe, expect, it } from "vitest";
import { COURT_LENGTH, COURT_WIDTH, HALF_LENGTH, HALF_WIDTH } from "../constants";
import { pitchAdSpans } from "./AdvertisingBoards";

describe("court advertising boards", () => {
  it("runs along both sidelines and both baselines", () => {
    const spans = pitchAdSpans(COURT_LENGTH, COURT_WIDTH);
    expect(spans.length).toBeGreaterThan(4);

    const sideline = spans.filter((s) => Math.abs(s.z) > HALF_WIDTH);
    const baseline = spans.filter((s) => Math.abs(s.x) > HALF_LENGTH);
    expect(sideline.length).toBeGreaterThan(0);
    expect(baseline.length).toBeGreaterThan(0);
  });
});
