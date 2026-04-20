import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => ({
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
  Timestamp: { fromMillis: vi.fn((m) => `ts-${m}`) },
}));

vi.mock("@/lib/firebase/client", () => ({
  getDb: vi.fn(() => "mock-db"),
}));

// We need to control env.hasFirebase per test, but ESM mocks are hoisted.
// So we mock window to simulate browser vs SSR instead.
vi.mock("@/lib/env", () => ({
  hasFirebase: true,
}));

import { mirrorOrderToFirestore, logConciergeQuery } from "@/lib/firebase/orders";
import { setDoc, addDoc, doc, collection } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { Order } from "@/lib/schemas/order";

const sampleOrder: Order = {
  id: "order-123",
  state: "placed",
  userId: "user-1",
  items: [
    { id: "hotdog", name: "Hot Dog", priceCents: 500, qty: 2 }
  ],
  totalCents: 1000,
  poiId: "p-1",
  poiName: "Main Concessions",
  pickupCode: "1234",
  createdAt: 1000000,
  updatedAt: 1000000,
};

describe("lib/firebase/orders — mirrorOrderToFirestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate browser environment
    vi.stubGlobal("window", {});
  });

  it("does nothing without a window (SSR)", async () => {
    vi.unstubAllGlobals();
    await mirrorOrderToFirestore(sampleOrder);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("saves the order when in a browser environment", async () => {
    await mirrorOrderToFirestore(sampleOrder);
    expect(getDb).toHaveBeenCalled();
    expect(doc).toHaveBeenCalledWith("mock-db", "orders", "order-123");
    expect(setDoc).toHaveBeenCalled();
  });

  it("catches and swallows errors seamlessly", async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(new Error("Network Error"));
    await expect(mirrorOrderToFirestore(sampleOrder)).resolves.not.toThrow();
  });
});

describe("lib/firebase/orders — logConciergeQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {});
  });

  it("does nothing without a window (SSR)", async () => {
    vi.unstubAllGlobals();
    await logConciergeQuery("u-1", "query", null);
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("adds document to the concierge_queries collection", async () => {
    await logConciergeQuery("u-1", "Where's the food?", "rec-1");
    expect(getDb).toHaveBeenCalled();
    expect(collection).toHaveBeenCalledWith("mock-db", "concierge_queries");
    expect(addDoc).toHaveBeenCalled();
  });

  it("truncates very long queries", async () => {
    const longQuery = "a".repeat(1000);
    await logConciergeQuery("u-1", longQuery, null);
    expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
      query: "a".repeat(500),
    }));
  });

  it("catches and swallows errors seamlessly", async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error("Network down"));
    await expect(logConciergeQuery("u-1", "test", null)).resolves.not.toThrow();
  });
});
