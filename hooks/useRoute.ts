"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeToDensity } from "@/lib/data/crowd";
import type { DensityMap } from "@/lib/data/crowd";
import { getGraph, shortestPath } from "@/lib/routing";
import type { RouteResult } from "@/lib/routing";
import {
  USER_SEAT_NODE_ID,
  WALKING_SPEED_SVG_PER_SEC,
  ROUTING_ETA_ROUND_TO_SEC,
} from "@/lib/constants";
import { PoisSchema } from "@/lib/schemas/poi";
import rawPois from "@/public/venue/pois.json";

const pois = PoisSchema.parse(rawPois);
const poiByNodeId = new Map(pois.map((p) => [p.nodeId, p]));

export interface UseRouteResult {
  path: string[];
  etaSec: number;
  loading: boolean;
}

/**
 * Subscribe to live density and re-run Dijkstra from the user's seat whenever
 * it changes. Returns the current crowd-weighted path + ETA.
 *
 * Pass `null` to clear any active route.
 */
export function useRoute(toPoiId: string | null): UseRouteResult {
  const [result, setResult] = useState<UseRouteResult>({ path: [], etaSec: 0, loading: false });
  const densityRef = useRef<DensityMap>({});

  function computeRoute(density: DensityMap): void {
    if (!toPoiId) {
      setResult({ path: [], etaSec: 0, loading: false });
      return;
    }
    const targetPoi = pois.find((p) => p.id === toPoiId);
    if (!targetPoi) {
      setResult({ path: [], etaSec: 0, loading: false });
      return;
    }

    const graph = getGraph();
    const route = shortestPath(
      graph,
      USER_SEAT_NODE_ID,
      targetPoi.nodeId,
      density,
      WALKING_SPEED_SVG_PER_SEC,
      ROUTING_ETA_ROUND_TO_SEC,
    );

    if (route) {
      setResult({ path: route.path, etaSec: route.etaSec, loading: false });
    } else {
      setResult({ path: [], etaSec: 0, loading: false });
    }
  }

  useEffect(() => {
    if (!toPoiId) {
      setResult({ path: [], etaSec: 0, loading: false });
      return;
    }

    setResult((prev) => ({ ...prev, loading: true }));

    const unsubscribe = subscribeToDensity((map) => {
      densityRef.current = map;
      computeRoute(map);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toPoiId]);

  return result;
}

export { poiByNodeId };
