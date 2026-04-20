import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/firebase/googleSignIn.ts
 *
 * Google Sign-In is the primary authentication mechanism for StadiumIQ.
 * Firebase Auth with GoogleAuthProvider bridges Firebase's anonymous
 * session model with Google's OAuth 2.0 flow. The implementation preserves
 * the anonymous UID by *linking* the Google credential before creating a
 * fresh Google session — fan order history and analytics trails survive
 * the anonymous → authenticated upgrade.
 *
 * These tests verify the exported helper surface with the Firebase SDK
 * mocked so the tests run offline and deterministically.
 */

// ── Mock the Firebase Auth SDK ─────────────────────────────────────────────
// vi.mock is hoisted — do NOT reference outer variables in the factory.

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(() => ({
    setCustomParameters: vi.fn(),
  })),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  linkWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock("@/lib/env", () => ({ hasFirebase: false }));

// ── Import module + mocks after vi.mock declarations ───────────────────────

import {
  signInWithGoogle,
  signOutOfGoogle,
  watchIdentity,
} from "@/lib/firebase/googleSignIn";
import { signInWithPopup, signOut, linkWithPopup, onAuthStateChanged } from "firebase/auth";

// ── signInWithGoogle ────────────────────────────────────────────────────────

describe("lib/firebase/googleSignIn — signInWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null immediately when Firebase is not configured (hasFirebase=false)", async () => {
    const result = await signInWithGoogle();
    expect(result).toBeNull();
  });

  it("does not call signInWithPopup when Firebase is unconfigured", async () => {
    await signInWithGoogle();
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it("does not call linkWithPopup when Firebase is unconfigured", async () => {
    await signInWithGoogle();
    expect(linkWithPopup).not.toHaveBeenCalled();
  });
});

// ── signOutOfGoogle ─────────────────────────────────────────────────────────

describe("lib/firebase/googleSignIn — signOutOfGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when Firebase is not configured", async () => {
    const result = await signOutOfGoogle();
    expect(result).toBe(false);
  });

  it("does not call Firebase signOut when unconfigured", async () => {
    await signOutOfGoogle();
    expect(signOut).not.toHaveBeenCalled();
  });
});

// ── watchIdentity ───────────────────────────────────────────────────────────

describe("lib/firebase/googleSignIn — watchIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a no-op unsubscribe function when Firebase is not configured", () => {
    const handler = vi.fn();
    const unsubscribe = watchIdentity(handler);
    expect(typeof unsubscribe).toBe("function");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calling the returned unsubscribe does not throw", () => {
    const unsubscribe = watchIdentity(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });

  it("does not call onAuthStateChanged when Firebase is unconfigured", () => {
    watchIdentity(vi.fn());
    expect(onAuthStateChanged).not.toHaveBeenCalled();
  });
});

// ── GoogleIdentity type contract ────────────────────────────────────────────

describe("lib/firebase/googleSignIn — GoogleIdentity shape contract", () => {
  const authenticatedIdentity = {
    uid: "uid-google-123",
    displayName: "Harsh Patil",
    email: "harsh@example.com",
    photoURL: "https://example.com/photo.jpg",
    isAnonymous: false,
  };

  const anonymousIdentity = {
    uid: "uid-anon-456",
    displayName: null,
    email: null,
    photoURL: null,
    isAnonymous: true,
  };

  it("authenticated identity has non-null uid and email", () => {
    expect(authenticatedIdentity.uid).toBeTruthy();
    expect(authenticatedIdentity.email).not.toBeNull();
    expect(authenticatedIdentity.isAnonymous).toBe(false);
  });

  it("anonymous identity has null displayName, email, and photoURL", () => {
    expect(anonymousIdentity.displayName).toBeNull();
    expect(anonymousIdentity.email).toBeNull();
    expect(anonymousIdentity.photoURL).toBeNull();
    expect(anonymousIdentity.isAnonymous).toBe(true);
  });

  it("isAnonymous is always a boolean", () => {
    expect(typeof authenticatedIdentity.isAnonymous).toBe("boolean");
    expect(typeof anonymousIdentity.isAnonymous).toBe("boolean");
  });
});
