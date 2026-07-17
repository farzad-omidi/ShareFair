import type { CSSProperties } from "react";

export type Palette = {
  name: string;
  accent: string;
  dark: string;
  bg: string;
  bg2: string;
  line: string;
  ring: string;
  shadow: string;
};

export const PALETTES: Palette[] = [
  { name: "Clay", accent: "#c98263", dark: "#9f5a43", bg: "rgba(201,130,99,.10)", bg2: "rgba(255,246,238,.88)", line: "rgba(201,130,99,.28)", ring: "rgba(201,130,99,.14)", shadow: "rgba(201,130,99,.18)" },
  { name: "Rose", accent: "#d08e88", dark: "#a8645f", bg: "rgba(216,167,160,.13)", bg2: "rgba(255,244,243,.90)", line: "rgba(216,167,160,.36)", ring: "rgba(216,167,160,.18)", shadow: "rgba(216,167,160,.20)" },
  { name: "Sage", accent: "#7f9f7d", dark: "#5f7d5f", bg: "rgba(143,169,142,.13)", bg2: "rgba(244,250,243,.90)", line: "rgba(143,169,142,.34)", ring: "rgba(143,169,142,.18)", shadow: "rgba(143,169,142,.20)" },
  { name: "Amber", accent: "#d6a15e", dark: "#a9722d", bg: "rgba(214,161,94,.13)", bg2: "rgba(255,248,236,.91)", line: "rgba(214,161,94,.34)", ring: "rgba(214,161,94,.18)", shadow: "rgba(214,161,94,.20)" },
  { name: "Blue", accent: "#6f95b8", dark: "#496f91", bg: "rgba(111,149,184,.12)", bg2: "rgba(241,248,255,.90)", line: "rgba(111,149,184,.32)", ring: "rgba(111,149,184,.17)", shadow: "rgba(111,149,184,.18)" },
  { name: "Plum", accent: "#9b7aa6", dark: "#765480", bg: "rgba(155,122,166,.12)", bg2: "rgba(250,243,253,.90)", line: "rgba(155,122,166,.32)", ring: "rgba(155,122,166,.17)", shadow: "rgba(155,122,166,.18)" },
  { name: "Teal", accent: "#67a9a4", dark: "#457c78", bg: "rgba(103,169,164,.12)", bg2: "rgba(241,251,249,.90)", line: "rgba(103,169,164,.32)", ring: "rgba(103,169,164,.17)", shadow: "rgba(103,169,164,.18)" },
  { name: "Cocoa", accent: "#9b735d", dark: "#75513e", bg: "rgba(155,115,93,.12)", bg2: "rgba(250,245,241,.90)", line: "rgba(155,115,93,.30)", ring: "rgba(155,115,93,.16)", shadow: "rgba(155,115,93,.18)" },
];

export function paletteFor(index: number | null | undefined): Palette {
  const i = Number.isFinite(Number(index)) ? Number(index) % PALETTES.length : 0;
  return PALETTES[((i % PALETTES.length) + PALETTES.length) % PALETTES.length];
}

// A simple deterministic string hash so the same category name always lands
// on the same palette slot -- categories have no color field of their own, so
// this is the visual substitute (stable across reloads/devices without a
// migration).
export function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function categoryPaletteFor(name: string): Palette {
  return PALETTES[hashIndex(name, PALETTES.length)];
}

export function memberVars(paletteIndex: number | null | undefined): CSSProperties {
  const p = paletteFor(paletteIndex);
  return {
    ["--member-accent" as string]: p.accent,
    ["--member-dark" as string]: p.dark,
    ["--member-bg" as string]: p.bg,
    ["--member-bg2" as string]: p.bg2,
    ["--member-line" as string]: p.line,
    ["--member-ring" as string]: p.ring,
    ["--member-shadow" as string]: p.shadow,
  };
}

// ---- WCAG contrast helpers, used to keep a personalized accent legible no
// matter which of the 8 member palettes someone picks (see personalAccentVars
// below) ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function scale(hex: string, factor: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const mix = (c: number) => (factor <= 1 ? c * factor : c + (255 - c) * (factor - 1));
  return (
    "#" +
    hexToRgb(hex)
      .map((c) => clamp(mix(c)).toString(16).padStart(2, "0"))
      .join("")
  );
}

