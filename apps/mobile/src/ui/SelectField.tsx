import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SearchField } from "./SearchField";
import { FieldLabel } from "./TextField";
import { colors, radius, space, touch } from "./theme";

export interface SelectOption {
  value: string;
  label: string;
  /** A second line, e.g. the customer under a project name. */
  detail?: string | null;
}

/**
 * A dropdown: shows the chosen option (or a placeholder) and opens a
 * full-screen list to pick from, with a search box for long lists (a
 * project can have dozens of stickers).
 */
export function SelectField({
  label,
  required = false,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyText,
  error,
}: {
  label: string;
  required?: boolean;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  emptyText: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value) ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.detail ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={styles.gap}>
      <FieldLabel label={label} required={required} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : placeholder}`}
        accessibilityHint={required ? "Required" : undefined}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={[styles.field, disabled && styles.disabled, error ? styles.invalid : null]}
      >
        <View style={styles.flex}>
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
          {selected?.detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {selected.detail}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.inkMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetTop}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label}`} onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {options.length > 8 ? (
            <View style={styles.search}>
              <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}…`} />
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.detail}>{query.trim() ? "No matches." : emptyText}</Text>}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.label}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
                  </View>
                  {isSelected ? <Ionicons name="checkmark" size={20} color={colors.accentStrong} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.xs },
  flex: { flex: 1 },
  field: {
    minHeight: touch.minHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  disabled: { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
  invalid: { borderColor: colors.statusFlagged },
  value: { fontSize: 17, color: colors.ink, fontWeight: "600" },
  placeholder: { color: colors.inkFaint, fontWeight: "400" },
  detail: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  close: { fontSize: 16, fontWeight: "600", color: colors.accentStrong },
  search: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xs },
  option: {
    minHeight: touch.minHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.accentStrong, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.7 },
  optionLabel: { fontSize: 16, fontWeight: "600", color: colors.ink },
});
