import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { isWelcomeHeld } from "@/config";
import { useIntro, WELCOME_DURATION_MS } from "@/intro/IntroProvider";
import { colors, radius, space, type } from "@/ui/theme";

const FEATURES = [
  {
    icon: "bulb" as const,
    title: "Monitor your lights",
    body: "See pole status and connectivity across all your projects at a glance.",
  },
  {
    icon: "alert-circle" as const,
    title: "Stay on top of issues",
    body: "Track open issues and report new ones the moment you spot them.",
  },
  {
    icon: "options" as const,
    title: "Manage your lighting",
    body: "Keep your projects, poles and lighting running the way you need.",
  },
]

/**
 * Shown for WELCOME_DURATION_MS on every launch, then the route guard in
 * app/_layout.tsx moves on to sign-in (or the app, if already signed in).
 * No button: the timer is the only way forward.
 */
export default function WelcomeScreen() {
  const { finish } = useIntro();
  // Created once and never replaced (lazy state, not a ref, so the React
  // Compiler can see these are stable values safe to read during render).
  const [fade] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(16));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isWelcomeHeld()) {
      console.warn("Welcome screen is held (EXPO_PUBLIC_HOLD_WELCOME=1). Remove it from .env to auto-advance.");
      return;
    }
    const timer = setTimeout(finish, WELCOME_DURATION_MS);
    return () => clearTimeout(timer);
  }, [finish]);

  // Fade-and-rise entrance plus a progress bar that fills over the same five
  // seconds, so it's clear the screen will move on by itself. With the OS
  // "Reduce Motion" setting on, both are shown in their final state.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          fade.setValue(1);
          rise.setValue(0);
          progress.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(rise, { toValue: 0, duration: 450, useNativeDriver: true }),
          // While held, the bar stays empty rather than filling toward an advance that won't happen.
          ...(isWelcomeHeld()
            ? []
            : [Animated.timing(progress, { toValue: 1, duration: WELCOME_DURATION_MS, useNativeDriver: true })]),
        ]).start();
      });
    return () => {
      cancelled = true;
    };
  }, [fade, rise, progress]);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <Image
          source={require("../assets/streetleaf-logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Streetleaf"
        />

        <View style={styles.intro}>
          <Text style={styles.headline} accessibilityRole="header">
            Your solar street lights, wherever you are.
          </Text>
          <Text style={styles.lede}>
            Monitor and manage your Streetleaf lighting projects from your phone.
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.iconChip}>
                <Ionicons name={feature.icon} size={22} color={colors.accentStrong} />
              </View>
              <View style={styles.featureText}>
                <Text style={type.heading}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      <View
        style={styles.track}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View testID="welcome-progress" style={[styles.bar, { transform: [{ scaleX: progress }] }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xxl * 1.5, gap: space.xxl },
  // The wordmark is ~5.7:1.
  logo: { width: 200, height: 35 },
  intro: { gap: space.sm },
  headline: { fontSize: 30, lineHeight: 36, fontWeight: "700", color: colors.ink },
  lede: { fontSize: 17, lineHeight: 24, color: colors.inkMuted },
  features: { gap: space.xl },
  feature: { flexDirection: "row", gap: space.lg, alignItems: "flex-start" },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, gap: 2 },
  featureBody: { fontSize: 15, lineHeight: 21, color: colors.inkMuted },
  track: {
    height: 3,
    marginHorizontal: space.xl,
    marginBottom: space.lg,
    borderRadius: 2,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  // Grows from the left edge as scaleX goes 0 -> 1.
  bar: { flex: 1, backgroundColor: colors.accent, transformOrigin: "left" },
});
