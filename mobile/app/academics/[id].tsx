import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Course } from "../../types";

type ResourceType = "notes" | "past_paper" | "study_guide" | "other";

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: ResourceType;
  file_url: string;
  download_count: number;
  uploaded_by: { id: string; display_name: string };
  created_at: string;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  member_count: number;
  max_members: number;
  is_member: boolean;
  created_by: { id: string; display_name: string };
}

const RESOURCE_TYPE_CONFIG: Record<ResourceType, { icon: string; label: string }> = {
  notes: { icon: "\ud83d\udcdd", label: "Notes" },
  past_paper: { icon: "\ud83d\udcc4", label: "Past Paper" },
  study_guide: { icon: "\ud83d\udcda", label: "Study Guide" },
  other: { icon: "\ud83d\udcce", label: "Other" },
};

const RESOURCE_TYPES: ResourceType[] = ["notes", "past_paper", "study_guide", "other"];

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"resources" | "groups">("resources");
  const [resourceFilter, setResourceFilter] = useState<ResourceType | "all">("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadType, setUploadType] = useState<ResourceType>("notes");
  const [uploadFileUrl, setUploadFileUrl] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupMaxMembers, setGroupMaxMembers] = useState("10");

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: () => api.get<Course>(`/academics/courses/${id}`),
  });

  const resourceParams =
    resourceFilter !== "all" ? { resource_type: resourceFilter } : {};

  const {
    data: resourcesData,
    refetch: refetchResources,
    isRefetching: refetchingResources,
  } = useQuery({
    queryKey: ["course-resources", id, resourceFilter],
    queryFn: () =>
      api.get<{ items: Resource[] }>(`/academics/courses/${id}/resources`, {
        params: resourceParams as Record<string, string>,
      }),
  });

  const {
    data: groupsData,
    refetch: refetchGroups,
    isRefetching: refetchingGroups,
  } = useQuery({
    queryKey: ["course-groups", id],
    queryFn: () =>
      api.get<{ items: StudyGroup[] }>(
        `/academics/courses/${id}/study-groups`
      ),
  });

  const resources = resourcesData?.items || [];
  const groups = groupsData?.items || [];

  const joinLeaveMutation = useMutation({
    mutationFn: () =>
      course?.is_member
        ? api.delete(`/academics/courses/${id}/join`)
        : api.post(`/academics/courses/${id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const uploadResourceMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      description: string;
      resource_type: string;
      file_url: string;
    }) => api.post(`/academics/courses/${id}/resources`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-resources", id] });
      queryClient.invalidateQueries({ queryKey: ["course", id] });
      resetUploadForm();
      setShowUploadModal(false);
      Alert.alert("Success", "Resource uploaded successfully");
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const createGroupMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description: string;
      max_members: number;
    }) => api.post(`/academics/courses/${id}/study-groups`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-groups", id] });
      resetGroupForm();
      setShowCreateGroupModal(false);
      Alert.alert("Success", "Study group created");
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const downloadMutation = useMutation({
    mutationFn: (resourceId: string) =>
      api.post(`/academics/resources/${resourceId}/download`),
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const groupJoinLeaveMutation = useMutation({
    mutationFn: ({
      groupId,
      isMember,
    }: {
      groupId: string;
      isMember: boolean;
    }) =>
      isMember
        ? api.post(`/academics/study-groups/${groupId}/leave`)
        : api.post(`/academics/study-groups/${groupId}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-groups", id] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const uploadFileMutation = useMutation({
    mutationFn: (formData: FormData) =>
      api.post<{ url: string }>("/posts/upload", formData, { timeoutMs: 60000 }),
    onSuccess: (data: { url: string }) => {
      setUploadFileUrl(data.url);
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadDescription("");
    setUploadType("notes");
    setUploadFileUrl("");
  };

  const resetGroupForm = () => {
    setGroupName("");
    setGroupDescription("");
    setGroupMaxMembers("10");
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append("file", {
          uri: asset.uri,
          name: asset.name || "document",
          type: asset.mimeType || "application/octet-stream",
        } as unknown as Blob);
        uploadFileMutation.mutate(formData);
      }
    } catch {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleDownload = (resource: Resource) => {
    downloadMutation.mutate(resource.id);
    try {
      Linking.openURL(resource.file_url);
    } catch {
      Alert.alert("Error", "Unable to open the file. Please check the URL.");
    }
  };

  const handleSubmitResource = () => {
    if (!uploadTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    if (!uploadFileUrl) {
      Alert.alert("Error", "Please select a file first");
      return;
    }
    uploadResourceMutation.mutate({
      title: uploadTitle.trim(),
      description: uploadDescription.trim(),
      resource_type: uploadType,
      file_url: uploadFileUrl,
    });
  };

  const handleSubmitGroup = () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Group name is required");
      return;
    }
    const max = parseInt(groupMaxMembers, 10);
    if (isNaN(max) || max < 2) {
      Alert.alert("Error", "Max members must be at least 2");
      return;
    }
    createGroupMutation.mutate({
      name: groupName.trim(),
      description: groupDescription.trim(),
      max_members: max,
    });
  };

  const renderResource = useCallback(
    ({ item }: { item: Resource }) => {
      const config = RESOURCE_TYPE_CONFIG[item.resource_type];
      return (
        <View
          style={[
            styles.resourceCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.resourceRow}>
            <Text style={styles.resourceIcon}>{config.icon}</Text>
            <View style={styles.resourceInfo}>
              <Text
                style={[styles.resourceTitle, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.resourceMeta, { color: colors.textSecondary }]}
              >
                {config.label} \u00b7 {item.download_count} downloads
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                { backgroundColor: colors.primary + "20" },
              ]}
              onPress={() => handleDownload(item)}
            >
              <Ionicons name="download-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {item.description ? (
            <Text
              style={[
                styles.resourceDesc,
                { color: colors.textSecondary },
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}
        </View>
      );
    },
    [colors]
  );

  const renderGroup = useCallback(
    ({ item }: { item: StudyGroup }) => (
      <View
        style={[
          styles.groupCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.groupHeader}>
          <Ionicons name="people" size={20} color={colors.primary} />
          <View style={styles.groupHeaderInfo}>
            <Text
              style={[styles.groupName, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[styles.groupMeta, { color: colors.textSecondary }]}
            >
              {item.member_count}/{item.max_members} members
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text
            style={[styles.groupDesc, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.groupJoinBtn,
            item.is_member
              ? { backgroundColor: colors.muted, borderColor: colors.border }
              : { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() =>
            groupJoinLeaveMutation.mutate({
              groupId: item.id,
              isMember: item.is_member,
            })
          }
        >
          <Text
            style={[
              styles.groupJoinText,
              {
                color: item.is_member
                  ? colors.textSecondary
                  : colors.primaryForeground,
              },
            ]}
          >
            {item.is_member ? "Leave" : "Join"}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [colors, groupJoinLeaveMutation]
  );

  if (courseLoading || !course) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {course.code}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.courseSection}>
          <View style={styles.courseCodeRow}>
            <View
              style={[
                styles.codeBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Text style={[styles.codeText, { color: colors.primary }]}>
                {course.code}
              </Text>
            </View>
            {course.year && (
              <Text style={[styles.yearText, { color: colors.textSecondary }]}>
                Year {course.year}
                {course.semester ? ` \u00b7 Sem ${course.semester}` : ""}
              </Text>
            )}
          </View>

          <Text style={[styles.courseName, { color: colors.textPrimary }]}>
            {course.name}
          </Text>
          <Text style={[styles.facultyText, { color: colors.textSecondary }]}>
            {course.faculty}
          </Text>

          {course.description ? (
            <Text
              style={[styles.courseDesc, { color: colors.textSecondary }]}
            >
              {course.description}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={16} color={colors.textSecondary} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {course.member_count} members
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name="document-text"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {course.resource_count} resources
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.joinLeaveBtn,
              course.is_member
                ? {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  }
                : {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
            ]}
            onPress={() => joinLeaveMutation.mutate()}
            disabled={joinLeaveMutation.isPending}
          >
            {joinLeaveMutation.isPending ? (
              <ActivityIndicator
                size="small"
                color={
                  course.is_member ? colors.textSecondary : colors.primaryForeground
                }
              />
            ) : (
              <>
                <Ionicons
                  name={
                    course.is_member ? "person-remove" : "person-add"
                  }
                  size={18}
                  color={
                    course.is_member
                      ? colors.textSecondary
                      : colors.primaryForeground
                  }
                />
                <Text
                  style={[
                    styles.joinLeaveText,
                    {
                      color: course.is_member
                        ? colors.textSecondary
                        : colors.primaryForeground,
                    },
                  ]}
                >
                  {course.is_member ? "Leave Course" : "Join Course"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "resources" && {
                borderBottomColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab("resources")}
          >
            <Ionicons
              name="document-text"
              size={16}
              color={
                activeTab === "resources"
                  ? colors.primary
                  : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "resources"
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              Resources ({resources.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "groups" && {
                borderBottomColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab("groups")}
          >
            <Ionicons
              name="people"
              size={16}
              color={
                activeTab === "groups" ? colors.primary : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "groups"
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              Study Groups ({groups.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "resources" ? (
          <View style={styles.tabContent}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      resourceFilter === "all"
                        ? colors.primary
                        : "transparent",
                    borderColor:
                      resourceFilter === "all"
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => setResourceFilter("all")}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        resourceFilter === "all"
                          ? colors.primaryForeground
                          : colors.textSecondary,
                    },
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {RESOURCE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        resourceFilter === type
                          ? colors.primary
                          : "transparent",
                      borderColor:
                        resourceFilter === type
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setResourceFilter(type)}
                >
                  <Text style={styles.filterEmoji}>
                    {RESOURCE_TYPE_CONFIG[type].icon}
                  </Text>
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          resourceFilter === type
                            ? colors.primaryForeground
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {RESOURCE_TYPE_CONFIG[type].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.uploadBtn,
                { backgroundColor: colors.primary + "15" },
              ]}
              onPress={() => setShowUploadModal(true)}
            >
              <Ionicons name="cloud-upload" size={18} color={colors.primary} />
              <Text style={[styles.uploadBtnText, { color: colors.primary }]}>
                Upload Resource
              </Text>
            </TouchableOpacity>

            <FlatList
              data={resources}
              keyExtractor={(item) => item.id}
              renderItem={renderResource}
              refreshControl={
                <RefreshControl
                  refreshing={refetchingResources}
                  onRefresh={refetchResources}
                />
              }
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons
                    name="document-text-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    No resources yet. Be the first to upload!
                  </Text>
                </View>
              }
            />
          </View>
        ) : (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={[
                styles.uploadBtn,
                { backgroundColor: colors.primary + "15" },
              ]}
              onPress={() => setShowCreateGroupModal(true)}
            >
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <Text style={[styles.uploadBtnText, { color: colors.primary }]}>
                Create Study Group
              </Text>
            </TouchableOpacity>

            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              renderItem={renderGroup}
              refreshControl={
                <RefreshControl
                  refreshing={refetchingGroups}
                  onRefresh={refetchGroups}
                />
              }
              scrollEnabled={false}
              numColumns={2}
              columnWrapperStyle={styles.groupRow}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    No study groups yet. Create one!
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          resetUploadForm();
          setShowUploadModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              resetUploadForm();
              setShowUploadModal(false);
            }}
          />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: colors.textPrimary }]}
              >
                Upload Resource
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resetUploadForm();
                  setShowUploadModal(false);
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="e.g. Chapter 1 Notes"
                placeholderTextColor={colors.textTertiary}
                value={uploadTitle}
                onChangeText={setUploadTitle}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="Brief description..."
                placeholderTextColor={colors.textTertiary}
                value={uploadDescription}
                onChangeText={setUploadDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Type
              </Text>
              <View style={styles.typeRow}>
                {RESOURCE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor:
                          uploadType === type
                            ? colors.primary
                            : "transparent",
                        borderColor:
                          uploadType === type ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setUploadType(type)}
                  >
                    <Text style={styles.typeEmoji}>
                      {RESOURCE_TYPE_CONFIG[type].icon}
                    </Text>
                    <Text
                      style={[
                        styles.typeLabel,
                        {
                          color:
                            uploadType === type
                              ? colors.primaryForeground
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {RESOURCE_TYPE_CONFIG[type].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                File *
              </Text>
              {uploadFileUrl ? (
                <View
                  style={[
                    styles.filePreview,
                    {
                      borderColor: colors.success + "40",
                      backgroundColor: colors.success + "10",
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.fileName, { color: colors.success }]}
                    numberOfLines={1}
                  >
                    File selected
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.filePicker,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={handlePickDocument}
                  disabled={uploadFileMutation.isPending}
                >
                  {uploadFileMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name="attach"
                        size={20}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filePickerText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Tap to select a file
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor:
                      uploadTitle.trim() && uploadFileUrl
                        ? colors.primary
                        : colors.muted,
                  },
                ]}
                onPress={handleSubmitResource}
                disabled={
                  !uploadTitle.trim() ||
                  !uploadFileUrl ||
                  uploadResourceMutation.isPending
                }
              >
                {uploadResourceMutation.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.submitBtnText,
                      {
                        color:
                          uploadTitle.trim() && uploadFileUrl
                            ? colors.primaryForeground
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    Upload
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          resetGroupForm();
          setShowCreateGroupModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              resetGroupForm();
              setShowCreateGroupModal(false);
            }}
          />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: colors.textPrimary }]}
              >
                Create Study Group
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resetGroupForm();
                  setShowCreateGroupModal(false);
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Group Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="e.g. Study Group A"
                placeholderTextColor={colors.textTertiary}
                value={groupName}
                onChangeText={setGroupName}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="What will this group study?"
                placeholderTextColor={colors.textTertiary}
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Max Members
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                placeholder="10"
                placeholderTextColor={colors.textTertiary}
                value={groupMaxMembers}
                onChangeText={setGroupMaxMembers}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: groupName.trim()
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
                onPress={handleSubmitGroup}
                disabled={!groupName.trim() || createGroupMutation.isPending}
              >
                {createGroupMutation.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.submitBtnText,
                      {
                        color: groupName.trim()
                          ? colors.primaryForeground
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    Create Group
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },
  courseSection: {
    padding: spacing.lg,
  },
  courseCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  codeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  yearText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  courseName: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  facultyText: {
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  courseDesc: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
  },
  joinLeaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  joinLeaveText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  tabContent: {
    padding: spacing.lg,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterEmoji: {
    fontSize: 12,
  },
  filterChipText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  uploadBtnText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  resourceCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resourceIcon: {
    fontSize: 24,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  resourceMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceDesc: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  groupRow: {
    gap: spacing.sm,
  },
  groupCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupHeaderInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  groupMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  groupDesc: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: spacing.sm,
  },
  groupJoinBtn: {
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  groupJoinText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  modalForm: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  typeEmoji: {
    fontSize: 14,
  },
  typeLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  filePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xl,
  },
  filePickerText: {
    fontSize: fontSize.sm,
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fileName: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  submitBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
  },
  submitBtnText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
