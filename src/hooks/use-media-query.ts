"use client";

import { useState, useEffect } from "react";

/**
 * Returns whether the given media query matches. Updates on change (e.g. resize, orientation).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_PORTRAIT_QUERY = "(max-width: 767px) and (orientation: portrait)";
const MOBILE_LANDSCAPE_QUERY = "(max-width: 767px) and (orientation: landscape)";

/** True when viewport width is at most 767px. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

/** True when viewport is mobile and in portrait orientation. */
export function useIsMobilePortrait(): boolean {
  return useMediaQuery(MOBILE_PORTRAIT_QUERY);
}

/** True when viewport is mobile and in landscape orientation. */
export function useIsMobileLandscape(): boolean {
  return useMediaQuery(MOBILE_LANDSCAPE_QUERY);
}
