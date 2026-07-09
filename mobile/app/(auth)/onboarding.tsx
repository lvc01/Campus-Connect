import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";

const STEPS = [
  {
    icon: "book" as const,
    title: "Academic Feed",
    description: "See posts from your faculty and clubs. Posts are filtered by faculty so you only see relevant content.",
    color: "#3b82f6",
  },
  {
    icon: "people" as const,
    title: "Clubs & Societies",
    description: "Join clubs, participate in events, and connect with like-minded students.",
    color: "#8b5cf6",
  },
  {
    icon: "calendar" as const,
    title: "Events",
    description: "Discover campus events, RSVP to attend, and never miss out on what's happening.",
    color: "#22c55e",
  },
  {
    icon: "bag" as const,
    title: "Marketplace",
    description: "Buy and sell textbooks, electronics, and more with fellow students.",
    color: "#f97316",
  },
  {
    icon: "chatbubbles" as const,
    title: "Messaging",
    description: "Chat privately with other students. Share posts and collaborate in real-time.",
    color: "#ec4899",
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      router.push("/profile/setup");
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    router.push("/profile/setup");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step ? colors.primary : i < step ? colors.primary + "80" : colors.border,
                  width: i === step ? 32 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Step content */}
        <View style={styles.stepContent}>
          <View style={[styles.iconContainer, { backgroundColor: current.color + "20" }]}>
            <Ionicons name={current.icon} size={40} color={current.color} />
          </View>
          <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{current.title}</Text>
          <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>{current.description}</Text>
        </View>

        {/* Navigation */}
        <View style={styles.navigation}>
          {!isFirst && (
            <TouchableOpacity
              style={[styles.navButton, { borderColor: colors.border }]}
              onPress={() => setStep(step - 1)}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={handleNext}
          >
            {isLast ? (
              <Text style={[styles.nextButtonText, { color: colors.primaryForeground }]}>
                ✅ Set Up Profile
              </Text>
            ) : (
              <Text style={[styles.nextButtonText, { color: colors.primaryForeground }]}>
                Next →
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip introduction</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: spacing.xxl * 2,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    alignItems: "center",
    marginBottom: spacing.xxl * 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  stepTitle: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  stepDescription: {
    fontSize: fontSize.md,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  navigation: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  skipButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
