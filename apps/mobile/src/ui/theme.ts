import { colors } from "@sllights/shared/theme";

export { colors };

/** 4pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Field-first sizing: crews use this outdoors, often one-handed or gloved.
 * 52pt targets exceed Apple's 44pt / Android's 48dp minimums on purpose.
 */
export const touch = { minHeight: 52 } as const;

export const radius = { sm: 6, md: 10, lg: 16 } as const;

export const type = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" as const, color: colors.ink },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const, color: colors.ink },
  body: { fontSize: 16, lineHeight: 22, color: colors.ink },
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" as const, color: colors.inkMuted },
  small: { fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  /** Pole numbers: tabular, wide-tracked so crews can read them back aloud. */
  code: { fontSize: 30, lineHeight: 36, fontWeight: "700" as const, letterSpacing: 1.5, color: colors.ink, fontVariant: ["tabular-nums" as const] },
};
