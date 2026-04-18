import { describe, it, expect } from "vitest";
import { estimateWaitSec } from "@/lib/mock/waitTime";

describe("estimateWaitSec", () => {
  it("returns 0 for zero density, regardless of POI type", () => {
    expect(estimateWaitSec(0, "food")).toBe(0);
    expect(estimateWaitSec(0, "restroom")).toBe(0);
    expect(estimateWaitSec(0, "gate")).toBe(0);
    expect(estimateWaitSec(0, "merch")).toBe(0);
  });

  it("scales food wait linearly up to 600s at density 1.0", () => {
    expect(estimateWaitSec(0.5, "food")).toBe(300);
    expect(estimateWaitSec(1.0, "food")).toBe(600);
  });

  it("scales restroom wait linearly up to 240s at density 1.0", () => {
    expect(estimateWaitSec(0.5, "restroom")).toBe(120);
    expect(estimateWaitSec(1.0, "restroom")).toBe(240);
  });

  it("clamps out-of-range densities into [0,1]", () => {
    expect(estimateWaitSec(-0.5, "food")).toBe(0);
    expect(estimateWaitSec(1.5, "food")).toBe(600);
    expect(estimateWaitSec(99, "restroom")).toBe(240);
  });

  it("returns 0 for POI types without queues", () => {
    expect(estimateWaitSec(0.9, "gate")).toBe(0);
    expect(estimateWaitSec(0.9, "merch")).toBe(0);
    expect(estimateWaitSec(0.9, "firstaid")).toBe(0);
  });

  it("is monotonic non-decreasing in density for queued POIs", () => {
    let prev = 0;
    for (let d = 0; d <= 1; d += 0.1) {
      const w = estimateWaitSec(d, "food");
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });
});
