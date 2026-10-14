import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform, type ScrollView } from "react-native";

/**
 * Keeps a long form usable with the keyboard:
 *  - a field near the bottom (Notes) is scrolled into view, with the button
 *    under it, once the keyboard is up — or straight away when moving to it
 *    with the keyboard already open;
 *  - showTop() closes the keyboard and scrolls to the top, where the form
 *    shows the outcome of Submit (and its first fields).
 */
/**
 * Android reports the keyboard before the form has been laid out with the room
 * made for it; scrolling straight away would land where the end used to be
 * (still under the keyboard). A short wait lets the new layout settle first.
 */
export const ANDROID_KEYBOARD_LAYOUT_DELAY_MS = 150;

export function useFormScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const bottomFieldFocused = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottomField = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    const scroll = () => scrollRef.current?.scrollToEnd({ animated: true });
    if (Platform.OS === "android") pending.current = setTimeout(scroll, ANDROID_KEYBOARD_LAYOUT_DELAY_MS);
    else scroll();
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (bottomFieldFocused.current) scrollToBottomField();
    });
    return () => {
      sub.remove();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [scrollToBottomField]);

  const bottomFieldProps = {
    onFocus: () => {
      bottomFieldFocused.current = true;
      if (Keyboard.isVisible()) scrollToBottomField();
    },
    onBlur: () => {
      bottomFieldFocused.current = false;
    },
  };

  const showTop = useCallback(() => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return { scrollRef, bottomFieldProps, showTop };
}
