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
  Switch,
  Image,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { MapPicker } from "../../components/MapPicker";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize } from "../../lib/theme";
import type { Club } from "../../types";

interface CreateEventPayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  rsvp_limit: number | null;
  club_id: string | null;
}

function toLocalISOString(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function CreateEventScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [rsvpLimitEnabled, setRsvpLimitEnabled] = useState(false);
  const [rsvpLimit, setRsvpLimit] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | undefined>(undefined);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: clubs } = useQuery({
    queryKey: ["user-clubs", user?.id],
    queryFn: () => api.get<Club[]>("/clubs"),
    enabled: !!user,
  });

  const userClubs = clubs?.filter((c) => c.is_member) ?? [];

  const clubOptions = userClubs.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const pickCoverImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to add a cover image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
      setCoverImageUrl("");
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!startTime.trim()) {
      newErrors.startTime = "Start time is required";
    } else if (!toLocalISOString(startTime)) {
      newErrors.startTime = "Enter a valid date/time (e.g. 2026-07-15 14:00)";
    }

    if (endTime.trim() && !toLocalISOString(endTime)) {
      newErrors.endTime = "Enter a valid date/time (e.g. 2026-07-15 16:00)";
    }

    if (rsvpLimitEnabled) {
      const limit = parseInt(rsvpLimit, 10);
      if (!rsvpLimit.trim() || isNaN(limit) || limit <= 0) {
        newErrors.rsvpLimit = "Enter a valid number greater than 0";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateEventPayload) => api.post("/events", payload),
    onSuccess: () => {
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleSubmit = async () => {
    if (!validate()) return;

    let finalCoverUrl = coverImageUrl.trim() || null;

    // Upload cover image if one was picked
    if (coverImageUri) {
      setUploadingImage(true);
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          coverImageUri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const filename = `event_cover_${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append("file", {
          uri: manipulated.uri,
          name: filename,
          type: "image/jpeg",
        } as unknown as Blob);
        const result = await api.post<{ url: string }>("/posts/upload", formData, { timeoutMs: 120000 });
        finalCoverUrl = result.url;
      } catch (err: any) {
        Alert.alert("Upload Failed", err?.message || "Could not upload cover image.");
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    const payload: CreateEventPayload = {
      title: title.trim(),
      description: description.trim(),
      start_time: toLocalISOString(startTime)!,
      end_time: endTime.trim() ? toLocalISOString(endTime) : null,
      location: location.trim() || null,
      cover_image_url: finalCoverUrl,
      rsvp_limit: rsvpLimitEnabled && rsvpLimit.trim() ? parseInt(rsvpLimit, 10) : null,
      club_id: selectedClubId ?? null,
    };

    createMutation.mutate(payload);
  };

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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Create Event</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label="Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            error={errors.title}
          />

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Description</Text>
          <Textarea
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event..."
          />

          <View style={{ height: spacing.md }} />

          <Input
            label="Start Time *"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="YYYY-MM-DD HH:MM"
            error={errors.startTime}
            helperText="Format: YYYY-MM-DD HH:MM (e.g. 2026-07-15 14:00)"
          />

          <View style={{ height: spacing.md }} />

          <Input
            label="End Time"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="YYYY-MM-DD HH:MM"
            error={errors.endTime}
            helperText="Leave empty if no end time"
          />

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Location</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationInput}>
              <Input
                value={location}
                onChangeText={setLocation}
                placeholder="Where is the event?"
              />
            </View>
            <TouchableOpacity
              style={[styles.mapBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}
              onPress={() => setMapPickerOpen(true)}
            >
              <Ionicons name="map-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={{ height: spacing.md }} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>Cover Image</Text>
          {coverImageUri ? (
            <View style={styles.coverPreview}>
              <Image source={{ uri: coverImageUri }} style={styles.coverImage} />
              <TouchableOpacity
                style={[styles.removeCoverBtn, { backgroundColor: colors.destructive }]}
                onPress={() => setCoverImageUri(null)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.coverPicker, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={pickCoverImage}
            >
              <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              <Text style={[styles.coverPickerText, { color: colors.textSecondary }]}>Choose from gallery</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: spacing.md }} />

          <View style={styles.toggleRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Set RSVP Limit</Text>
            <Switch
              value={rsvpLimitEnabled}
              onValueChange={setRsvpLimitEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryForeground}
            />
          </View>

          {rsvpLimitEnabled && (
            <>
              <View style={{ height: spacing.sm }} />
              <Input
                label="RSVP Limit"
                value={rsvpLimit}
                onChangeText={setRsvpLimit}
                placeholder="Max attendees"
                keyboardType="numeric"
                error={errors.rsvpLimit}
              />
            </>
          )}

          {clubOptions.length > 0 && (
            <>
              <View style={{ height: spacing.md }} />
              <Text style={[styles.label, { color: colors.textPrimary }]}>Club</Text>
              <Select
                options={clubOptions}
                value={selectedClubId}
                onValueChange={setSelectedClubId}
                placeholder="Select a club (optional)"
              />
            </>
          )}

          <View style={{ height: spacing.xl }} />

          <Button
            title="Create Event"
            onPress={handleSubmit}
            loading={createMutation.isPending || uploadingImage}
            disabled={createMutation.isPending || uploadingImage}
            fullWidth
          />

          <View style={{ height: spacing.xxl }} />
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
  coverPicker: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coverPickerText: { fontSize: 13 },
  coverPreview: { position: "relative" },
  coverImage: { width: "100%", height: 160, borderRadius: 12 },
  removeCoverBtn: {
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
