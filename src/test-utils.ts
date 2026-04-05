import { vi } from "vitest";

/**
 * Stub `window.matchMedia` so `useMediaQuery` / `useIsMobile` work in
 * jsdom tests.  By default the stub returns `matches: false` (desktop).
 */
export function stubMatchMedia(matches = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}
