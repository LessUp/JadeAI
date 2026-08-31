"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

// Match the server/SSR output (false) during hydration so there's no
// hydration mismatch; the real value is applied right after hydration.
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
