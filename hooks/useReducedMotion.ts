"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when the user has `prefers-reduced-motion: reduce` set in
 * their OS. Use this to disable non-essential animations for users with
 * vestibular sensitivity.
 *
 * Returns `false` on the server and on initial client render (before the
 * matchMedia query is read) to keep SSR output deterministic.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}
