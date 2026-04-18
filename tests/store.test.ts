import { describe, it, expect, beforeEach } from "vitest";
import { mockStore } from "@/lib/mock/store";

describe("mockStore", () => {
  beforeEach(() => {
    // Re-seed by clearing and re-hydrating from baseline
    const snapshot = mockStore.getAll();
    for (const id of Object.keys(snapshot)) {
      mockStore.set(id, 0);
    }
  });

  it("returns a snapshot when getAll() is called on a fresh store", () => {
    const snapshot = mockStore.getAll();
    expect(Object.keys(snapshot).length).toBeGreaterThan(0);
  });

  it("getAll() returns a copy, not a live reference", () => {
    const a = mockStore.getAll();
    const b = mockStore.getAll();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("set() clamps values into [0, 1]", () => {
    mockStore.set("gate-north", 1.5);
    expect(mockStore.get("gate-north")).toBe(1);

    mockStore.set("gate-north", -0.5);
    expect(mockStore.get("gate-north")).toBe(0);
  });

  it("setMany() applies all updates atomically", () => {
    mockStore.setMany({
      "food-beer": 0.8,
      "food-burger": 0.9,
    });
    expect(mockStore.get("food-beer")).toBe(0.8);
    expect(mockStore.get("food-burger")).toBe(0.9);
  });

  it("get() returns 0 for unknown POI ids", () => {
    expect(mockStore.get("does-not-exist")).toBe(0);
  });

  it("subscribe() fires on set()", () => {
    let called = 0;
    const unsub = mockStore.subscribe(() => {
      called++;
    });
    mockStore.set("gate-north", 0.5);
    expect(called).toBeGreaterThan(0);
    unsub();
  });

  it("unsubscribed listeners stop receiving updates", () => {
    let called = 0;
    const unsub = mockStore.subscribe(() => {
      called++;
    });
    mockStore.set("gate-north", 0.1);
    const countAfterOne = called;
    unsub();
    mockStore.set("gate-north", 0.9);
    expect(called).toBe(countAfterOne);
  });

  it("subscribers receive a fresh snapshot on every notify", () => {
    let last: Record<string, number> | null = null;
    const unsub = mockStore.subscribe((map) => {
      last = map;
    });
    mockStore.set("gate-north", 0.42);
    expect(last).not.toBeNull();
    expect(last!["gate-north"]).toBe(0.42);
    unsub();
  });
});
