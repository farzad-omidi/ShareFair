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
