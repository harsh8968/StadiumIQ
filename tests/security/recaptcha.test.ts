import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyRecaptchaToken,
  RECAPTCHA_MIN_SCORE,
} from "@/lib/security/recaptcha";

const originalFetch = globalThis.fetch;

describe("lib/security/recaptcha — verifyRecaptchaToken", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fails open when the server has no secret (demo mode)", async () => {
    const result = await verifyRecaptchaToken("any-token", "concierge", undefined);
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when secret is set but no token is provided", async () => {
    const result = await verifyRecaptchaToken(undefined, "concierge", "secret");
    expect(result).toEqual({ ok: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fails closed on a non-2xx response from Google", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result).toEqual({ ok: false });
  });

  it("fails closed when Google reports success=false", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result).toEqual({ ok: false });
  });

  it("fails closed when action does not match", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.9, action: "login" }),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result).toEqual({ ok: false });
  });

  it("fails closed when score is below the threshold", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.2, action: "concierge" }),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result.ok).toBe(false);
    expect(result.score).toBe(0.2);
  });

  it("passes when score meets the threshold and action matches", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        score: 0.8,
        action: "concierge",
      }),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result).toEqual({ ok: true, score: 0.8 });
  });

  it("exactly-at-threshold score passes", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        score: RECAPTCHA_MIN_SCORE,
        action: "concierge",
      }),
    } as Response);

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result.ok).toBe(true);
  });

  it("fails closed on network errors (thrown fetch)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );

    const result = await verifyRecaptchaToken("token", "concierge", "secret");
    expect(result).toEqual({ ok: false });
  });

  it("sends secret + response as form-urlencoded", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, score: 0.9, action: "concierge" }),
    } as Response);

    await verifyRecaptchaToken("the-token", "concierge", "the-secret");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://www.google.com/recaptcha/api/siteverify");
    expect(init.method).toBe("POST");
    expect(init.body).toContain("secret=the-secret");
    expect(init.body).toContain("response=the-token");
  });
});

import { getRecaptchaToken } from "@/lib/security/recaptcha";

describe("lib/security/recaptcha — getRecaptchaToken", () => {
  beforeEach(() => {
    // We are in node test environment, stub window to {}
    vi.clearAllMocks();
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when window is not defined (SSR)", async () => {
    vi.unstubAllGlobals(); // Remove the window stub to trigger SSR path
    const token = await getRecaptchaToken("test", undefined);
    expect(token).toBeNull();
  });

  it("returns null when siteKey is falsy", async () => {
    const token = await getRecaptchaToken("test", "");
    expect(token).toBeNull();
  });

  it("returns null when grecaptcha is not loaded on window", async () => {
    const token = await getRecaptchaToken("test", "test-site-key");
    expect(token).toBeNull();
  });

  it("returns the token on successful execution", async () => {
    const defaultWindow = globalThis.window as any;
    defaultWindow.grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute: vi.fn().mockResolvedValue("mock-token-123"),
    };

    const token = await getRecaptchaToken("test", "test-site-key");
    expect(token).toBe("mock-token-123");
    expect(defaultWindow.grecaptcha.execute).toHaveBeenCalledWith("test-site-key", { action: "test" });
  });

  it("returns null when execute rejects", async () => {
    const defaultWindow = globalThis.window as any;
    defaultWindow.grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute: vi.fn().mockRejectedValue(new Error("Network Error")),
    };

    const token = await getRecaptchaToken("test", "test-site-key");
    expect(token).toBeNull();
  });

  it("returns null when ready/execute throws synchronously", async () => {
    const defaultWindow = globalThis.window as any;
    defaultWindow.grecaptcha = {
      ready: () => { throw new Error("Sync Error"); },
    };

    const token = await getRecaptchaToken("test", "test-site-key");
    expect(token).toBeNull();
  });
});
