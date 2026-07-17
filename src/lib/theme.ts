"use client";

import { useSyncExternalStore } from "react";

// Tracks the OS/browser color-scheme preference reactively -- shared by
// anything that needs to recompute a WCAG-safe color the moment the user (or
// their system) toggles theme, not just on first paint. Originally lived
// only in AppShell (for personalAccentVars), now also used by memberVars so
// any-member text colors (not just the signed-in user's own accent) can be
// contrast-adjusted per mode too.
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
