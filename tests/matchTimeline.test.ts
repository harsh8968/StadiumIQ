import { describe, it, expect } from "vitest";
import { densityFor } from "@/lib/mock/matchTimeline";

describe("densityFor", () => {
  it("produces densities in [0, 1] for every minute of a match window", () => {
    for (let m = -20; m <= 120; m++) {
      for (const type of ["gate", "food", "restroom", "merch", "firstaid"] as const) {
        const d = densityFor(m, type);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
      }
    }
  });

  it("spikes gate density during pre-game rush (-15 to 0)", () => {
    const preGame = densityFor(-10, "gate");
    const midGame = densityFor(30, "gate");
    expect(preGame).toBeGreaterThan(midGame);
    expect(preGame).toBeGreaterThan(0.8);
  });

  it("spikes gate density again at post-game exit (90 to 110)", () => {
    const exit = densityFor(100, "gate");
    expect(exit).toBeGreaterThan(0.8);
  });

  it("spikes food density during halftime (44-52)", () => {
    const halftime = densityFor(48, "food");
    const firstHalf = densityFor(20, "food");
    expect(halftime).toBeGreaterThan(firstHalf);
    expect(halftime).toBeGreaterThan(0.75);
  });

  it("caps restroom density at 0.75 even at halftime peak", () => {
    for (let m = 44; m <= 60; m++) {
      const d = densityFor(m, "restroom");
      expect(d).toBeLessThanOrEqual(0.75);
    }
  });

  it("is deterministic — same inputs always produce same output", () => {
    expect(densityFor(45, "food")).toBe(densityFor(45, "food"));
    expect(densityFor(-5, "gate")).toBe(densityFor(-5, "gate"));
  });

  it("first-aid density is always low (<= ~0.15)", () => {
    for (let m = 0; m <= 110; m++) {
      expect(densityFor(m, "firstaid")).toBeLessThanOrEqual(0.2);
    }
  });
});
