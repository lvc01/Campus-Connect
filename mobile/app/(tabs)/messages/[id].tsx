import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useScrollHide } from "../../../lib/scroll-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Swipeable } from "react-native-gesture-handler";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../../../lib/api-client";
import { getWSClient, releaseWSClient } from "../../../lib/websocket";
import { useAuth } from "../../../hooks/useAuth";
import { useTheme } from "../../../lib/theme-context";
import { Avatar } from "../../../components/Avatar";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../../lib/theme";
import type { Message, Conversation } from "../../../types";
import type { WSClient } from "../../../lib/websocket";

  const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡", "👏", "🎉"];
  const MESSAGE_LIMIT = 50;

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateGroup(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface DateGroup {
  date: string;
  msgs: Message[];
}

function groupMessagesByDate(msgs: Message[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentDate = "";
  for (const msg of msgs) {
    const dateStr = getDateGroup(msg.created_at);
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groups.push({ date: dateStr, msgs: [] });
    }
    groups[groups.length - 1].msgs.push(msg);
  }
  return groups;
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { setHideTabBar } = useScrollHide();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Hide tab bar when in chat thread
  useEffect(() => {
    setHideTabBar(true);
    return () => setHideTabBar(false);
  }, [setHideTabBar]);

  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<Message | null>(null);
  const swipeableRefs = useRef(new Map<string, Swipeable>());
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const wsRef = useRef<WSClient | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch messages
  const { data } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => api.get<{ items: Message[] }>(`/messaging/conversations/${id}/messages?limit=${MESSAGE_LIMIT}`),
  });

  // Fetch conversations list (no individual conversation endpoint)
  const { data: convData } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/messaging/conversations"),
  });

  useEffect(() => {
    if (data?.items) {
      setMessages(data.items);
      setHasMore(data.items.length === MESSAGE_LIMIT);
    }
  }, [data]);

  useEffect(() => {
    const conv = convData?.find((c) => c.id === id);
    if (conv) {
      const me = conv.members.find((m) => m.user.id === user?.id);
      setIsMuted(me?.is_muted ?? false);
    }
  }, [convData, user, id]);

  const conv = convData?.find((c) => c.id === id);
  const otherMember = conv?.members?.find((m) => m.user.id !== user?.id);
  const chatName = otherMember?.user.profile?.display_name || "Chat";
  const chatAvatar = otherMember?.user.profile?.avatar_url || null;
  const otherUserId = otherMember?.user.id;

  // Fetch presence for the other member
  const { data: presenceData } = useQuery({
    queryKey: ["presence", otherUserId],
    queryFn: () => api.get<{ is_online: boolean }>(`/messaging/presence/${otherUserId}`),
    enabled: !!otherUserId,
    refetchInterval: 15000,
  });

  const isOnline = presenceData?.is_online ?? false;
  const lastReadAt = otherMember?.last_read_at ?? null;

  function formatLastSeen(dateStr: string | null): string {
    if (!dateStr) return "offline";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "last seen just now";
    if (mins < 60) return `last seen ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `last seen ${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `last seen ${days}d ago`;
  }

  // WebSocket connection
  useEffect(() => {
    let unsubMsg: (() => void) | null = null;
    let unsubTyping: (() => void) | null = null;

    (async () => {
      try {
        const ws = await getWSClient();
        wsRef.current = ws;
        ws.connect();

        unsubMsg = ws.on("new_message", (data: { conversation_id: string } & Message) => {
          if (data.conversation_id === id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data];
            });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        });

        unsubTyping = ws.on("typing", (data: { conversation_id: string; user_id: string; is_typing: boolean }) => {
          if (data.conversation_id === id && data.user_id !== user?.id) {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              if (data.is_typing) next.add(data.user_id);
              else next.delete(data.user_id);
              return next;
            });
          }
        });
      } catch (error) {
        console.error("WebSocket connection failed:", error);
      }
    })();

    return () => {
      unsubMsg?.();
      unsubTyping?.();
      releaseWSClient();
    };
  }, [id, queryClient, user?.id]);

  // Mark conversation as read on mount
  useEffect(() => {
    if (id) {
      api.post(`/messaging/conversations/${id}/read`).catch(() => {});
    }
  }, [id]);

  // Auto-clear stale typing indicators
  useEffect(() => {
    if (typingUsers.size === 0) return;
    const timer = setTimeout(() => setTypingUsers(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [typingUsers]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (payload: { content?: string; message_type?: string; file_url?: string; reply_to_message_id?: string }) =>
      api.post(`/messaging/conversations/${id}/messages`, {
        content: payload.content || null,
        message_type: payload.message_type || "text",
        file_url: payload.file_url || null,
        reply_to_message_id: payload.reply_to_message_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Edit message mutation
  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/messaging/conversations/${id}/messages/${messageId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
      setEditingMsg(null);
      setMessageInput("");
    },
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/messaging/conversations/${id}/messages/${messageId}`),
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData(["messages", id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((m: Message) => m.id !== messageId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    },
  });

  // Mute toggle mutation
  const muteMutation = useMutation({
    mutationFn: () => api.post<{ is_muted: boolean }>(`/messaging/conversations/${id}/mute`),
    onSuccess: (data) => {
      setIsMuted(data.is_muted);
    },
  });

  // Reaction mutation
  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.post(`/messaging/conversations/${id}/messages/${messageId}/reactions`, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    },
  });

  // Report mutation
  const reportMutation = useMutation({
    mutationFn: (category: string) =>
      api.post("/reports", {
        target_type: "message",
        target_id: selectedMsg?.id,
        category,
      }),
    onSuccess: () => {
      setShowReportModal(false);
      Alert.alert("Reported", "Thank you for your report.");
    },
  });

  // Search messages
  const searchMessages = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      api
        .get<{ items: Message[] }>(`/messaging/conversations/${id}/messages/search?q=${encodeURIComponent(query)}`)
        .then((data) => setSearchResults(data.items || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    },
    [id]
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => searchMessages(text), 400);
    },
    [searchMessages]
  );

  // Load older messages
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestId = messages[0]?.id;
      const data = await api.get<{ items: Message[] }>(
        `/messaging/conversations/${id}/messages?limit=${MESSAGE_LIMIT}&cursor=${oldestId}`
      );
      if (data.items && data.items.length > 0) {
        setMessages((prev) => [...data.items, ...prev]);
        setHasMore(data.items.length === MESSAGE_LIMIT);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Failed to load older messages:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, hasMore, messages]);

  // Typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      wsRef.current?.send("typing", { conversation_id: id, is_typing: isTyping });
    },
    [id]
  );

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, 3000);
  }, [sendTyping]);

  // Send / Edit handlers
  const handleSend = () => {
    if (!messageInput.trim()) return;
    if (editingMsg) {
      editMutation.mutate({ messageId: editingMsg.id, content: messageInput.trim() });
    } else {
      sendMutation.mutate({
        content: messageInput.trim(),
        reply_to_message_id: replyToMsg?.id,
      });
    }
    setMessageInput("");
    setReplyToMsg(null);
    setEditingMsg(null);
    // Stop typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  // File upload
  const handleFileUpload = async (type: "image" | "file") => {
    try {
      let result;
      if (type === "image") {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append("file", {
          uri: asset.uri,
          type: asset.mimeType || "image/jpeg",
          name: asset.fileName || "image.jpg",
        } as any);
        setUploading(true);
        const resp = await api.post<{ url: string; type: string }>("/posts/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        sendMutation.mutate({ content: asset.fileName || "Image", message_type: "image", file_url: resp.url });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append("file", {
          uri: asset.uri,
          type: asset.mimeType || "application/octet-stream",
          name: asset.name || "file",
        } as any);
        setUploading(true);
        const resp = await api.post<{ url: string; type: string }>("/posts/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        sendMutation.mutate({ content: asset.name || "File", message_type: "file", file_url: resp.url });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      Alert.alert("Upload Failed", "Could not upload the file.");
    } finally {
      setUploading(false);
    }
  };

  // Long press menu actions
  const handleMessagePress = (msg: Message) => {
    setSelectedMsg(msg);
    setShowMenu(true);
  };

  const handleEdit = () => {
    if (selectedMsg) {
      setEditingMsg(selectedMsg);
      setMessageInput(selectedMsg.content || "");
    }
    setShowMenu(false);
  };

  const handleReply = () => {
    if (selectedMsg) {
      setReplyToMsg(selectedMsg);
    }
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (!selectedMsg) return;
    const msgId = selectedMsg.id;
    setShowMenu(false);
    setTimeout(() => {
      Alert.alert("Delete Message", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(msgId),
        },
      ]);
    }, 100);
  };

  const handleAddReaction = () => {
    setShowMenu(false);
    setShowReactionPicker(true);
  };

  const handleReact = (emoji: string) => {
    if (selectedMsg) {
      reactionMutation.mutate({ messageId: selectedMsg.id, emoji });
    }
    setShowReactionPicker(false);
  };

  const scrollToMessage = (msgId: string) => {
    const idx = flatData.findIndex((d) => d.type === "message" && d.message?.id === msgId);
    if (idx >= 0) {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
    }
  };

  const searchResultIds = new Set(searchResults.map((r) => r.id));

  // Message rendering
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender.id === user?.id;
    const isImage = item.message_type === "image" && item.file_url;
    const isFile = item.message_type === "file" && item.file_url;
    const isHighlighted = searchResultIds.has(item.id);

    return (
      <Swipeable
        ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); else swipeableRefs.current.delete(item.id); }}
        renderLeftActions={() => (
          <View style={[styles.swipeReply, { backgroundColor: colors.primary + "22" }]}>
            <Ionicons name="arrow-undo" size={20} color={colors.primary} />
          </View>
        )}
        overshootLeft={false}
        friction={2.5}
        leftThreshold={30}
        onSwipeableWillOpen={() => {
          setTimeout(() => {
            swipeableRefs.current.get(item.id)?.close();
          }, 100);
          setReplyToMsg(item);
        }}
      >
      <TouchableOpacity
        onLongPress={() => handleMessagePress(item)}
        activeOpacity={0.8}
        style={[styles.row, isMine ? styles.rowEnd : styles.rowStart]}
      >
        <View style={[styles.bubbleWrapper]}>
          <View
            style={[
              styles.bubble,
              isMine
                ? [styles.bubbleMine, { backgroundColor: colors.primary }]
                : [styles.bubbleTheirs, { backgroundColor: colors.muted, borderColor: colors.border }],
              isHighlighted && { borderWidth: 2, borderColor: colors.warning },
            ]}
          >
            {item.reply_to && (
              <View style={[styles.replyQuote, { borderLeftColor: isMine ? colors.primaryForeground + "66" : colors.primary }]}>
                <Text style={[styles.replyName, { color: isMine ? colors.primaryForeground : colors.primary }]} numberOfLines={1}>
                  {item.reply_to.sender.profile?.display_name}
                </Text>
                <Text style={[styles.replyContent, { color: isMine ? colors.primaryForeground + "cc" : colors.textSecondary }]} numberOfLines={2}>
                  {item.reply_to.content || (item.reply_to.message_type === "image" ? "Photo" : "File")}
                </Text>
              </View>
            )}
            {isImage && (
              <Image source={{ uri: item.file_url! }} style={styles.messageImage} resizeMode="cover" />
            )}
            {isFile && (
              <View style={[styles.fileContainer, { borderColor: colors.border }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
                <Text style={[styles.fileName, { color: isMine ? colors.primaryForeground : colors.textPrimary }]} numberOfLines={1}>
                  {item.content || "Attachment"}
                </Text>
              </View>
            )}
            {item.content && !isImage && (
              <Text style={[styles.messageText, { color: isMine ? colors.primaryForeground : colors.textPrimary }]}>
                {item.content}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Text style={[styles.messageTime, { color: isMine ? colors.primaryForeground + "aa" : colors.textSecondary }]}>
                {formatTime(item.created_at)}
              </Text>
              {item.edited_at && (
                <Text style={[styles.editedLabel, { color: isMine ? colors.primaryForeground + "88" : colors.textTertiary }]}>
                  (edited)
                </Text>
              )}
              {isMine && lastReadAt && new Date(lastReadAt) >= new Date(item.created_at) && (
                <Text style={[styles.seenLabel, { color: colors.primaryForeground + "cc" }]}>
                  Seen
                </Text>
              )}
            </View>
          </View>
          {(() => {
            const grouped: Record<string, string[]> = {};
            (item.reactions || []).forEach((r: any) => {
              if (!grouped[r.emoji]) grouped[r.emoji] = [];
              grouped[r.emoji].push(r.user_id);
            });
            return Object.keys(grouped).length > 0 ? (
              <View style={styles.reactionsRow}>
                {Object.entries(grouped).map(([emoji, userIds]) => {
                  const hasReacted = userIds.includes(user?.id || "");
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => reactionMutation.mutate({ messageId: item.id, emoji })}
                      style={[
                        styles.reactionPill,
                        {
                          backgroundColor: hasReacted ? colors.primary + "22" : colors.muted,
                          borderColor: hasReacted ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null;
          })()}
        </View>
      </TouchableOpacity>
      </Swipeable>
    );
  };

  // Date separator rendering
  const renderMessages = () => {
    const groups = groupMessagesByDate(messages);
    const flatData: Array<{ type: "date" | "message"; date?: string; message?: Message }> = [];
    for (const group of groups) {
      flatData.push({ type: "date", date: group.date });
      for (const msg of group.msgs) {
        flatData.push({ type: "message", message: msg });
      }
    }
    return flatData;
  };

  const flatData = renderMessages();

  const typingUserNames = Array.from(typingUsers)
    .map((uid) => {
      // We don't have full user data, just show "Someone"
      return "Someone";
    })
    .join(", ");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Avatar uri={chatAvatar} name={chatName} size="sm" />
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{chatName}</Text>
          {typingUsers.size > 0 ? (
            <Text style={[styles.typingHeader, { color: colors.primary }]}>typing...</Text>
          ) : (
            <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.textSecondary }]}>
              {isOnline ? "online" : formatLastSeen(lastReadAt)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => { setSearchVisible(!searchVisible); if (searchVisible) { setSearchQuery(""); setSearchResults([]); } }}
          style={styles.headerAction}
        >
          <Ionicons name={searchVisible ? "close" : "search"} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => muteMutation.mutate()} style={styles.headerAction}>
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={20}
            color={isMuted ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search messages..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
          {searchQuery.length > 0 && !searching && (
            <Text style={[styles.searchCount, { color: colors.textSecondary }]}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={flatData}
        keyExtractor={(item, idx) =>
          item.type === "date" ? `date-${item.date}` : item.message?.id || `msg-${idx}`
        }
        renderItem={({ item }) => {
          if (item.type === "date") {
            return (
              <View style={styles.dateSeparator}>
                <View style={[styles.datePill, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.dateText, { color: colors.textSecondary }]}>{item.date}</Text>
                </View>
              </View>
            );
          }
          return renderMessage({ item: item.message! });
        }}
        ListHeaderComponent={
          hasMore ? (
            <TouchableOpacity
              onPress={handleLoadMore}
              disabled={loadingMore}
              style={[styles.loadMoreButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        contentContainerStyle={styles.messagesList}
      />

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.typingText, { color: colors.textSecondary }]}>
            {typingUserNames} is typing...
          </Text>
        </View>
      )}

      {/* Editing banner */}
      {editingMsg && (
        <View style={[styles.editBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="pencil" size={14} color={colors.primary} />
          <Text style={[styles.editBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
            Editing: {editingMsg.content}
          </Text>
          <TouchableOpacity onPress={() => { setEditingMsg(null); setMessageInput(""); }}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Reply banner */}
      {replyToMsg && (
        <View style={[styles.editBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="arrow-undo" size={14} color={colors.primary} />
          <Text style={[styles.editBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
            Replying to {replyToMsg.sender.profile?.display_name}: {replyToMsg.content}
          </Text>
          <TouchableOpacity onPress={() => setReplyToMsg(null)}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.inputContainer, { borderTopColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => handleFileUpload("image")} style={styles.attachButton} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="image" size={22} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleFileUpload("file")} style={styles.attachButton} disabled={uploading}>
          <Ionicons name="attach" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder={editingMsg ? "Edit message..." : "Type a message..."}
            placeholderTextColor={colors.mutedForeground}
            value={messageInput}
            onChangeText={(text) => { setMessageInput(text); handleTyping(); }}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: messageInput.trim() ? colors.primary : colors.muted }]}
          onPress={handleSend}
          disabled={!messageInput.trim() || sendMutation.isPending || editMutation.isPending}
        >
          <Ionicons name="send" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Reaction picker - inline bar */}
      {showReactionPicker && (
        <View style={[styles.reactionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {QUICK_REACTIONS.map((emoji) => (
            <TouchableOpacity key={emoji} style={styles.reactionBarButton} onPress={() => handleReact(emoji)}>
              <Text style={styles.reactionBarEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Long press menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuModal, { backgroundColor: colors.card }]}>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleAddReaction}>
              <Ionicons name="happy-outline" size={18} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.primary }]}>Add Reaction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleReply}>
              <Ionicons name="arrow-undo" size={18} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.primary }]}>Reply</Text>
            </TouchableOpacity>
            {selectedMsg?.sender.id === user?.id && (
              <>
                {selectedMsg?.created_at && (Date.now() - new Date(selectedMsg.created_at).getTime()) < 15 * 60 * 1000 && (
                  <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleEdit}>
                    <Ionicons name="pencil" size={18} color={colors.textPrimary} />
                    <Text style={[styles.menuText, { color: colors.textPrimary }]}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleDelete}>
                  <Ionicons name="trash" size={18} color={colors.error} />
                  <Text style={[styles.menuText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
            {selectedMsg?.sender.id !== user?.id && (
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => { setShowMenu(false); setShowReportModal(true); }}>
                <Ionicons name="flag" size={18} color={colors.warning} />
                <Text style={[styles.menuText, { color: colors.warning }]}>Report</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
              <Text style={[styles.menuText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report modal */}
      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
          <View style={[styles.menuModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.menuText, { color: colors.textPrimary, fontWeight: "600", paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>Report Message</Text>
            {(["spam", "harassment", "hate_speech", "inappropriate", "misinformation", "other"] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => reportMutation.mutate(cat)}
                disabled={reportMutation.isPending}
              >
                <Text style={[styles.menuText, { color: colors.error }]}>{cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowReportModal(false)}>
              <Text style={[styles.menuText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  typingHeader: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  statusText: {
    fontSize: 11,
    marginTop: 1,
  },
  headerAction: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  messagesList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    marginBottom: spacing.xs,
    maxWidth: "85%",
  },
  rowEnd: {
    alignSelf: "flex-end",
  },
  rowStart: {
    alignSelf: "flex-start",
  },
  bubbleWrapper: {
    maxWidth: "100%",
  },
  senderName: {
    fontSize: fontSize.xs,
    marginBottom: 2,
    marginLeft: spacing.xs,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 280,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
    maxWidth: 240,
  },
  replyName: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: 1,
  },
  replyContent: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  fileName: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  messageText: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  messageTime: {
    fontSize: 10,
  },
  editedLabel: {
    fontSize: 10,
    fontStyle: "italic",
  },
  seenLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  swipeReply: {
    justifyContent: "center",
    alignItems: "center",
    width: 50,
    marginVertical: spacing.xs,
    borderTopRightRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: spacing.md,
  },
  datePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  typingText: {
    fontSize: fontSize.xs,
    fontStyle: "italic",
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  editBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  inputContainer: {
    flexDirection: "row",
    padding: spacing.sm,
    borderTopWidth: 1,
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  attachButton: {
    padding: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    maxHeight: 100,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
  },
  sendButton: {
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  menuModal: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  menuText: {
    fontSize: fontSize.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: spacing.xs,
  },
  searchCount: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  loadMoreButton: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  loadMoreText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reactionBarButton: {
    padding: spacing.xs,
  },
  reactionBarEmoji: {
    fontSize: 28,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: "600",
  },
});
