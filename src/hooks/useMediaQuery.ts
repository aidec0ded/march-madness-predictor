"use client";

import { useState, useEffect } from "react";

/**
 * Hook that tracks a CSS media query match state.
 *
 * Returns `false` during SSR / initial hydration to avoid mismatches,
 * then syncs with the actual viewport via `window.matchMedia`.
 *
 * @param query - CSS media query string (e.g., "(max-width: 767px)")
 * @returns Whether the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Mobile: phones and small devices */
export const MOBILE_QUERY = "(max-width: 767px)";

/** Tablet: medium devices */
export const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023px)";
