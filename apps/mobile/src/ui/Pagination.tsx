import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPagerLayout } from "@sllights/shared/pagination";
import { colors, radius, space } from "./theme";

const WINDOW = 3;
// 36pt buttons keep the fullest row (1 ‹ … 4 5 6 … › 9, ~316pt) inside a
// 375pt-wide phone's list padding; hitSlop extends each touch area.
const SIZE = 36;

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

  const pageButton = (p: number) => {
    const current = p === page;
    return (
      <PagerButton key={p} label={`Page ${p}`} selected={current} onPress={() => onPageChange(p)}>
        <Text style={[styles.number, current && styles.numberCurrent]}>{p}</Text>
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
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
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
    width: SIZE,
    height: SIZE,
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
  gap: { width: 14, textAlign: "center", fontSize: 15, color: colors.inkFaint },
});
