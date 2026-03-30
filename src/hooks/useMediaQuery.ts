import { useSyncExternalStore } from "react";

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