// Nudges `hex` toward black (factor < 1) or white (factor > 1), a small step
// at a time, until it clears `minRatio` against `against` -- same technique
// used to hand-tune the sage palette's own text colors in globals.css, just
// automated here since it has to work for whichever of the 8 palettes.
function adjustForContrast(hex: string, against: string, minRatio: number, direction: "darken" | "lighten"): string {
  let cur = hex;
  let factor = 1;
  for (let i = 0; i < 14 && contrastRatio(cur, against) < minRatio; i++) {
    factor += direction === "darken" ? -0.08 : 0.12;
    cur = scale(hex, direction === "darken" ? Math.max(factor, 0.08) : Math.min(factor, 2.6));
  }
  return cur;
}

function toRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Approximate light/dark-mode --solid values from globals.css -- personal
// accent text needs to clear contrast against the actual card surface it
// sits on, and this runs outside CSS so it can't read the custom property
// directly. Keep in sync by hand if globals.css's --solid ever changes.
const CARD_BG_LIGHT = "#ffffff";
const CARD_BG_DARK = "#1b241d";
const DARK_TEXT = "#131612";
const LIGHT_TEXT = "#f3f5ef";

// Approximate light/dark-mode --bg (page canvas) values from globals.css --
// the bottom nav floats over this, not a card, and it's now a translucent
// tint rather than an opaque fill, so its text needs contrast against
// whatever the tint looks like once blended with the page behind it.
const PAGE_BG_LIGHT = "#bfcaa8";
const PAGE_BG_DARK = "#0d120e";

function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    a
      .map((c, i) => clamp(c * (1 - t) + b[i] * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

// The nav bar's previous same-hue tint blended into the page instead of
// standing apart from it -- its opposite hue (same saturation/lightness, so
// it stays as muted as the rest of the 8 palettes) reads as a deliberate
// contrast pairing instead, while still being derived from the user's own
// color rather than a fixed neutral.
function complementary(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex((h + 180) % 360, s, l);
}

// Overrides the app-wide brand accent with whichever palette color the
// current user picked as their own member color, so every accent-tied
// button/link/highlight throughout the app matches their identity color --
// while still guaranteeing WCAG-safe contrast, since the 8 palettes weren't
// designed with this dual "fill vs. flat text" role in mind.
export function personalAccentVars(paletteIndex: number | null | undefined, isDark: boolean): CSSProperties {
  const p = paletteFor(paletteIndex);
  const base = p.accent;
  const cardBg = isDark ? CARD_BG_DARK : CARD_BG_LIGHT;
  const accentText = adjustForContrast(p.dark, cardBg, 4.5, isDark ? "lighten" : "darken");
  // whichever of dark-ink / near-white text reads better painted directly on
  // the raw accent fill (bottom-nav active icon, quick-action pills, the
  // primary CTA) -- independent of color-scheme, since --surface/--on-surface
  // are themselves already dark/light in both modes (see .primary).
  const fillFg = contrastRatio(base, DARK_TEXT) >= contrastRatio(base, LIGHT_TEXT) ? "var(--surface)" : "var(--on-surface)";
  // the bottom nav's glass tint is the accent's complementary color (see
  // complementary() above), not the accent itself -- a same-hue wash read as
  // flat/muddy against the page, while the opposite hue stands apart from it
  // and still visually pairs with the solid --accent used on the active tab.
  const navTint = complementary(base);
  const navAlpha = 0.25;
  const navBlend = mixHex(navTint, isDark ? PAGE_BG_DARK : PAGE_BG_LIGHT, 1 - navAlpha);
  const navFg = contrastRatio(navBlend, DARK_TEXT) >= contrastRatio(navBlend, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
  return {
    ["--accent" as string]: base,
    ["--accent-dark" as string]: accentText,
    ["--accent-soft" as string]: toRgba(base, isDark ? 0.18 : 0.14),
    ["--accent-ring" as string]: toRgba(base, isDark ? 0.32 : 0.3),
    ["--accent-text" as string]: accentText,
    ["--primary-bg" as string]: base,
    ["--primary-fg" as string]: fillFg,
    // the nav bar's own identity: a heavily-blurred, 25%-opacity wash of the
    // accent's complementary color, distinct from --accent-soft (a much
    // lighter same-hue tint meant for subtle highlights, not a whole bar)
    ["--nav-bg" as string]: toRgba(navTint, navAlpha),
    ["--nav-fg" as string]: navFg,
    ["--nav-fg-muted" as string]: toRgba(navFg, 0.6),
    // a faint rim in the same light/dark direction as the text -- glass reads
    // as an object with an edge more than a flat, opacity-only tint does,
    // which matters more now that the fill itself is fainter (25%, was 50%)
    ["--nav-border" as string]: toRgba(navFg, 0.16),
  };
}
