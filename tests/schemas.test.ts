import { describe, it, expect } from "vitest";
import { PoiSchema, PoisSchema, PoiTypeSchema } from "@/lib/schemas/poi";
import {
  OrderSchema,
  OrderStateSchema,
  PlaceOrderRequestSchema,
} from "@/lib/schemas/order";
import {
  ConciergeRequestSchema,
  ConciergeResponseSchema,
} from "@/lib/schemas/concierge";
import { VenueGraphSchema } from "@/lib/schemas/graph";
import rawPois from "@/public/venue/pois.json";
import rawGraph from "@/public/venue/graph.json";

describe("PoiSchema", () => {
  it("accepts every POI in the shipped pois.json", () => {
    expect(() => PoisSchema.parse(rawPois)).not.toThrow();
  });

  it("rejects an unknown POI type", () => {
    const result = PoiSchema.safeParse({
      id: "x",
      name: "X",
      type: "oxygen_bar",
      coords: { x: 0, y: 0 },
      nodeId: "n-x",
    });
    expect(result.success).toBe(false);
  });

  it("only accepts canonical POI types", () => {
    expect(PoiTypeSchema.safeParse("food").success).toBe(true);
    expect(PoiTypeSchema.safeParse("gate").success).toBe(true);
    expect(PoiTypeSchema.safeParse("bar").success).toBe(false);
  });
});

describe("VenueGraphSchema", () => {
  it("accepts the shipped graph.json", () => {
    expect(() => VenueGraphSchema.parse(rawGraph)).not.toThrow();
  });

  it("rejects edges with negative weight", () => {
    const result = VenueGraphSchema.safeParse({
      nodes: [{ id: "A", x: 0, y: 0 }],
      edges: [{ from: "A", to: "A", weight: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("OrderSchema", () => {
  it("accepts a well-formed order", () => {
    const order = {
      id: "ord-1",
      userId: "user-1",
      poiId: "food-beer",
      poiName: "Beer Garden",
      items: [{ id: "beer", name: "IPA", priceCents: 800, qty: 2 }],
      totalCents: 1600,
      pickupCode: "4321",
      state: "placed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(() => OrderSchema.parse(order)).not.toThrow();
  });

  it("rejects a pickup code of the wrong length", () => {
    const result = OrderSchema.safeParse({
      id: "ord-1",
      userId: "u",
      poiId: "p",
      poiName: "P",
      items: [{ id: "i", name: "I", priceCents: 1, qty: 1 }],
      totalCents: 1,
      pickupCode: "123",
      state: "placed",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(result.success).toBe(false);
  });

  it("only allows the canonical state machine transitions", () => {
    for (const state of ["placed", "preparing", "ready", "collected"]) {
      expect(OrderStateSchema.safeParse(state).success).toBe(true);
    }
    expect(OrderStateSchema.safeParse("refunded").success).toBe(false);
  });

  it("rejects place-order requests with zero items", () => {
    const result = PlaceOrderRequestSchema.safeParse({
      poiId: "food-beer",
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("ConciergeRequestSchema", () => {
  it("requires at least one message", () => {
    const result = ConciergeRequestSchema.safeParse({
      messages: [],
      userLocation: { nodeId: "n-seat" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid request", () => {
    const result = ConciergeRequestSchema.safeParse({
      messages: [{ role: "user", content: "shortest beer line" }],
      userLocation: { nodeId: "n-seat" },
    });
    expect(result.success).toBe(true);
  });
});

describe("ConciergeResponseSchema", () => {
  it("accepts a well-formed response with no recommendation", () => {
    const res = ConciergeResponseSchema.safeParse({
      reply: "No food POIs available right now.",
      recommendation: null,
      action: "info",
    });
    expect(res.success).toBe(true);
  });

  it("rejects density out of [0,1]", () => {
    const res = ConciergeResponseSchema.safeParse({
      reply: "go here",
      recommendation: {
        poiId: "food-beer",
        poiName: "Beer",
        walkTimeSec: 30,
        currentDensity: 1.5,
        reason: "short line",
      },
      action: "navigate",
    });
    expect(res.success).toBe(false);
  });
});
