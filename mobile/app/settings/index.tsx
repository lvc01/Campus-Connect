import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";

interface UserSettings {
  push_notifications: boolean;
  email_notifications: boolean;
  like_notifications: boolean;
  comment_notifications: boolean;
  mention_notifications: boolean;
  event_notifications: boolean;
  public_profile: boolean;
  show_online_status: boolean;
  show_read_receipts: boolean;
}

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      ) : null}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

function SettingsRow({ icon, iconColor, label, value, onPress, showChevron = true, destructive }: SettingsRowProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: (iconColor || colors.primary) + "15" }]}>
        <Ionicons name={icon} size={18} color={iconColor || colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.textPrimary }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {showChevron && onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}

function ToggleRow({ icon, iconColor, label, description, value, onValueChange }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, styles.toggleRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: (iconColor || colors.primary) + "15" }]}>
        <Ionicons name={icon} size={18} color={iconColor || colors.primary} />
      </View>
      <View style={styles.toggleInfo}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {description && <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + "40" }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["userSettings"],
    queryFn: () => api.get<UserSettings>("/users/me/settings"),
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<UserSettings>) => api.patch<UserSettings>("/users/me/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete("/users/me"),
    onSuccess: async () => {
      await logout();
      router.replace("/(auth)/login");
    },
  });

  const handleSettingChange = (key: keyof UserSettings, value: boolean) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteAccountMutation.mutate(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(`/profile/${user?.id}`)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={user?.profile?.avatar_url}
            name={user?.profile?.display_name || user?.email || "U"}
            size="lg"
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]}>
              {user?.profile?.display_name || "Your Name"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            {user?.username && (
              <Text style={[styles.profileUsername, { color: colors.primary }]}>
                @{user.username}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsRow
            icon="at-outline"
            label="Username"
            value={`@${user?.username || "not set"}`}
            onPress={() => router.push("/username")}
          />
          <SettingsRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => router.push("/change-password")}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <ToggleRow
            icon="notifications-outline"
            iconColor="#f59e0b"
            label="Push Notifications"
            description="Receive notifications on your device"
            value={settings?.push_notifications ?? true}
            onValueChange={(val) => handleSettingChange("push_notifications", val)}
          />
          <ToggleRow
            icon="mail-outline"
            iconColor="#3b82f6"
            label="Email Notifications"
            description="Get notified via email"
            value={settings?.email_notifications ?? false}
            onValueChange={(val) => handleSettingChange("email_notifications", val)}
          />
          {settings?.push_notifications !== false && (
            <>
              <ToggleRow
                icon="heart-outline"
                iconColor="#ef4444"
                label="Likes"
                value={settings?.like_notifications ?? true}
                onValueChange={(val) => handleSettingChange("like_notifications", val)}
              />
              <ToggleRow
                icon="chatbubble-outline"
                iconColor="#10b981"
                label="Comments & Replies"
                value={settings?.comment_notifications ?? true}
                onValueChange={(val) => handleSettingChange("comment_notifications", val)}
              />
              <ToggleRow
                icon="at-outline"
                iconColor="#8b5cf6"
                label="Mentions"
                value={settings?.mention_notifications ?? true}
                onValueChange={(val) => handleSettingChange("mention_notifications", val)}
              />

              <ToggleRow
                icon="calendar-outline"
                iconColor="#f97316"
                label="Events"
                value={settings?.event_notifications ?? true}
                onValueChange={(val) => handleSettingChange("event_notifications", val)}
              />
            </>
          )}
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacy">
          <ToggleRow
            icon="eye-outline"
            iconColor="#10b981"
            label="Public Profile"
            description="Allow others to view your profile"
            value={settings?.public_profile ?? true}
            onValueChange={(val) => handleSettingChange("public_profile", val)}
          />
          <ToggleRow
            icon="radio-outline"
            iconColor="#3b82f6"
            label="Online Status"
            description="Show when you're active"
            value={settings?.show_online_status ?? true}
            onValueChange={(val) => handleSettingChange("show_online_status", val)}
          />
          <ToggleRow
            icon="checkmark-done-outline"
            iconColor="#8b5cf6"
            label="Read Receipts"
            description="Show when you've read messages"
            value={settings?.show_read_receipts ?? true}
            onValueChange={(val) => handleSettingChange("show_read_receipts", val)}
          />
          <SettingsRow
            icon="ban-outline"
            label="Blocked Users"
            value="0"
            onPress={() => Alert.alert("Coming Soon", "Blocked users list will be available soon.")}
          />
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support">
          <SettingsRow
            icon="help-circle-outline"
            iconColor="#3b82f6"
            label="Help Center"
            onPress={() => Alert.alert("Help Center", "Visit our help center at help.campusconnect.com")}
          />
          <SettingsRow
            icon="bug-outline"
            iconColor="#ef4444"
            label="Report a Bug"
            onPress={() => Alert.alert("Report a Bug", "Email us at bugs@campusconnect.com with details.")}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconColor="#10b981"
            label="Send Feedback"
            onPress={() => Alert.alert("Feedback", "We'd love to hear from you! Email feedback@campusconnect.com")}
          />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Legal">
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => router.push("/terms")}
          />
          <SettingsRow
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => router.push("/privacy")}
          />
          <SettingsRow
            icon="book-outline"
            label="Community Guidelines"
            onPress={() => Alert.alert("Community Guidelines", "Be kind, be respectful, be campus-spirited.")}
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow
            icon="information-circle-outline"
            label="App Version"
            value="1.0.0"
            showChevron={false}
          />
          <SettingsRow
            icon="star-outline"
            iconColor="#f59e0b"
            label="Rate Campus Connect"
            onPress={() => Alert.alert("Rate Us", "Thanks for your support! Visit the App Store to rate us.")}
          />
          <SettingsRow
            icon="share-outline"
            iconColor="#06b6d4"
            label="Share Campus Connect"
            onPress={() => Alert.alert("Share", "Share Campus Connect with your friends!")}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="">
          <SettingsRow
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            destructive
            showChevron={false}
          />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            destructive
            showChevron={false}
          />
        </SettingsSection>

        <Text style={[styles.version, { color: colors.textTertiary }]}>
          Campus Connect v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  profileEmail: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  profileUsername: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
  },
  rowValue: {
    fontSize: fontSize.sm,
    marginRight: spacing.xs,
  },
  toggleRow: {
    alignItems: "flex-start",
  },
  toggleInfo: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  version: {
    fontSize: fontSize.xs,
    textAlign: "center",
    paddingVertical: spacing.xxl,
    paddingBottom: spacing.xxl + spacing.lg,
  },
});
