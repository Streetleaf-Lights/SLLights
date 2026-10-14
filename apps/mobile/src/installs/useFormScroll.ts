import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type ScrollView } from "react-native";

/**
 * Keeps a long form usable with the keyboard:
 *  - a field near the bottom (Notes) is scrolled into view, with the button
 *    under it, once the keyboard is up — or straight away when moving to it
 *    with the keyboard already open;
 *  - showTop() closes the keyboard and scrolls to the top, where the form
 *    shows the outcome of Submit (and its first fields).
 */
export function useFormScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const bottomFieldFocused = useRef(false);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (bottomFieldFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const bottomFieldProps = {
    onFocus: () => {
      bottomFieldFocused.current = true;
      if (Keyboard.isVisible()) scrollRef.current?.scrollToEnd({ animated: true });
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
