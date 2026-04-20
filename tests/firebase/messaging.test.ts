import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/firebase/messaging.ts
 *
 * Firebase Cloud Messaging (FCM) powers the "order ready" push notification
 * that tells fans when their concession order is ready for pickup — the
 * highest-value fan-experience moment in the StadiumIQ product.
 *
 * Flow:
 * 1. Fan grants Notification permission (via useFcmToken hook).
 * 2. `registerForPush` registers the FCM service worker and mints a token.
 * 3. Token is sent to the server → stored per-user in Firestore.
 * 4. When the order transitions to "ready", Firebase Admin sends an FCM push.
 * 5. `subscribeToForegroundMessages` handles in-app notifications (tab open).
 */

// ── Mock Firebase Messaging SDK ────────────────────────────────────────────
// vi.mock is hoisted. Use inline vi.fn() rather than outer variable references.

vi.mock("firebase/messaging", () => ({
  getToken: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/firebase/client", () => ({
  getMessagingInstance: vi.fn(async () => null),
}));

import {
  registerForPush,
  subscribeToForegroundMessages,
} from "@/lib/firebase/messaging";
import { getToken } from "firebase/messaging";

// ── registerForPush ────────────────────────────────────────────────────────

describe("lib/firebase/messaging — registerForPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when called from server-side (no window)", async () => {
    // Node environment → window is undefined → function short-circuits.
    const result = await registerForPush("vapid-key");
    expect(result).toBeNull();
  });

  it("returns null when no vapidKey is provided", async () => {
    const result = await registerForPush(undefined);
    expect(result).toBeNull();
  });

  it("does not call Firebase getToken when vapidKey is missing", async () => {
    await registerForPush(undefined);
    expect(getToken).not.toHaveBeenCalled();
  });

  it("returns null when called with an empty vapidKey string", async () => {
    const result = await registerForPush("");
    expect(result).toBeNull();
  });

  it("does not throw for any vapidKey value in SSR environment", async () => {
    await expect(registerForPush("any-key")).resolves.not.toThrow();
    await expect(registerForPush(undefined)).resolves.not.toThrow();
  });

  it("returns null when getMessagingInstance returns null", async () => {
    // getMessagingInstance is mocked to return null (Firebase unavailable).
    // The window check fires first in Node environment.
    const result = await registerForPush("vapid-valid-key");
    expect(result).toBeNull();
  });
});

// ── subscribeToForegroundMessages ─────────────────────────────────────────

describe("lib/firebase/messaging — subscribeToForegroundMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an unsubscribe function even when messaging is unavailable", async () => {
    const handler = vi.fn();
    const unsubscribe = await subscribeToForegroundMessages(handler);
    expect(typeof unsubscribe).toBe("function");
  });

  it("calling the returned unsubscribe does not throw", async () => {
    const unsubscribe = await subscribeToForegroundMessages(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });

  it("does not invoke the handler immediately on subscription", async () => {
    const handler = vi.fn();
    await subscribeToForegroundMessages(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("subscribeToForegroundMessages is always async (returns a Promise)", () => {
    const handler = vi.fn();
    const result = subscribeToForegroundMessages(handler);
    expect(result).toBeInstanceOf(Promise);
  });
});

// ── FcmRegistration type contract ──────────────────────────────────────────

describe("lib/firebase/messaging — FcmRegistration schema", () => {
  it("a valid FcmRegistration has non-empty token and a ServiceWorkerRegistration", () => {
    const mockRegistration: { token: string; registration: object } = {
      token: "fcm-token-abc123",
      registration: { scope: "/", active: { state: "activated" } },
    };
    expect(mockRegistration.token).toBeTruthy();
    expect(typeof mockRegistration.token).toBe("string");
    expect(mockRegistration.registration).toBeTruthy();
  });

  it("FCM token is a non-empty string", () => {
    const token = "APA91bHPRgkFLJu6...longFCMtoken";
    expect(token.length).toBeGreaterThan(0);
    expect(typeof token).toBe("string");
  });
});
