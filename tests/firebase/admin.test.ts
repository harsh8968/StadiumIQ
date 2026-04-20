import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Firebase Admin ────────────────────────────────────────────────────
// vi.mock is hoisted — use inline vi.fn() rather than outer variable references.

vi.mock("firebase-admin/app", () => ({
  cert: vi.fn(),
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getApps: vi.fn(() => []),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: vi.fn() })),
}));

import { getAdminDb } from "@/lib/firebase/admin";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

describe("lib/firebase/admin — getAdminDb", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV }; // Clone env for modification
  });

  it("throws when environment variables are missing", () => {
    delete process.env.FIREBASE_ADMIN_PROJECT_ID;
    delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    vi.mocked(getApps).mockReturnValue([]);

    expect(() => getAdminDb()).toThrow(/Missing Firebase Admin/);
  });

  it("initializes a new app if no apps exist", () => {
    process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@example.com";
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key\\nline2";
    vi.mocked(getApps).mockReturnValue([]);

    const db = getAdminDb();
    
    expect(cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "test@example.com",
      privateKey: "test-key\nline2",
    });
    expect(initializeApp).toHaveBeenCalledOnce();
    expect(getFirestore).toHaveBeenCalledOnce();
    expect(db).toBeTruthy();
  });

  it("reuses existing app if one is already initialized", () => {
    vi.mocked(getApps).mockReturnValue([{ name: "[DEFAULT]" }] as any);

    const db = getAdminDb();
    
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalledWith({ name: "[DEFAULT]" });
    expect(db).toBeTruthy();
  });
});
