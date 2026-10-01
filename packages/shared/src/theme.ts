/**
 * Streetleaf brand tokens as plain hex values, for the mobile app (React
 * Native has no CSS variables). Mirrors the :root block in
 * apps/web/src/app/globals.css — keep the two in sync when either changes.
 */
export const colors = {
  bg: "#f4f5f7",
  surface: "#ffffff",
  surfaceSunken: "#ecedf1",
  border: "#dde1e7",
  borderStrong: "#c7cdd6",

  ink: "#12161d",
  inkMuted: "#5b6472",
  inkFaint: "#8891a0",

  accent: "#00b1ae",
  accentStrong: "#00918f",
  accentSoft: "#e6f7f7",
  accentInk: "#003e3d",

  statusActive: "#1f8a4c",
  statusActiveBg: "#e6f4ec",
  statusWarning: "#b45309",
  statusWarningBg: "#fef3c7",
  statusFlagged: "#c23b3b",
  statusFlaggedBg: "#fbeaea",
} as const;

export type ColorToken = keyof typeof colors;
