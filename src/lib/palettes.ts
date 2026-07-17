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

// One brand-green identity, shared by every member -- the MongoDB-derived
// redesign moved off per-member personalization (see AGENTS request), so
// there's no longer a choice of swatch here, just the single brand color in
// both its fill form (`accent`) and a darkened, contrast-safe flat-text form
// (`dark`), matching {colors.brand-green} / {colors.brand-green-dark}.
export const PALETTES: Palette[] = [
  {
    name: "Brand Green",
    accent: "#00ed64",
    dark: "#00684a",
    bg: "rgba(0,237,100,.13)",
    bg2: "rgba(240,253,246,.90)",
    line: "rgba(0,237,100,.32)",
    ring: "rgba(0,237,100,.17)",
    shadow: "rgba(0,237,100,.19)",
  },
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
