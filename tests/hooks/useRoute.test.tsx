import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const subscribeToDensity = vi.fn();

vi.mock("@/lib/data/crowd", () => ({
  subscribeToDensity: (cb: (map: Record<string, number>) => void) =>
    subscribeToDensity(cb),
}));

import { useRoute } from "@/hooks/useRoute";

describe("useRoute", () => {
  beforeEach(() => {
    subscribeToDensity.mockReset();
  });

  it("returns an empty path when `toPoiId` is null", () => {
    subscribeToDensity.mockImplementation(() => () => {});
    const { result } = renderHook(() => useRoute(null));
    expect(result.current.path).toEqual([]);
    expect(result.current.etaSec).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("returns an empty path for an unknown POI id", async () => {
    let emit: (map: Record<string, number>) => void = () => {};
    subscribeToDensity.mockImplementation(
      (cb: (map: Record<string, number>) => void) => {
        emit = cb;
        return () => {};
      },
    );
    const { result } = renderHook(() => useRoute("bogus-poi"));

    act(() => emit({}));

    await waitFor(() => {
      expect(result.current.path).toEqual([]);
      expect(result.current.etaSec).toBe(0);
    });
  });

  it("computes a Dijkstra path + positive ETA for a real POI", async () => {
    let emit: (map: Record<string, number>) => void = () => {};
    subscribeToDensity.mockImplementation(
      (cb: (map: Record<string, number>) => void) => {
        emit = cb;
        return () => {};
      },
    );

    const { result } = renderHook(() => useRoute("food-burger"));

    act(() => emit({}));

    await waitFor(() => {
      expect(result.current.path.length).toBeGreaterThan(1);
      expect(result.current.etaSec).toBeGreaterThan(0);
      expect(result.current.loading).toBe(false);
    });

    // Path should start at user's seat and end at the target POI node.
    expect(result.current.path[0]).toBe("n-seat");
    expect(result.current.path[result.current.path.length - 1]).toBe(
      "n-food-burger",
    );
  });

  it("re-runs routing when density changes (higher density → longer ETA or alt path)", async () => {
    let emit: (map: Record<string, number>) => void = () => {};
    subscribeToDensity.mockImplementation(
      (cb: (map: Record<string, number>) => void) => {
        emit = cb;
        return () => {};
      },
    );

    const { result } = renderHook(() => useRoute("food-burger"));

    act(() => emit({}));
    await waitFor(() => expect(result.current.etaSec).toBeGreaterThan(0));
    const baselineEta = result.current.etaSec;

    // Jam every intermediate node
    act(() =>
      emit({
        "food-burger": 1,
        "restroom-nw": 1,
        "merch-west": 1,
        "food-beer": 1,
      }),
    );

    await waitFor(() => {
      // ETA should be >= baseline because the crowd penalty can only raise weights.
      expect(result.current.etaSec).toBeGreaterThanOrEqual(baselineEta);
    });
  });

  it("cleans up the subscription on unmount", () => {
    const unsubscribe = vi.fn();
    subscribeToDensity.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useRoute("food-burger"));
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
