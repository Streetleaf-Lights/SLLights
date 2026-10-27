import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPagerLayout } from "@sllights/shared/pagination";
import { colors, radius, space } from "./theme";

const WINDOW = 3;
// 36pt buttons; hitSlop extends each touch area.
const SIZE = 36;
/** Width of the "…" between page numbers. */
const GAP_WIDTH = 14;
/** The narrowest common phone (360pt) minus the list's 16pt side padding. */
export const PAGER_ROW_BUDGET = 328;

/**
 * Page-number button size for a pager, from its largest page number, so every
 * number fits in full: 1–3 digits keep 36pt buttons and 15pt text; 4 digits
 * (e.g. 1521) get 40pt buttons with 13pt text; 5+ digits 40pt with 11pt.
 * Worked to the fullest row — 1 ‹ … 760 761 762 … › 1521: five numbers, two
 * arrows, two gaps and eight 4pt spaces — fitting PAGER_ROW_BUDGET (see
 * pagerRowWidth). The number also shrinks to fit as a safety net (fonts vary).
 */
export function pagerSizing(totalPages: number): { width: number; fontSize: number } {
  const digits = String(Math.max(1, Math.floor(totalPages))).length;
  if (digits <= 3) return { width: SIZE, fontSize: 15 };
  if (digits === 4) return { width: 40, fontSize: 13 };
  return { width: 40, fontSize: 11 };
}

/** The fullest row's width for a page count: page 1 + three pages + the last, arrows, gaps, spacing. */
export function pagerRowWidth(totalPages: number): number {
  const { width } = pagerSizing(totalPages);
  const numbers = SIZE + 4 * width; // "1" is never wider than a 36pt button
  return numbers + 2 * SIZE + 2 * GAP_WIDTH + 8 * space.xs;
}

/**
 * 1 ‹ … 4 5 6 … › 9 — the web pager's layout (First, Previous, pages,
 * Next, Last) condensed for a phone: arrow-only Previous/Next, three pages
 * around the current one, and the first/last page outside the arrows when
 * those three don't include them (see getPagerLayout in @sllights/shared).
 * Renders nothing when everything fits on one page.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const { first, middle, last } = getPagerLayout(page, totalPages, WINDOW);
  const sizing = pagerSizing(totalPages);

  const pageButton = (p: number) => {
    const current = p === page;
    return (
      <PagerButton key={p} label={`Page ${p}`} selected={current} width={sizing.width} onPress={() => onPageChange(p)}>
        <Text
          style={[styles.number, { fontSize: sizing.fontSize }, current && styles.numberCurrent]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {p}
        </Text>
      </PagerButton>
    );
  };

  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel="Pages">
      {first !== null ? pageButton(first) : null}

      <PagerButton label="Previous page" disabled={page <= 1} onPress={() => onPageChange(page - 1)}>
        <Ionicons name="chevron-back" size={20} color={page <= 1 ? colors.inkFaint : colors.ink} />
      </PagerButton>

      {middle.map((item) => (item.kind === "gap" ? <Gap key={item.key} /> : pageButton(item.page)))}

      <PagerButton label="Next page" disabled={page >= totalPages} onPress={() => onPageChange(page + 1)}>
        <Ionicons name="chevron-forward" size={20} color={page >= totalPages ? colors.inkFaint : colors.ink} />
      </PagerButton>

      {last !== null ? pageButton(last) : null}
    </View>
  );
}

function PagerButton({
  label,
  selected = false,
  disabled = false,
  width = SIZE,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  /** Page numbers widen for 4+ digits (see pagerSizing); arrows stay square. */
  width?: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || selected}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width },
        selected && styles.buttonCurrent,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

function Gap() {
  return (
    <Text testID="pager-gap" style={styles.gap} importantForAccessibility="no" accessibilityElementsHidden>
      …
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  button: {
    height: SIZE,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same treatment as the web's current-page button: accent border, soft fill.
  buttonCurrent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { backgroundColor: colors.surfaceSunken },
  disabled: { opacity: 0.45 },
  number: { fontSize: 15, fontWeight: "600", color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  numberCurrent: { color: colors.accentInk },
  gap: { width: GAP_WIDTH, textAlign: "center", fontSize: 15, color: colors.inkFaint },
});
