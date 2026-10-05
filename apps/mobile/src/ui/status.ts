import type { StatusTone } from "@sllights/shared/status";
import { colors } from "./theme";

/** Mobile palette for the shared status tones (same colours as the web's CSS variables). */
export const toneColor: Record<StatusTone, string> = {
  active: colors.statusActive,
  flagged: colors.statusFlagged,
  muted: colors.inkMuted,
  faint: colors.inkFaint,
};
