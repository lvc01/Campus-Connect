import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api-client";
import { MapPicker } from "../../components/MapPicker";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Listing } from "../../types";

const CATEGORY_OPTIONS = [
  { label: "Textbook", value: "textbook" },
  { label: "Accommodation", value: "accommodation" },
  { label: "Tutoring", value: "tutoring" },
  { label: "Electronics", value: "electronics" },
  { label: "Clothing", value: "clothing" },
  { label: "Furniture", value: "furniture" },
  { label: "Sports", value: "sports" },
  { label: "Food", value: "food" },
  { label: "Transport", value: "transport" },
  { label: "Services", value: "services" },
  { label: "Other", value: "other" },
];

const CONDITION_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Like New", value: "like_new" },
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
];

interface CreateListingProps {
  editListing?: Listing;
}

export default function CreateListingScreen({ editListing }: CreateListingProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const isEditing = !!editListing;
  const isAdmin = user?.role === "admin";

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Access Denied</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.unauthorizedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.unauthorizedText, { color: colors.textPrimary }]}>Admin Only</Text>
          <Text style={[styles.unauthorizedSubtext, { color: colors.textSecondary }]}>
            Only administrators can create marketplace listings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [title, setTitle] = useState(editListing?.title || "");
  const [description, setDescription] = useState(editListing?.description || "");
  const [price, setPrice] = useState(editListing ? String(editListing.price) : "");
  const [category, setCategory] = useState(editListing?.category || "");
  const [condition, setCondition] = useState(editListing?.condition || "");
  const [location, setLocation] = useState(editListing?.location || "");
  const [images, setImages] = useState<string[]>(editListing?.images?.filter((img) => img.media_type === "image").map((img) => img.url) || []);
  const [videos, setVideos] = useState<string[]>(editListing?.images?.filter((img) => img.media_type === "video").map((img) => img.url) || []);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to add images.");
      return;
    }
    const remaining = 4 - images.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", "You can upload a maximum of 4 images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }, [images.length]);

  const pickVideos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to add videos.");
      return;
    }
    const remaining = 2 - videos.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", "You can upload a maximum of 2 videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets) {
      setVideos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }, [videos.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeVideo = useCallback((index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadMedia = useCallback(async (): Promise<{ url: string; media_type: string }[]> => {
    const allMedia = [...images, ...videos];
    if (allMedia.length === 0) return [];

    setUploadingMedia(true);
    const uploadedItems: { url: string; media_type: string }[] = [];

    try {
      for (const uri of allMedia) {
        const isVideo = uri.includes("video") || uri.endsWith(".mp4") || uri.endsWith(".mov") || uri.endsWith(".webm");
        const ext = uri.split(".").pop()?.toLowerCase() || "";
        const validExts = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
        const fileExt = validExts.includes(ext) ? ext : isVideo ? "mp4" : "jpg";

        let finalUri = uri;
        let mimeType: string;

        if (isVideo) {
          mimeType = fileExt === "mov" ? "video/quicktime" : fileExt === "webm" ? "video/webm" : "video/mp4";
        } else {
          // Compress images to reduce upload size
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalUri = manipulated.uri;
          mimeType = "image/jpeg";
        }

        const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${isVideo ? fileExt : "jpg"}`;

        const formData = new FormData();
        formData.append("file", {
          uri: finalUri,
          name: filename,
          type: mimeType,
        } as unknown as Blob);

        const result = await api.post<{ url: string }>("/posts/upload", formData, {
          timeoutMs: 180000,
        });
        uploadedItems.push({ url: result.url, media_type: isVideo ? "video" : "image" });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("too large") || msg.includes("File too large")) {
        Alert.alert("File Too Large", "Please use a smaller file. Images should be under 50MB, videos under 50MB.");
      } else if (msg.includes("not allowed") || msg.includes("does not match")) {
        Alert.alert("Unsupported Format", "Please use JPG, PNG, GIF, WebP for images or MP4, MOV for videos.");
      } else if (msg.includes("timed out") || msg.includes("Network")) {
        Alert.alert("Upload Failed", "Connection timed out. Check your internet and try a smaller file.");
      } else {
        Alert.alert("Upload Failed", msg || "Could not upload file. Please try again.");
      }
      throw err;
    } finally {
      setUploadingMedia(false);
    }

    return uploadedItems;
  }, [images, videos]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!price.trim()) {
      newErrors.price = "Price is required";
    } else if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      newErrors.price = "Please enter a valid price";
    }
    if (!category) {
      newErrors.category = "Category is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, price, category]);

  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      description: string;
      price: number;
      category: string;
      condition: string | null;
      location: string | null;
      media_items: { url: string; media_type: string }[];
    }) => {
      if (isEditing) {
        return api.patch<Listing>(`/marketplace/listings/${editListing.id}`, payload);
      }
      return api.post<Listing>("/marketplace/listings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      const uploadedItems = await uploadMedia();

      createMutation.mutate({
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        category,
        condition: condition || null,
        location: location.trim() || null,
        media_items: uploadedItems,
      });
    } catch {
      // uploadMedia already shows the error
    }
  }, [title, description, price, category, condition, location, images, videos, validate, uploadMedia, createMutation]);

  const isSubmitting = createMutation.isPending || uploadingMedia;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {isEditing ? "Edit Listing" : "Create Listing"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Input
              label="Title"
              placeholder="e.g. Engineering Mathematics Textbook"
              value={title}
              onChangeText={setTitle}
              error={errors.title}
              maxLength={100}
            />

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Description</Text>
              <Textarea
                placeholder="Describe your item, condition, location, etc."
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
              />
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Price (₹)</Text>
              <View style={styles.priceContainer}>
                <View style={[styles.pricePrefix, { borderColor: errors.price ? colors.destructive : colors.border, backgroundColor: colors.muted }]}>
                  <Text style={[styles.pricePrefixText, { color: colors.textSecondary }]}>₹</Text>
                </View>
                <Input
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  error={errors.price}
                  style={styles.priceInput}
                />
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Category *</Text>
              <Select
                options={CATEGORY_OPTIONS}
                value={category}
                onValueChange={setCategory}
                placeholder="Select category"
              />
              {errors.category && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.category}</Text>
              )}
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Condition</Text>
              <Select
                options={CONDITION_OPTIONS}
                value={condition}
                onValueChange={setCondition}
                placeholder="Select condition (optional)"
              />
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Location</Text>
              <View style={styles.locationRow}>
                <View style={styles.locationInput}>
                  <Input
                    placeholder="e.g. Campus Library, Hostel B"
                    value={location}
                    onChangeText={setLocation}
                    maxLength={300}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.mapBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}
                  onPress={() => setMapPickerOpen(true)}
                >
                  <Ionicons name="map-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Images (max 4)</Text>
              <View style={styles.imageGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={[styles.imageItem, { backgroundColor: colors.muted }]}>
                    <Image source={{ uri }} style={styles.imageThumbnail} />
                    <TouchableOpacity
                      style={[styles.removeImageButton, { backgroundColor: colors.destructive }]}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={14} color={colors.destructiveForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity
                    style={[styles.addImageButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={pickImages}
                    disabled={uploadingMedia}
                  >
                    <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Videos (max 2, up to 2 min each)</Text>
              <View style={styles.imageGrid}>
                {videos.map((uri, index) => (
                  <View key={index} style={[styles.imageItem, { backgroundColor: colors.muted }]}>
                    <Image source={{ uri }} style={styles.imageThumbnail} />
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={28} color="#fff" />
                    </View>
                    <TouchableOpacity
                      style={[styles.removeImageButton, { backgroundColor: colors.destructive }]}
                      onPress={() => removeVideo(index)}
                    >
                      <Ionicons name="close" size={14} color={colors.destructiveForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
                {videos.length < 2 && (
                  <TouchableOpacity
                    style={[styles.addImageButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={pickVideos}
                    disabled={uploadingMedia}
                  >
                    <Ionicons name="videocam-outline" size={24} color={colors.textSecondary} />
                    <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.spacer} />

            <Button
              title={isEditing ? "Save Changes" : "Create Listing"}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              fullWidth
              size="lg"
            />

            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MapPicker
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onSelect={(loc) => setLocation(loc)}
        initialLocation={location}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  form: {
    padding: spacing.lg,
  },
  fieldGap: {
    marginTop: spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationInput: {
    flex: 1,
    minWidth: 0,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pricePrefix: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    justifyContent: "center",
    minHeight: 40,
  },
  pricePrefixText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  priceInput: {
    flex: 1,
  },
  errorText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  imageItem: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  imageThumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  addImageText: {
    fontSize: fontSize.xs,
  },
  spacer: {
    height: spacing.lg,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  unauthorizedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  unauthorizedText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  unauthorizedSubtext: {
    fontSize: fontSize.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xxl,
  },
});
