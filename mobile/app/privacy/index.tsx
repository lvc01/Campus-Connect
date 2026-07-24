import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize } from "../../lib/theme";

export default function PrivacyScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last updated: June 2026</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Information We Collect</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            When you register for CU Campus Connect, we collect your university email address,
            display name, faculty, and year of study. We also collect content you post,
            messages you send, and usage data to improve the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. How We Use Your Information</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We use your information to provide and improve the platform, verify your university
            affiliation, personalize your experience, and communicate important updates about
            the service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Data Sharing</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We do not sell your personal data to third parties. We may share anonymized,
            aggregated data for research purposes. Your profile information is visible to
            other verified university students.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Data Security</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We implement industry-standard security measures including encrypted data transmission,
            secure authentication, and regular security audits. However, no method of
            transmission is 100% secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Your Rights</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            You can access, update, or delete your account at any time through the settings page.
            To request a full data export, contact the platform administrators.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Cookies</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We use httpOnly cookies for authentication and security. These cookies are essential
            for the platform to function and are not used for tracking purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Contact</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            For questions about this privacy policy, contact the platform administrators
            through the university IT department.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  content: {
    padding: spacing.lg,
  },
  lastUpdated: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  sectionContent: {
    fontSize: fontSize.md,
    lineHeight: 24,
  },
});
