import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Mock the data layer so the hook doesn't actually poll `/api/density`.
 * Each test defines its own subscription behavior.
 */
const subscribeToDensity = vi.fn();

vi.mock("@/lib/data/crowd", () => ({
  subscribeToDensity: (cb: (map: Record<string, number>) => void) =>
    subscribeToDensity(cb),
}));

import { useCrowdDensity } from "@/hooks/useCrowdDensity";

describe("useCrowdDensity", () => {
  beforeEach(() => {
    subscribeToDensity.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty map before the first subscription callback fires", () => {
    subscribeToDensity.mockImplementation(() => () => {});
    const { result } = renderHook(() => useCrowdDensity());
    expect(result.current).toEqual({});
  });

  it("updates state when the subscription emits a density map", async () => {
    let emit: (map: Record<string, number>) => void = () => {};
    subscribeToDensity.mockImplementation(
      (cb: (map: Record<string, number>) => void) => {
        emit = cb;
        return () => {};
      },
    );

    const { result } = renderHook(() => useCrowdDensity());

    act(() => {
      emit({ "food-burger": 0.4, "restroom-nw": 0.1 });
    });

    await waitFor(() => {
      expect(result.current["food-burger"]).toBe(0.4);
      expect(result.current["restroom-nw"]).toBe(0.1);
    });
  });

  it("returns a fresh object reference on each update (no mutation)", () => {
    let emit: (map: Record<string, number>) => void = () => {};
    subscribeToDensity.mockImplementation(
      (cb: (map: Record<string, number>) => void) => {
        emit = cb;
        return () => {};
      },
    );

    const { result } = renderHook(() => useCrowdDensity());

    act(() => emit({ "food-burger": 0.2 }));
    const first = result.current;

    act(() => emit({ "food-burger": 0.5 }));
    const second = result.current;

    expect(first).not.toBe(second);
    expect(second["food-burger"]).toBe(0.5);
  });

  it("calls the unsubscribe returned by subscribeToDensity on unmount", () => {
    const unsubscribe = vi.fn();
    subscribeToDensity.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useCrowdDensity());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
