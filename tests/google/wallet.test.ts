import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildOrderReceiptPassPayload,
  buildEventTicketPassPayload,
  buildSaveToWalletUrl,
  buildDemoWalletUrl,
  isWalletConfigured,
  type OrderPassData,
  type EventTicketPassData,
} from "@/lib/google/wallet";

const sampleOrder: OrderPassData = {
  orderId: "ord-abc123",
  poiName: "Burger Stand — Gate B",
  pickupCode: "4821",
  totalCents: 2900,
  createdAt: "2026-04-20T10:30:00.000Z",
  fanName: "Harsh Patil",
};

const sampleTicket: EventTicketPassData = {
  ticketId: "tkt-xyz789",
  venueName: "Wankhede Stadium",
  seat: "Stand A, Row 12, Seat 34",
  eventName: "Mumbai Indians vs CSK",
  eventDate: "2026-04-25T14:00:00.000Z",
  barcode: "QR-tkt-xyz789-gate3",
};

// ── buildOrderReceiptPassPayload ───────────────────────────────────────────

describe("lib/google/wallet — buildOrderReceiptPassPayload", () => {
  it("returns an object with the Google Wallet 'savetowallet' typ", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as Record<string, unknown>;
    expect(payload.typ).toBe("savetowallet");
  });

  it("targets the Google Wallet audience", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as Record<string, unknown>;
    expect(payload.aud).toBe("google");
  });

  it("embeds the pickup code as the pass header", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ header: { defaultValue: { value: string } } }> };
    };
    const obj = payload.payload.genericObjects[0];
    expect(obj.header.defaultValue.value).toBe("4821");
  });

  it("includes the POI name in textModulesData", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ textModulesData: Array<{ id: string; body: string }> }> };
    };
    const modules = payload.payload.genericObjects[0].textModulesData;
    const poi = modules.find((m) => m.id === "poi");
    expect(poi?.body).toBe("Burger Stand — Gate B");
  });

  it("formats the order total correctly (cents → dollars)", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ textModulesData: Array<{ id: string; body: string }> }> };
    };
    const modules = payload.payload.genericObjects[0].textModulesData;
    const total = modules.find((m) => m.id === "total");
    expect(total?.body).toBe("$29.00");
  });

  it("uses a QR_CODE barcode type containing the order ID", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ barcode: { type: string; value: string } }> };
    };
    const barcode = payload.payload.genericObjects[0].barcode;
    expect(barcode.type).toBe("QR_CODE");
    expect(barcode.value).toBe("ord-abc123");
  });

  it("sets the pass state to ACTIVE", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ state: string }> };
    };
    expect(payload.payload.genericObjects[0].state).toBe("ACTIVE");
  });

  it("sets a dark background colour consistent with StadiumIQ brand", () => {
    const payload = buildOrderReceiptPassPayload(sampleOrder) as {
      payload: { genericObjects: Array<{ hexBackgroundColor: string }> };
    };
    expect(payload.payload.genericObjects[0].hexBackgroundColor).toBe("#0f172a");
  });
});

// ── buildEventTicketPassPayload ────────────────────────────────────────────

describe("lib/google/wallet — buildEventTicketPassPayload", () => {
  it("returns an object with the Google Wallet 'savetowallet' typ", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as Record<string, unknown>;
    expect(payload.typ).toBe("savetowallet");
  });

  it("embeds the seat label as the pass header", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as {
      payload: { genericObjects: Array<{ header: { defaultValue: { value: string } } }> };
    };
    expect(payload.payload.genericObjects[0].header.defaultValue.value).toBe(
      "Stand A, Row 12, Seat 34",
    );
  });

  it("embeds the venue name as the subheader", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as {
      payload: { genericObjects: Array<{ subheader: { defaultValue: { value: string } } }> };
    };
    expect(payload.payload.genericObjects[0].subheader.defaultValue.value).toBe(
      "Wankhede Stadium",
    );
  });

  it("puts the event name in the card title", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as {
      payload: { genericObjects: Array<{ cardTitle: { defaultValue: { value: string } } }> };
    };
    expect(payload.payload.genericObjects[0].cardTitle.defaultValue.value).toBe(
      "Mumbai Indians vs CSK",
    );
  });

  it("includes a QR_CODE barcode with the gate barcode value", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as {
      payload: { genericObjects: Array<{ barcode: { type: string; value: string } }> };
    };
    const barcode = payload.payload.genericObjects[0].barcode;
    expect(barcode.type).toBe("QR_CODE");
    expect(barcode.value).toBe("QR-tkt-xyz789-gate3");
  });

  it("includes a ticket_id text module", () => {
    const payload = buildEventTicketPassPayload(sampleTicket) as {
      payload: { genericObjects: Array<{ textModulesData: Array<{ id: string; body: string }> }> };
    };
    const modules = payload.payload.genericObjects[0].textModulesData;
    const ticketMod = modules.find((m) => m.id === "ticket_id");
    expect(ticketMod?.body).toBe("tkt-xyz789");
  });
});

// ── buildSaveToWalletUrl ───────────────────────────────────────────────────

describe("lib/google/wallet — buildSaveToWalletUrl", () => {
  it("prepends the Google Wallet save base URL", () => {
    const url = buildSaveToWalletUrl("my-signed-jwt");
    expect(url).toContain("https://pay.google.com/gp/v/save/");
  });

  it("appends the JWT directly after the base URL", () => {
    const url = buildSaveToWalletUrl("tok.en.here");
    expect(url).toBe("https://pay.google.com/gp/v/save/tok.en.here");
  });
});

// ── buildDemoWalletUrl ─────────────────────────────────────────────────────

describe("lib/google/wallet — buildDemoWalletUrl", () => {
  it("returns a URL starting with the Google Wallet save base", () => {
    const url = buildDemoWalletUrl(sampleOrder);
    expect(url).toContain("https://pay.google.com/gp/v/save/");
  });

  it("produces a non-empty JWT segment", () => {
    const url = buildDemoWalletUrl(sampleOrder);
    const jwt = url.replace("https://pay.google.com/gp/v/save/", "");
    expect(jwt.length).toBeGreaterThan(20);
  });

  it("encodes different orders to different JWT segments", () => {
    const urlA = buildDemoWalletUrl(sampleOrder);
    const urlB = buildDemoWalletUrl({ ...sampleOrder, orderId: "ord-different" });
    expect(urlA).not.toBe(urlB);
  });
});

// ── isWalletConfigured ─────────────────────────────────────────────────────

describe("lib/google/wallet — isWalletConfigured", () => {
  it("is a boolean", () => {
    expect(typeof isWalletConfigured).toBe("boolean");
  });

  it("is false in test environment (no GOOGLE_WALLET_* env vars set)", () => {
    // In CI/test mode neither GOOGLE_WALLET_ISSUER_ID nor
    // GOOGLE_WALLET_CLASS_ID is set, so the flag should be false.
    const envIssuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const envClass = process.env.GOOGLE_WALLET_CLASS_ID;
    if (!envIssuer && !envClass) {
      expect(isWalletConfigured).toBe(false);
    }
  });
});
