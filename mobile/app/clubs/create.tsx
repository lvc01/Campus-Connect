import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const CATEGORY_OPTIONS = [
  { label: "Academic & Professional", value: "academic" },
  { label: "Sports & Recreation", value: "sports" },
  { label: "Arts & Culture", value: "cultural" },
  { label: "Social & Networking", value: "social" },
  { label: "Political & Activism", value: "political" },
  { label: "Faith & Spiritual", value: "religious" },
  { label: "Technology & Engineering", value: "tech" },
  { label: "Other Interests", value: "other" },
];

export default function CreateClubScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const pickLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to add a logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
      setLogoUrl("");
    }
  }, []);

  const pickBanner = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to add a banner.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setBannerUri(result.assets[0].uri);
      setBannerUrl("");
    }
  }, []);

  const uploadImage = async (uri: string): Promise<string> => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const filename = `club_upload_${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", {
      uri: manipulated.uri,
      name: filename,
      type: "image/jpeg",
    } as unknown as Blob);
    const result = await api.post<{ url: string }>("/posts/upload", formData, { timeoutMs: 120000 });
    return result.url;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let finalLogoUrl = logoUrl.trim() || null;
      let finalBannerUrl = bannerUrl.trim() || null;

      try {
        if (logoUri) {
          finalLogoUrl = await uploadImage(logoUri);
        }
        if (bannerUri) {
          finalBannerUrl = await uploadImage(bannerUri);
        }
      } finally {
        setUploading(false);
      }

      return api.post("/clubs", {
        name,
        category,
        description: description || undefined,
        logo_url: finalLogoUrl || undefined,
        banner_url: finalBannerUrl || undefined,
        requires_approval: requiresApproval,
      });
    },
    onSuccess: () => {
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Club name is required.");
      return;
    }
    if (!category) {
      Alert.alert("Validation", "Please select a category.");
      return;
    }
    createMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || uploading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Create Club</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Club Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Robotics Club"
          />

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Category *</Text>
          <Select
            options={CATEGORY_OPTIONS}
            value={category}
            onValueChange={setCategory}
            placeholder="Select a category"
          />

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Description</Text>
          <Textarea
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what your club is about..."
          />

          <View style={{ height: spacing.md }} />

          <View style={styles.toggleRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Require Approval to Join</Text>
            <Switch
              value={requiresApproval}
              onValueChange={setRequiresApproval}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryForeground}
            />
          </View>

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Logo</Text>
          {logoUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: logoUri }} style={styles.previewImage} />
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
                onPress={() => setLogoUri(null)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={pickLogo}
            >
              <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Choose logo</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Banner</Text>
          {bannerUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: bannerUri }} style={styles.bannerPreview} />
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: colors.destructive }]}
                onPress={() => setBannerUri(null)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={pickBanner}
            >
              <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Choose banner</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: spacing.xl }} />

          <Button
            title="Submit Request"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
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
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  imagePicker: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePickerText: { fontSize: 13 },
  imagePreview: { position: "relative" },
  previewImage: { width: 80, height: 80, borderRadius: 12 },
  bannerPreview: { width: "100%", height: 160, borderRadius: 12 },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
