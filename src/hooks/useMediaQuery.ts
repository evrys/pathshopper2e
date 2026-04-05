import { useSyncExternalStore } from "react";
import { MOBILE_QUERY } from "../lib/constants";

/**
 * Subscribe to a CSS media query and reactively return whether it matches.
 * Uses `useSyncExternalStore` for tear-free reads.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Shorthand for `useMediaQuery(MOBILE_QUERY)`. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
