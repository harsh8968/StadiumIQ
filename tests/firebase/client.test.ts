import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getApps: vi.fn(() => []),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => "firestore-instance"),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => "auth-instance"),
}));

vi.mock("firebase/messaging", () => ({
  getMessaging: vi.fn(() => "messaging-instance"),
  isSupported: vi.fn().mockResolvedValue(true),
}));

// We must override the inner hasFirebase value, so we do it via vi.mock
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
  },
  hasFirebase: true,
}));

import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

import {
  getFirebaseApp,
  getDb,
  getFirebaseAuth,
  getMessagingInstance,
} from "@/lib/firebase/client";

// For the throwing test, we need to manipulate the module, but since it's ESM
// and the hasFirebase binding is live, we can just temporarily change how it acts.
// Actually, it's easier to verify behavior when it *is* set to true, since it's mocked that way.

describe("lib/firebase/client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getFirebaseApp initializes a new app if there are no existing apps", () => {
    vi.mocked(getApps).mockReturnValue([]);
    const app = getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledOnce();
    expect(getApp).not.toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it("getFirebaseApp returns existing app if one is already initialized", () => {
    vi.mocked(getApps).mockReturnValue([{ name: "[DEFAULT]" }] as any);
    const app = getFirebaseApp();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalledOnce();
    expect(app).toBeTruthy();
  });

  it("getDb returns firestore instance", () => {
    vi.mocked(getApps).mockReturnValue([{ name: "[DEFAULT]" }] as any);
    const db = getDb();
    expect(getFirestore).toHaveBeenCalled();
    expect(db).toBe("firestore-instance");
  });

  it("getFirebaseAuth returns auth instance", () => {
    vi.mocked(getApps).mockReturnValue([{ name: "[DEFAULT]" }] as any);
    const auth = getFirebaseAuth();
    expect(getAuth).toHaveBeenCalled();
    expect(auth).toBe("auth-instance");
  });

  it("getMessagingInstance returns messaging instance if supported", async () => {
    vi.mocked(getApps).mockReturnValue([{ name: "[DEFAULT]" }] as any);
    vi.mocked(isSupported).mockResolvedValueOnce(true);
    const messaging = await getMessagingInstance();
    expect(getMessaging).toHaveBeenCalled();
    expect(messaging).toBe("messaging-instance");
  });

  it("getMessagingInstance returns null if not supported", async () => {
    vi.mocked(isSupported).mockResolvedValueOnce(false);
    const messaging = await getMessagingInstance();
    expect(getMessaging).not.toHaveBeenCalled();
    expect(messaging).toBeNull();
  });

  it("getMessagingInstance returns null if isSupported throws erro", async () => {
    vi.mocked(isSupported).mockRejectedValueOnce(new Error("Browser not supported"));
    const messaging = await getMessagingInstance();
    expect(messaging).toBeNull();
  });
});
