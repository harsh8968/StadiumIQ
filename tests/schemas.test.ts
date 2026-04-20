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

// ── CrowdDensitySchema ─────────────────────────────────────────────────────

import { DensitySchema, CrowdStateSchema } from "@/lib/schemas/crowd";

describe("DensitySchema", () => {
  it("accepts a valid density reading", () => {
    const result = DensitySchema.safeParse({
      poiId: "food-burger",
      density: 0.75,
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects density below 0", () => {
    const result = DensitySchema.safeParse({
      poiId: "food-burger",
      density: -0.1,
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects density above 1", () => {
    const result = DensitySchema.safeParse({
      poiId: "food-burger",
      density: 1.1,
      timestamp: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it("accepts density exactly at 0", () => {
    const result = DensitySchema.safeParse({
      poiId: "restroom-a",
      density: 0,
      timestamp: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts density exactly at 1", () => {
    const result = DensitySchema.safeParse({
      poiId: "gate-north",
      density: 1,
      timestamp: 2000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing poiId", () => {
    const result = DensitySchema.safeParse({ density: 0.5, timestamp: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing timestamp", () => {
    const result = DensitySchema.safeParse({ poiId: "x", density: 0.5 });
    expect(result.success).toBe(false);
  });
});

describe("CrowdStateSchema", () => {
  it("accepts an empty crowd state (no pois active)", () => {
    const result = CrowdStateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid crowd state with multiple POIs", () => {
    const result = CrowdStateSchema.safeParse({
      "food-burger": { poiId: "food-burger", density: 0.4, timestamp: 1000 },
      "restroom-a": { poiId: "restroom-a", density: 0.9, timestamp: 1001 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a crowd state where a POI density is out of range", () => {
    const result = CrowdStateSchema.safeParse({
      "food-burger": { poiId: "food-burger", density: 2.0, timestamp: 1000 },
    });
    expect(result.success).toBe(false);
  });
});

// ── GroupSessionSchema / MemberPinSchema ───────────────────────────────────

import {
  GroupSessionSchema,
  MemberPinSchema,
  JoinSessionInputSchema,
} from "@/lib/schemas/session";

describe("MemberPinSchema", () => {
  it("accepts a valid member pin with coords", () => {
    const result = MemberPinSchema.safeParse({
      userId: "u-1",
      displayName: "Harsh",
      poiId: "food-burger",
      coords: { x: 120, y: 80 },
      updatedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a member pin with null poiId and null coords", () => {
    const result = MemberPinSchema.safeParse({
      userId: "u-2",
      displayName: "Priya",
      poiId: null,
      coords: null,
      updatedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing userId", () => {
    const result = MemberPinSchema.safeParse({
      displayName: "No ID",
      poiId: null,
      coords: null,
      updatedAt: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("GroupSessionSchema", () => {
  it("accepts a valid group session", () => {
    const result = GroupSessionSchema.safeParse({
      code: "ABC123",
      createdBy: "u-1",
      members: [
        {
          userId: "u-1",
          displayName: "Harsh",
          poiId: null,
          coords: null,
          updatedAt: Date.now(),
        },
      ],
      createdAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a code shorter than 6 characters", () => {
    const result = GroupSessionSchema.safeParse({
      code: "AB",
      createdBy: "u-1",
      members: [],
      createdAt: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a code longer than 6 characters", () => {
    const result = GroupSessionSchema.safeParse({
      code: "ABCDEFG",
      createdBy: "u-1",
      members: [],
      createdAt: Date.now(),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty members array", () => {
    const result = GroupSessionSchema.safeParse({
      code: "XYZ999",
      createdBy: "u-leader",
      members: [],
      createdAt: 1000,
    });
    expect(result.success).toBe(true);
  });
});

describe("JoinSessionInputSchema", () => {
  it("accepts a valid join input", () => {
    const result = JoinSessionInputSchema.safeParse({
      code: "ABC123",
      userId: "u-2",
      displayName: "Priya",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a code that is not exactly 6 characters", () => {
    const result = JoinSessionInputSchema.safeParse({
      code: "SHORT",
      userId: "u-2",
      displayName: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing displayName", () => {
    const result = JoinSessionInputSchema.safeParse({
      code: "ABC123",
      userId: "u-2",
    });
    expect(result.success).toBe(false);
  });
});
