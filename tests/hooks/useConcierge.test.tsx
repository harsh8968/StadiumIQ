import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Tests for hooks/useConcierge.ts
 *
 * useConcierge manages the AI concierge chat session:
 * - Local state for message history (user + assistant turns)
 * - POST to /api/concierge with Gemini AI backend
 * - Dual analytics pipeline (GA4 gtag + Firebase Analytics)
 * - Graceful error handling (network failure, schema mismatch, LLM refusal)
 * - reCAPTCHA v3 token attachment for bot protection
 *
 * The hook is the central integration point for all Google services:
 * Google Sign-In identity, Firebase Analytics events, reCAPTCHA, and
 * the Gemini AI model all flow through this hook.
 */

// ── Mock dependencies ──────────────────────────────────────────────────────

vi.mock("@/lib/security/recaptcha", () => ({
  getRecaptchaToken: vi.fn(async () => null),
}));

vi.mock("@/lib/google/gtag", () => ({
  trackGtagEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/analytics", () => ({
  trackEvent: vi.fn(async () => {}),
}));

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { useConcierge } from "@/hooks/useConcierge";
import { trackGtagEvent } from "@/lib/google/gtag";
import { trackEvent } from "@/lib/firebase/analytics";

// ── Shared mock response factory ───────────────────────────────────────────

function makeSuccessResponse(
  reply: string,
  action: "info" | "navigate" = "info",
) {
  return {
    ok: true,
    json: async () => ({
      reply,
      recommendation: null,
      action,
    }),
  };
}

function makeErrorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({ error: "Internal server error" }),
  };
}

// ── Initial state ──────────────────────────────────────────────────────────

describe("useConcierge — initial state", () => {
  it("starts with a greeting message from the assistant", () => {
    const { result } = renderHook(() => useConcierge());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });

  it("greeting message JSON contains a reply field", () => {
    const { result } = renderHook(() => useConcierge());
    const parsed = JSON.parse(result.current.messages[0].content) as { reply: string };
    expect(parsed.reply).toContain("concierge");
  });

  it("loading is false initially", () => {
    const { result } = renderHook(() => useConcierge());
    expect(result.current.loading).toBe(false);
  });

  it("latestRecommendation is null initially", () => {
    const { result } = renderHook(() => useConcierge());
    expect(result.current.latestRecommendation).toBeNull();
  });

  it("exposes a send function", () => {
    const { result } = renderHook(() => useConcierge());
    expect(typeof result.current.send).toBe("function");
  });
});

// ── Sending messages ───────────────────────────────────────────────────────

describe("useConcierge — send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends the user message immediately after send", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse("Burger Stand has the shortest queue."));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("Where can I get food?");
    });

    const userMessages = result.current.messages.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe("Where can I get food?");
  });

  it("appends the assistant reply after a successful API response", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse("Burger Stand has the shortest queue."));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("Where can I get food?");
    });

    const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2);
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    const parsed = JSON.parse(lastAssistant.content) as { reply: string };
    expect(parsed.reply).toBe("Burger Stand has the shortest queue.");
  });

  it("fires both GA4 and Firebase Analytics events after a successful reply", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse("Here you go!", "info"));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("What should I eat?");
    });

    expect(trackGtagEvent).toHaveBeenCalledWith(
      "concierge_answered",
      expect.objectContaining({ action: "info" }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      "concierge_answered",
      expect.objectContaining({ action: "info" }),
    );
  });

  it("does not send an empty or whitespace-only message", async () => {
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("   ");
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("loading is false after the send completes", async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse("Try the pizza!"));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("Food suggestion?");
    });

    expect(result.current.loading).toBe(false);
  });

  it("shows a network error fallback message when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("Hello?");
    });

    const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    const parsed = JSON.parse(lastAssistant.content) as { reply: string };
    expect(parsed.reply).toMatch(/Network error|try again/i);
  });

  it("loading is false even after a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));
    const { result } = renderHook(() => useConcierge());

    await act(async () => {
      await result.current.send("Test?");
    });

    expect(result.current.loading).toBe(false);
  });
});
