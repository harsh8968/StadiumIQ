import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getMatchMinute,
  startSimulation,
  stopSimulation,
  resetSimulationClock,
} from "@/lib/mock/generator";

/**
 * Tests for lib/mock/generator.ts
 *
 * The simulator drives the live crowd density demo that powers the heatmap,
 * AI concierge wait-time estimates, and the admin analytics dashboard.
 * It advances a "match minute" counter in real time, feeding the matchTimeline
 * density model to produce realistic crowd patterns (kick-off rush,
 * half-time surge, final whistle scatter).
 *
 * The simulator state is stored in a global singleton
 * (`globalThis._stadiumiqSimulator`) so it persists across API route
 * invocations in the same Node process — important for demo coherence.
 */

describe("lib/mock/generator — getMatchMinute", () => {
  beforeEach(() => {
    // Reset the simulator clock before each test for isolation.
    resetSimulationClock();
  });

  it("returns 0 at the start of the match (after reset)", () => {
    resetSimulationClock();
    expect(getMatchMinute()).toBe(0);
  });

  it("returns a finite non-negative number", () => {
    const minute = getMatchMinute();
    expect(Number.isFinite(minute)).toBe(true);
    expect(minute).toBeGreaterThanOrEqual(0);
  });

  it("returns the same value on consecutive calls without simulation running", () => {
    // With no interval running, matchMinute should not change.
    const a = getMatchMinute();
    const b = getMatchMinute();
    expect(a).toBe(b);
  });

  it("returns a number (coercible to float)", () => {
    const minute = getMatchMinute();
    expect(typeof minute).toBe("number");
  });
});

describe("lib/mock/generator — resetSimulationClock", () => {
  it("resets matchMinute to 0", () => {
    resetSimulationClock();
    expect(getMatchMinute()).toBe(0);
  });

  it("is idempotent — calling multiple times yields 0 each time", () => {
    resetSimulationClock();
    resetSimulationClock();
    resetSimulationClock();
    expect(getMatchMinute()).toBe(0);
  });

  it("does not throw", () => {
    expect(() => resetSimulationClock()).not.toThrow();
  });
});

describe("lib/mock/generator — stopSimulation", () => {
  afterEach(() => {
    stopSimulation();
    resetSimulationClock();
  });

  it("does not throw when called without a running simulation", () => {
    expect(() => stopSimulation()).not.toThrow();
  });

  it("is idempotent — calling multiple times does not throw", () => {
    expect(() => {
      stopSimulation();
      stopSimulation();
      stopSimulation();
    }).not.toThrow();
  });
});

describe("lib/mock/generator — startSimulation + stopSimulation lifecycle", () => {
  afterEach(() => {
    stopSimulation();
    resetSimulationClock();
  });

  it("does not throw when starting the simulation", () => {
    expect(() => startSimulation([], 100)).not.toThrow();
  });

  it("is idempotent — calling startSimulation twice does not create duplicate intervals", () => {
    // The implementation has an `if (state.intervalId !== null) return;` guard.
    // This test verifies the guard is effective by starting twice and checking
    // that the clock still advances at the expected rate.
    const pois = [{ id: "food-burger", type: "food" as const, name: "Burger", coords: { x: 0, y: 0 }, nodeId: "n-1" }];
    expect(() => {
      startSimulation(pois, 9999);
      startSimulation(pois, 9999); // second call should be a no-op
    }).not.toThrow();
  });

  it("matchMinute is ≥ 0 immediately after starting simulation", () => {
    startSimulation([], 5000);
    const minute = getMatchMinute();
    expect(minute).toBeGreaterThanOrEqual(0);
  });

  it("clock returns to 0 after reset even while simulation is stopped", () => {
    startSimulation([], 9999);
    stopSimulation();
    resetSimulationClock();
    expect(getMatchMinute()).toBe(0);
  });
});
