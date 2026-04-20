import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Tests for hooks/useReducedMotion.ts
 *
 * This accessibility hook respects the user's OS preference for reduced
 * motion (`prefers-reduced-motion: reduce`). It is consumed by every
 * animated component in StadiumIQ — heatmap transitions, concierge
 * slide-in, order status toasts — ensuring the app is accessible to
 * users with vestibular sensitivity per WCAG 2.1 guideline 2.3.3.
 */

import { useReducedMotion } from "@/hooks/useReducedMotion";

// ── Helper to mock window.matchMedia ─────────────────────────────────────

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();

  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => mql),
  });

  return { mql, triggerChange: (newMatches: boolean) => {
    mql.matches = newMatches;
    listeners.forEach((l) => l());
  }};
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("hooks/useReducedMotion", () => {
  it("returns false initially (SSR-safe default)", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce is active", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when prefers-reduced-motion is not set", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns a boolean value (never undefined or null)", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(typeof result.current).toBe("boolean");
  });

  it("updates when the media query changes from false to true", () => {
    const { triggerChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      triggerChange(true);
    });

    expect(result.current).toBe(true);
  });

  it("updates when the media query changes from true to false", () => {
    const { triggerChange } = mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => {
      triggerChange(false);
    });

    expect(result.current).toBe(false);
  });
});
