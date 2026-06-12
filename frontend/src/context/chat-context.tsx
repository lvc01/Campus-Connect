"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getWSClient, releaseWSClient, WSClient } from "@/lib/websocket";

interface UserProfile {
  id: string;
  email: string;
  profile: { display_name: string; avatar_url: string | null } | null;
}

interface ConversationMember {
  user: UserProfile;
  role: string;
  last_read_at: string | null;
  is_muted: boolean;
}

export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread_count: number;
}

export interface MessageData {
  id: string;
  conversation_id: string;
  sender: UserProfile;
  content: string | null;
  message_type: string;
  file_url: string | null;
  edited_at: string | null;
  created_at: string;
  reactions?: MessageReactionData[];
}

export interface MessageReactionData {
  id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface ChatContextValue {
  conversations: Conversation[];
  unreadTotal: number;
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;
  messages: MessageData[];
  messagesLoading: boolean;
  sendMessage: (content: string, messageType?: string, fileUrl?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleMute: (conversationId: string) => Promise<boolean>;
  searchMessages: (conversationId: string, query: string) => Promise<MessageData[]>;
  loadMoreMessages: () => void;
  hasMoreMessages: boolean;
  markRead: (convId: string) => Promise<void>;
  createDM: (userId: string) => Promise<string | null>;
  refreshConversations: () => Promise<void>;
  typingUsers: Set<string>;
  sendTyping: (convId: string, isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WSClient | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  // Fetch conversations
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await apiClient.get("/messaging/conversations");
      const conversationsData = resp.data;
      const unreadResp = await apiClient.get("/messaging/unread");
      const unreadData = unreadResp.data;
      setConversations(conversationsData);
      setUnreadTotal(unreadData.total || 0);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId: string, cursor?: string) => {
    setMessagesLoading(true);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (cursor) params.cursor = cursor;
      const resp = await apiClient.get(`/messaging/conversations/${convId}/messages`, { params });
      const { items, next_cursor, has_more } = resp.data;
      if (cursor) {
        setMessages((prev) => [...items, ...prev]);
      } else {
        setMessages(items);
      }
      setNextCursor(next_cursor);
      setHasMoreMessages(has_more);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadMoreMessages = useCallback(() => {
    if (activeConvId && nextCursor && !messagesLoading) {
      fetchMessages(activeConvId, nextCursor);
    }
  }, [activeConvId, nextCursor, messagesLoading, fetchMessages]);

  // Switch active conversation
  const handleSetActiveConvId = useCallback((id: string | null) => {
    setActiveConvId(id);
    if (id) {
      fetchMessages(id);
    } else {
      setMessages([]);
    }
  }, [fetchMessages]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType: string = "text", fileUrl?: string) => {
    if (!activeConvId) return;
    if (messageType === "text" && !content.trim()) return;
    try {
      const resp = await apiClient.post(`/messaging/conversations/${activeConvId}/messages`, {
        content: content.trim() || null,
        message_type: messageType,
        file_url: fileUrl || null,
      });
      setMessages((prev) => [...prev, resp.data]);
      refreshConversations();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  }, [activeConvId, refreshConversations]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!activeConvId) return;
    try {
      const resp = await apiClient.patch(`/messaging/conversations/${activeConvId}/messages/${messageId}`, {
        content,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, ...resp.data } : m))
      );
    } catch (err) {
      console.error("Failed to edit message", err);
    }
  }, [activeConvId]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!activeConvId) return;
    try {
      await apiClient.delete(`/messaging/conversations/${activeConvId}/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("Failed to delete message", err);
    }
  }, [activeConvId]);

  // Toggle reaction
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!activeConvId) return;
    try {
      const resp = await apiClient.post(`/messaging/conversations/${activeConvId}/messages/${messageId}/reactions`, {
        emoji,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: resp.data } : m))
      );
    } catch (err) {
      console.error("Failed to toggle reaction", err);
    }
  }, [activeConvId]);

  // Toggle mute
  const toggleMute = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const resp = await apiClient.post(`/messaging/conversations/${conversationId}/mute`);
      const isMuted = resp.data.is_muted;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            members: c.members.map((m) =>
              m.user.id === user?.id ? { ...m, is_muted: isMuted } : m
            ),
          };
        })
      );
      return isMuted;
    } catch (err) {
      console.error("Failed to toggle mute", err);
      return false;
    }
  }, [user]);

  // Search messages
  const searchMessages = useCallback(async (conversationId: string, query: string): Promise<MessageData[]> => {
    try {
      const resp = await apiClient.get(`/messaging/conversations/${conversationId}/messages/search`, {
        params: { q: query },
      });
      return resp.data;
    } catch (err) {
      console.error("Failed to search messages", err);
      return [];
    }
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((convId: string, isTyping: boolean) => {
    const ws = wsRef.current;
    if (ws?.connected) {
      ws.send("typing", { conversation_id: convId, is_typing: isTyping });
    }
  }, []);

  // Mark read
  const markRead = useCallback(async (convId: string) => {
    try {
      await apiClient.post(`/messaging/conversations/${convId}/read`);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      setUnreadTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  }, []);

  // Create DM
  const createDM = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const resp = await apiClient.post("/messaging/conversations", {
        type: "direct",
        member_ids: [userId],
      });
      await refreshConversations();
      return resp.data.id;
    } catch (err) {
      console.error("Failed to create DM", err);
      return null;
    }
  }, [refreshConversations]);

  // Initial load
  useEffect(() => {
    if (user) {
      refreshConversations();
    }
  }, [user, refreshConversations]);

  // WebSocket connection — stable, does not reconnect on conversation switch
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("cc_access_token");
    if (!token) return;

    const ws = getWSClient(token);
    wsRef.current = ws;
    ws.connect();

    const unsubNewMessage = ws.on("new_message", (data: MessageData) => {
      if (data.conversation_id === activeConvIdRef.current) {
        setMessages((prev) => [...prev, data]);
        markRead(data.conversation_id);
      }
      refreshConversations();
    });

    const unsubTyping = ws.on("typing", (data: { conversation_id: string; user_id: string; is_typing: boolean }) => {
      if (data.conversation_id === activeConvIdRef.current) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (data.is_typing) {
            next.add(data.user_id);
          } else {
            next.delete(data.user_id);
          }
          return next;
        });
      }
    });

    return () => {
      unsubNewMessage();
      unsubTyping();
      releaseWSClient();
    };
  }, [user, refreshConversations, markRead]);

  // Clear typing indicator after timeout
  useEffect(() => {
    if (typingUsers.size === 0) return;
    const timer = setTimeout(() => setTypingUsers(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [typingUsers]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        unreadTotal,
        activeConvId,
        setActiveConvId: handleSetActiveConvId,
        messages,
        messagesLoading,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        toggleMute,
        searchMessages,
        loadMoreMessages,
        hasMoreMessages,
        markRead,
        createDM,
        refreshConversations,
        typingUsers,
        sendTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
