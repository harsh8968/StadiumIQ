"use client";

import { useEffect, useState } from "react";
import { subscribeToDensity, type DensityMap } from "@/lib/data/crowd";

/**
 * Live density map keyed by POI ID (values in [0, 1]). Subscribes to the
 * mock-mode 500 ms poll or Firestore `crowd_density` collection depending on
 * `NEXT_PUBLIC_MOCK_MODE`. Always returns a fresh object on update so React
 * re-renders consumers.
 */
export function useCrowdDensity(): DensityMap {
  const [densityMap, setDensityMap] = useState<DensityMap>({});

  useEffect(() => {
    const unsubscribe = subscribeToDensity((map) => {
      setDensityMap({ ...map });
    });
    return unsubscribe;
  }, []);

  return densityMap;
}
