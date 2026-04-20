import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/firebase/performance.ts
 *
 * Firebase Performance Monitoring captures custom traces and Core Web
 * Vitals (LCP, TTI) and sends them to the Firebase console. StadiumIQ
 * uses named traces to measure critical user flows:
 *
 *   - "concierge_request"  — AI concierge round-trip latency
 *   - "route_compute"      — Dijkstra pathfinding on the venue graph
 *   - "heatmap_refresh"    — server-sent density snapshot fetch
 *   - "order_place"        — order API round-trip
 *
 * These tests verify that the helpers gracefully handle SSR/browser
 * boundaries and never throw when Performance Monitoring is unavailable.
 */

// ── Mock the Firebase Performance SDK ─────────────────────────────────────
// vi.mock is hoisted — use inline vi.fn() to avoid TDZ errors.

vi.mock("firebase/performance", () => ({
  getPerformance: vi.fn(() => ({})),
  trace: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    putAttribute: vi.fn(),
    putMetric: vi.fn(),
  })),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("@/lib/env", () => ({ hasFirebase: false }));

import {
  startTrace,
  withTrace,
  initPerformance,
} from "@/lib/firebase/performance";

// ── startTrace ─────────────────────────────────────────────────────────────

describe("lib/firebase/performance — startTrace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Firebase is not configured (hasFirebase=false)", () => {
    const t = startTrace("concierge_request");
    expect(t).toBeNull();
  });

  it("does not throw for any valid trace name", () => {
    const names = [
      "concierge_request",
      "route_compute",
      "heatmap_refresh",
      "order_place",
      "page_load",
    ];
    for (const name of names) {
      expect(() => startTrace(name)).not.toThrow();
    }
  });

  it("returns null for all trace names when unconfigured", () => {
    expect(startTrace("any_trace")).toBeNull();
  });
});

// ── withTrace ──────────────────────────────────────────────────────────────

describe("lib/firebase/performance — withTrace", () => {
  it("executes and returns the wrapped async function's result", async () => {
    const result = await withTrace("test_trace", async () => 42);
    expect(result).toBe(42);
  });

  it("propagates errors thrown inside the wrapped function", async () => {
    await expect(
      withTrace("error_trace", async () => {
        throw new Error("inner error");
      }),
    ).rejects.toThrow("inner error");
  });

  it("resolves when the wrapped function returns a string", async () => {
    const result = await withTrace("string_trace", async () => "hello");
    expect(result).toBe("hello");
  });

  it("resolves when the wrapped function returns an object", async () => {
    const obj = { path: ["A", "B"], etaSec: 30 };
    const result = await withTrace("obj_trace", async () => obj);
    expect(result).toEqual(obj);
  });

  it("is generic — works with arbitrary return types", async () => {
    const arr = await withTrace("array_trace", async () => [1, 2, 3]);
    expect(arr).toEqual([1, 2, 3]);
  });

  it("does not throw when startTrace returns null (Firebase unconfigured)", async () => {
    await expect(withTrace("null_trace", async () => "ok")).resolves.toBe("ok");
  });

  it("works with a Promise<void> wrapped function", async () => {
    await expect(withTrace("void_trace", async () => {})).resolves.toBeUndefined();
  });
});

// ── initPerformance ────────────────────────────────────────────────────────

describe("lib/firebase/performance — initPerformance", () => {
  it("does not throw when Firebase is not configured", () => {
    expect(() => initPerformance()).not.toThrow();
  });

  it("is idempotent — calling multiple times never throws", () => {
    expect(() => {
      initPerformance();
      initPerformance();
      initPerformance();
    }).not.toThrow();
  });

  it("returns undefined (void function contract)", () => {
    const result = initPerformance();
    expect(result).toBeUndefined();
  });
});
