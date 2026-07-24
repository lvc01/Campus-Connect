import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { Avatar } from "../../components/Avatar";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";

const FACULTY_OPTIONS = [
  { label: "Select your faculty...", value: "" },
  { label: "Faculty of Engineering", value: "Engineering" },
  { label: "Faculty of Computer Applications", value: "Computer Applications" },
  { label: "Faculty of Management / Business", value: "Management" },
  { label: "Faculty of Law", value: "Law" },
  { label: "Faculty of Pharmacy", value: "Pharmacy" },
  { label: "Faculty of Hospitality", value: "Hospitality" },
  { label: "Faculty of Media & Communication", value: "Media & Communication" },
  { label: "Faculty of Agriculture", value: "Agriculture" },
];

const YEAR_OPTIONS = [
  { label: "Select your year...", value: "" },
  { label: "1st Year (Freshman)", value: "1" },
  { label: "2nd Year", value: "2" },
  { label: "3rd Year", value: "3" },
  { label: "4th Year", value: "4" },
  { label: "5th Year (Masters)", value: "5" },
  { label: "6th Year / Ph.D.", value: "6" },
  { label: "Postdoctoral / Staff", value: "7" },
];

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.profile?.display_name || user?.display_name || "");
  const [faculty, setFaculty] = useState(user?.profile?.faculty || user?.faculty || "");
  const [yearOfStudy, setYearOfStudy] = useState(String(user?.profile?.year_of_study ?? user?.year_of_study ?? ""));
  const [bio, setBio] = useState(user?.profile?.bio || user?.bio || "");
  const [github, setGithub] = useState(
    (user?.profile?.social_links as Record<string, string>)?.github || user?.social_links?.[0] || ""
  );
  const [linkedin, setLinkedin] = useState(
    (user?.profile?.social_links as Record<string, string>)?.linkedin || user?.social_links?.[1] || ""
  );
  const [twitter, setTwitter] = useState(
    (user?.profile?.social_links as Record<string, string>)?.twitter || user?.social_links?.[2] || ""
  );
  const [instagram, setInstagram] = useState(
    (user?.profile?.social_links as Record<string, string>)?.instagram || ""
  );
  const [youtube, setYoutube] = useState(
    (user?.profile?.social_links as Record<string, string>)?.youtube || ""
  );
  const [whatsapp, setWhatsapp] = useState(
    (user?.profile?.social_links as Record<string, string>)?.whatsapp || ""
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.profile?.avatar_url || user?.avatar_url || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(user?.profile?.cover_url || user?.cover_url || null);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch("/users/me/profile", {
        display_name: displayName.trim(),
        faculty,
        year_of_study: yearOfStudy ? parseInt(yearOfStudy) : null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        social_links: {
          ...(github.trim() && { github: github.trim() }),
          ...(linkedin.trim() && { linkedin: linkedin.trim() }),
          ...(twitter.trim() && { twitter: twitter.trim() }),
          ...(instagram.trim() && { instagram: instagram.trim() }),
          ...(youtube.trim() && { youtube: youtube.trim() }),
          ...(whatsapp.trim() && { whatsapp: whatsapp.trim() }),
        },
      }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleAvatarUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleCoverUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setCoverUrl(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!displayName.trim()) {
      Alert.alert("Error", "Display name is required");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Cover photo */}
          <TouchableOpacity
            style={[styles.coverContainer, { backgroundColor: colors.muted }]}
            onPress={handleCoverUpload}
          >
            {coverUrl && (
              <Text style={[styles.coverText, { color: colors.textSecondary }]}>Cover Photo</Text>
            )}
            <View style={[styles.coverButton, { backgroundColor: colors.backdrop }]}>
              <Ionicons name="camera" size={16} color="#ffffff" />
              <Text style={styles.coverButtonText}>Cover photo</Text>
            </View>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarRow}>
            <Avatar uri={avatarUrl} name={displayName} size="xl" />
            <TouchableOpacity
              style={[styles.avatarButton, { backgroundColor: colors.primary }]}
              onPress={handleAvatarUpload}
            >
              <Ionicons name="camera" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>

          {/* Display name */}
          <Input
            label="Display name"
            placeholder="e.g. Arjun"
            value={displayName}
            onChangeText={setDisplayName}
          />

          {/* Faculty */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Faculty</Text>
            <Select
              options={FACULTY_OPTIONS}
              value={faculty}
              onValueChange={setFaculty}
              placeholder="Select your faculty..."
            />
          </View>

          {/* Year of study */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Year of study</Text>
            <Select
              options={YEAR_OPTIONS}
              value={yearOfStudy}
              onValueChange={setYearOfStudy}
              placeholder="Select your year..."
            />
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Bio</Text>
              <Text style={[styles.fieldCount, { color: colors.textSecondary }]}>
                {bio.length} / 500
              </Text>
            </View>
            <Input
              placeholder="Share something about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Social links */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Social Links</Text>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>GitHub URL</Text>
            <Input
              placeholder="https://github.com/username"
              value={github}
              onChangeText={setGithub}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>LinkedIn URL</Text>
            <Input
              placeholder="https://linkedin.com/in/username"
              value={linkedin}
              onChangeText={setLinkedin}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Twitter/X URL</Text>
            <Input
              placeholder="https://x.com/username"
              value={twitter}
              onChangeText={setTwitter}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Instagram URL</Text>
            <Input
              placeholder="https://instagram.com/username"
              value={instagram}
              onChangeText={setInstagram}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>YouTube URL</Text>
            <Input
              placeholder="https://youtube.com/@username"
              value={youtube}
              onChangeText={setYoutube}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>WhatsApp Number</Text>
            <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.phonePrefix, { color: colors.textSecondary, borderRightColor: colors.border }]}>+91</Text>
              <TextInput
                style={[styles.phoneInput, { color: colors.textPrimary }]}
                placeholder="Enter your number"
                placeholderTextColor={colors.mutedForeground}
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={{ height: spacing.lg }} />
          <Button
            title="Save changes"
            onPress={handleSubmit}
            loading={updateMutation.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  coverContainer: {
    height: 120,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xxl,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  coverText: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
  },
  coverButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  coverButtonText: {
    color: "#ffffff",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: -40,
    marginBottom: spacing.xl,
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  fieldCount: {
    fontSize: fontSize.xs,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  phonePrefix: {
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderRightWidth: 1,
  },
  phoneInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
  },
});
