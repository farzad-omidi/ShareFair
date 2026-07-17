"use client";

import { useSyncExternalStore } from "react";

// Tracks the OS/browser color-scheme preference reactively -- shared by
// anything that needs to recompute a WCAG-safe color the moment the user (or
// their system) toggles theme, not just on first paint. Used by memberVars so
// member-tinted flat text stays contrast-adjusted per mode.
function subscribeToColorScheme(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getPrefersDarkSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
// Matches globals.css's light-mode :root as the default before hydration.
function getPrefersDarkServerSnapshot() {
  return false;
}
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeToColorScheme, getPrefersDarkSnapshot, getPrefersDarkServerSnapshot);
}
