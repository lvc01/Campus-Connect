import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { MapPicker } from "../../components/MapPicker";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize } from "../../lib/theme";
import type { Event } from "../../types";

function toLocalISOString(dateStr: string): string | null {
  if (!dateStr.trim()) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toInputFormat(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.get<Event>(`/events/${id}`),
  });

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
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setStartTime(toInputFormat(event.start_time));
      setEndTime(event.end_time ? toInputFormat(event.end_time) : "");
      setLocation(event.location || "");
      setCoverImageUrl(event.cover_image_url || "");
      if (event.rsvp_limit) {
        setRsvpLimitEnabled(true);
        setRsvpLimit(String(event.rsvp_limit));
      }
    }
  }, [event]);

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
    if (!title.trim()) newErrors.title = "Title is required";
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

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => api.patch(`/events/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.back();
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const handleSubmit = async () => {
    if (!validate()) return;

    let finalCoverUrl = coverImageUrl.trim() || null;

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

    const payload: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      start_time: toLocalISOString(startTime),
      end_time: endTime.trim() ? toLocalISOString(endTime) : null,
      location: location.trim() || null,
      cover_image_url: finalCoverUrl,
      rsvp_limit: rsvpLimitEnabled && rsvpLimit.trim() ? parseInt(rsvpLimit, 10) : null,
    };

    updateMutation.mutate(payload);
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Event</Text>
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
          ) : coverImageUrl ? (
            <View style={styles.coverPreview}>
              <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
              <TouchableOpacity
                style={[styles.removeCoverBtn, { backgroundColor: colors.destructive }]}
                onPress={() => { setCoverImageUrl(""); setCoverImageUri(null); }}
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

          <View style={{ height: spacing.xl }} />

          <Button
            title="Save Changes"
            onPress={handleSubmit}
            loading={updateMutation.isPending || uploadingImage}
            disabled={updateMutation.isPending || uploadingImage}
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
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: "500", marginBottom: spacing.xs },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationInput: { flex: 1, minWidth: 0 },
  mapBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  coverPicker: {
    height: 140, borderRadius: 12, borderWidth: 1, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  coverPickerText: { fontSize: 13 },
  coverPreview: { position: "relative" },
  coverImage: { width: "100%", height: 160, borderRadius: 12 },
  removeCoverBtn: {
    position: "absolute", top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
});
