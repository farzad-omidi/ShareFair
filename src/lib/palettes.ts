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

// Eight member colors, each in the same style as the brand green everything
// else uses: a bright, flat, saturated fill (`accent`) plus a darkened
// variant (`dark`) for gradient/avatar shading -- the actual on-white flat
// text color is still derived live in memberVars below, not read from `dark`
// directly, so these don't need to be hand-verified for AA contrast. `bg`/
// `line`/`ring`/`shadow` are the accent at fixed alphas; `bg2` is a barely-
// tinted near-white wash of the same hue, matching how the brand green's own
// tokens were built.
export const PALETTES: Palette[] = [
  { name: "Green", accent: "#00ed64", dark: "#00684a", bg: "rgba(0,237,100,.13)", bg2: "rgba(240,253,246,.90)", line: "rgba(0,237,100,.32)", ring: "rgba(0,237,100,.17)", shadow: "rgba(0,237,100,.19)" },
  { name: "Blue", accent: "#2f7dfa", dark: "#12409e", bg: "rgba(47,125,250,.13)", bg2: "rgba(243,247,255,.90)", line: "rgba(47,125,250,.32)", ring: "rgba(47,125,250,.17)", shadow: "rgba(47,125,250,.19)" },
  { name: "Purple", accent: "#7b3ff2", dark: "#4a1fb8", bg: "rgba(123,63,242,.13)", bg2: "rgba(247,244,254,.90)", line: "rgba(123,63,242,.32)", ring: "rgba(123,63,242,.17)", shadow: "rgba(123,63,242,.19)" },
  { name: "Orange", accent: "#fa6e39", dark: "#b8431a", bg: "rgba(250,110,57,.13)", bg2: "rgba(255,246,243,.90)", line: "rgba(250,110,57,.32)", ring: "rgba(250,110,57,.17)", shadow: "rgba(250,110,57,.19)" },
  { name: "Pink", accent: "#f06bb8", dark: "#b8347e", bg: "rgba(240,107,184,.13)", bg2: "rgba(254,246,251,.90)", line: "rgba(240,107,184,.32)", ring: "rgba(240,107,184,.17)", shadow: "rgba(240,107,184,.19)" },
  { name: "Teal", accent: "#00c2d1", dark: "#00707a", bg: "rgba(0,194,209,.13)", bg2: "rgba(240,251,252,.90)", line: "rgba(0,194,209,.32)", ring: "rgba(0,194,209,.17)", shadow: "rgba(0,194,209,.19)" },
  { name: "Rose", accent: "#ef4467", dark: "#9e1f43", bg: "rgba(239,68,103,.13)", bg2: "rgba(254,244,246,.90)", line: "rgba(239,68,103,.32)", ring: "rgba(239,68,103,.17)", shadow: "rgba(239,68,103,.19)" },
  { name: "Gold", accent: "#f5b400", dark: "#8a6200", bg: "rgba(245,180,0,.13)", bg2: "rgba(254,251,240,.90)", line: "rgba(245,180,0,.32)", ring: "rgba(245,180,0,.17)", shadow: "rgba(245,180,0,.19)" },
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

// Categories get their own small, separate color set -- MongoDB's four
// category-tag accents (purple/orange/pink/blue), the one place besides the
// brand green the spec allows saturated color, reserved for exactly this
// kind of narrow tag-like use rather than for personalizing a person.
const CATEGORY_ACCENTS: Pick<Palette, "accent">[] = [
  { accent: "#7b3ff2" }, // purple
  { accent: "#fa6e39" }, // orange
  { accent: "#f06bb8" }, // pink
  { accent: "#3d4f9f" }, // blue
];

export function categoryPaletteFor(name: string): Pick<Palette, "accent"> {
  return CATEGORY_ACCENTS[hashIndex(name, CATEGORY_ACCENTS.length)];
}

// `isDark` makes the flat-text token (--member-text) mode-aware, unlike
// --member-accent/--member-dark (fills: avatar gradients, borders, the color
// picker's own swatches) which stay the same regardless of theme since a
// fill doesn't need to satisfy text contrast in the first place.
export function memberVars(paletteIndex: number | null | undefined, isDark: boolean): CSSProperties {
  const p = paletteFor(paletteIndex);
  // Derived straight from the vibrant accent, not chained through the
  // already-darkened --member-dark -- nudging the *original* color in
  // whichever direction the current mode needs gives a punchier, more
  // saturated result (e.g. Saffron/Menthe often clear 4.5:1 on a dark card
  // completely unchanged, since bright colors already read fine on dark
  // backgrounds) than restarting from a value already darkened for light mode.
  const memberText = adjustForContrast(p.accent, isDark ? CARD_BG_DARK : CARD_BG_LIGHT, 4.5, isDark ? "lighten" : "darken");
  return {
    ["--member-accent" as string]: p.accent,
    ["--member-dark" as string]: p.dark,
    ["--member-text" as string]: memberText,
    ["--member-bg" as string]: p.bg,
    ["--member-bg2" as string]: p.bg2,
    ["--member-line" as string]: p.line,
    ["--member-ring" as string]: p.ring,
    ["--member-shadow" as string]: p.shadow,
  };
}

// ---- WCAG contrast helpers, used to keep member-tinted flat text (the
// balance/entry amounts) legible against the card surface it sits on ----

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

// Approximate light/dark-mode --solid values from globals.css -- member text
// needs to clear contrast against the actual card surface it sits on, and
// this runs outside CSS so it can't read the custom property directly. Keep
// in sync by hand if globals.css's --solid ever changes.
const CARD_BG_LIGHT = "#ffffff";
const CARD_BG_DARK = "#001e2b";
