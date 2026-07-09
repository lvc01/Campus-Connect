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

export default function TermsScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>Last updated: June 2026</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            By accessing CU Campus Connect, you agree to these terms. This platform is exclusively
            for verified Chandigarh University students and staff.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Eligibility</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            You must have a valid @cuchd.in email address to register. Accounts are non-transferable.
            Impersonation or misuse of the platform may result in account termination.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. User Conduct</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            You agree not to post content that is harmful, illegal, harassing, or violates
            university policies. You are responsible for all content you share on the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Content Ownership</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            You retain ownership of content you post. By posting, you grant CU Campus Connect
            a non-exclusive license to display and distribute your content within the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Marketplace</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            The marketplace is a peer-to-peer listing service. CU Campus Connect is not a party
            to any transaction between buyers and sellers. Users are responsible for verifying
            listings before purchasing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Account Termination</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We reserve the right to suspend or terminate accounts that violate these terms.
            You may delete your account at any time through the settings page.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Limitation of Liability</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            CU Campus Connect is provided "as is" without warranties. We are not liable
            for any damages arising from use of the platform.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>8. Changes to Terms</Text>
          <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
            We may update these terms from time to time. Continued use of the platform after
            changes constitutes acceptance of the new terms.
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
