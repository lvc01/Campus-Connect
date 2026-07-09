import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../../lib/api-client";
import { useAuth } from "../../../hooks/useAuth";
import { useTheme } from "../../../lib/theme-context";
import { useScrollHide } from "../../../lib/scroll-context";
import { Avatar } from "../../../components/Avatar";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../../lib/theme";
import type { Conversation, User } from "../../../types";

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { scrollProgress } = useScrollHide();
  const lastScrollY = useRef(0);
  const hiddenAmount = useRef(0);
  const [search, setSearch] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/messaging/conversations"),
  });

  const conversations = data || [];

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;
      if (diff > 0) {
        hiddenAmount.current = Math.min(1, hiddenAmount.current + diff / 60);
      } else {
        hiddenAmount.current = Math.max(0, hiddenAmount.current + diff / 60);
      }
      if (currentY <= 0) hiddenAmount.current = 0;
      scrollProgress.setValue(hiddenAmount.current);
    },
    [scrollProgress]
  );

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const otherMember = c.members.find((m) => m.user.id !== user?.id)?.user;
    const name = otherMember?.profile?.display_name || "";
    const lastMessage = c.last_message || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      lastMessage.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Search users for new conversation
  const handleSearchUsers = useCallback(async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<{ users: User[] }>("/search", { params: { q } });
      setUserResults((res.users || []).filter((u) => u.id !== user?.id));
    } catch { setUserResults([]); }
    finally { setSearching(false); }
  }, [user?.id]);

  // Create DM mutation
  const createDMMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post<{ id: string }>("/messaging/conversations", {
        type: "direct",
        member_ids: [userId],
      }),
    onSuccess: (data) => {
      setShowNewConv(false);
      setUserSearch("");
      setUserResults([]);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/(tabs)/messages/${data.id}`);
    },
  });

  const renderItem = useCallback(({ item }: { item: Conversation }) => {
    const otherMember = item.members.find((m) => m.user.id !== user?.id)?.user;
    const displayName = otherMember?.profile?.display_name || "Unknown";
    const displayAvatar = otherMember?.profile?.avatar_url || null;
    const isMuted = item.members.find((m) => m.user.id === user?.id)?.is_muted ?? false;
    const isMyLastMessage = item.last_sender_id === user?.id;
    let preview = item.last_message || "No messages yet";
    if (isMyLastMessage && item.last_message) {
      preview = `You: ${item.last_message}`;
    }

    return (
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: colors.border }]}
        onPress={() => router.push(`/(tabs)/messages/${item.id}`)}
        activeOpacity={0.7}
      >
        <Avatar uri={displayAvatar} name={displayName} size="md" />
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{displayName}</Text>
            <View style={styles.topRight}>
              {isMuted && <Ionicons name="volume-mute" size={12} color={colors.textTertiary} />}
              {item.last_message && (
                <Text style={[styles.time, { color: colors.textSecondary }]}>{getRelativeTime(item.updated_at)}</Text>
              )}
            </View>
          </View>
          <View style={styles.bottomRow}>
            <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={1}>{preview}</Text>
            {item.unread_count > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [user?.id, colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Messages</Text>
        <TouchableOpacity onPress={() => setShowNewConv(true)}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer]}>
        <View style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.textPrimary }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {search ? "No conversations found" : "No conversations yet"}
            </Text>
          </View>
        }
      />

      {/* New Conversation Modal */}
      <Modal visible={showNewConv} transparent animationType="slide" onRequestClose={() => setShowNewConv(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNewConv(false)}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Conversation</Text>
              <TouchableOpacity onPress={() => setShowNewConv(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* User search input */}
            <View style={[styles.userSearchContainer, { borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.userSearchInput, { color: colors.textPrimary }]}
                placeholder="Search by name or email..."
                placeholderTextColor={colors.textSecondary}
                value={userSearch}
                onChangeText={handleSearchUsers}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {/* User results */}
            <FlatList
              data={userResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  style={[styles.userResult, { borderBottomColor: colors.border }]}
                  onPress={() => createDMMutation.mutate(u.id)}
                  disabled={createDMMutation.isPending}
                >
                  <Avatar uri={u.avatar_url} name={u.display_name} size="md" />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{u.display_name}</Text>
                    <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                  </View>
                  <Ionicons name="chatbubble" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                userSearch.length < 2 ? (
                  <View style={styles.emptySearch}>
                    <Ionicons name="person-add" size={32} color={colors.textSecondary} />
                    <Text style={[styles.emptySearchText, { color: colors.textSecondary }]}>
                      Type at least 2 characters to search
                    </Text>
                  </View>
                ) : !searching ? (
                  <View style={styles.emptySearch}>
                    <Text style={[styles.emptySearchText, { color: colors.textSecondary }]}>No users found</Text>
                  </View>
                ) : null
              }
            />
          </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  item: {
    flexDirection: "row",
    padding: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: "600",
    flex: 1,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  time: {
    fontSize: fontSize.xs,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  message: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  empty: {
    paddingVertical: spacing.xxl * 3,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  userSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  userSearchInput: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  userResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  userEmail: {
    fontSize: fontSize.sm,
  },
  emptySearch: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptySearchText: {
    fontSize: fontSize.sm,
  },
});
