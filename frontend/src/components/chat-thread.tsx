"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, MessageCircle, Send, Image as ImageIcon, X } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useChat, Conversation, MessageData } from "@/context/chat-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface ChatThreadProps {
  conversation: Conversation;
  currentUserId: string;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ conversation, currentUserId }) => {
  const { messages, messagesLoading, sendMessage, loadMoreMessages, hasMoreMessages, typingUsers, readReceipts } = useChat();
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherMember = useMemo(() => {
    return conversation.members?.find((m) => m.user.id !== currentUserId);
  }, [conversation, currentUserId]);

  const otherName = otherMember?.user?.profile?.display_name || otherMember?.user?.email?.split("@")[0] || "Unknown";
  const otherId = otherMember?.user?.id || "";
  const isTyping = typingUsers.has(otherId);
  const isDM = conversation.type === "direct";

  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!otherId || !isDM) return;
    let cancelled = false;
    const check = async () => {
      try {
        const resp = await apiClient.get(`/messaging/presence/${otherId}`);
        if (!cancelled) setIsOnline(resp.data.is_online);
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [otherId, isDM]);

  // Check if a message has been read by any other member
  function isMessageSeen(msg: MessageData): boolean {
    if (msg.sender.id !== currentUserId) return false;
    const convReads = readReceipts[conversation.id];
    if (!convReads) return false;
    for (const [memberId, lastReadAt] of Object.entries(convReads)) {
      if (memberId === currentUserId) continue;
      if (new Date(lastReadAt) >= new Date(msg.created_at)) return true;
    }
    return false;
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreMessages && !messagesLoading) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreMessages, messagesLoading, loadMoreMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !pendingImage) return;
    if (pendingImage) {
      sendMessage(input.trim() || "", "image", pendingImage);
      setPendingImage(null);
    } else {
      sendMessage(input.trim());
    }
    setInput("");
    inputRef.current?.focus();
  };

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post("/api/v1/messaging/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPendingImage(data.url);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const groupedMessages: { date: string; msgs: MessageData[] }[] = useMemo(() => {
    const groups: { date: string; msgs: MessageData[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
      const d = formatDate(msg.created_at);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border-quiet shrink-0">
          <div className="relative w-9 h-9 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-sm">
              <span className="font-display text-body-sm font-medium text-accent-foreground select-none">{getInitials(otherName)}</span>
            </div>
            {isDM && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                  isOnline ? "bg-green-500" : "bg-text-tertiary"
                }`}
              />
            )}
          </div>
          <div>
            <p className="font-display text-body-sm font-medium text-text-primary">{otherName}</p>
            <p className="text-[10px] text-text-secondary font-medium">
              {isDM ? (isOnline ? "Online" : "Offline") : `${conversation.members?.length || 0} members`}
            </p>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={topRef}>
        {messagesLoading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 text-accent animate-spin" />
          </div>
        )}

        {!messagesLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-9 w-9 text-text-tertiary mb-3" strokeWidth={1.5} />
            <p className="text-xs text-text-secondary">No messages yet.</p>
            <p className="text-[10px] text-text-tertiary mt-1">Send a message to start chatting!</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] font-semibold text-text-secondary bg-surface px-3 py-1 rounded-full border border-border-quiet">
                {group.date}
              </span>
            </div>
            {group.msgs.map((msg) => {
              const isMine = msg.sender.id === currentUserId;
              const senderName = msg.sender?.profile?.display_name || msg.sender?.email?.split("@")[0] || "Unknown";
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                  <div className={`max-w-[75%] ${isMine ? "" : "flex items-end gap-2"}`}>
                    {!isMine && (
                      <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center shrink-0 mb-1">
                        <span className="text-[8px] font-bold text-accent-foreground select-none">{getInitials(senderName)}</span>
                      </div>
                    )}
                    <div>
                      <div
                        className={`px-3 py-2 text-sm leading-relaxed rounded-2xl ${
                          isMine
                            ? "bg-accent/25 text-text-primary border border-accent/20"
                            : "bg-surface text-text-primary border border-border-quiet"
                        }`}
                      >
                        {msg.message_type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.file_url!} alt="" className="rounded-lg max-w-full" />
                        ) : msg.message_type === "file" ? (
                          <a href={msg.file_url!} target="_blank" rel="noopener noreferrer" className="text-accent underline text-xs">
                            📎 {msg.content || "Attachment"}
                          </a>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <p className={`text-[9px] text-text-tertiary mt-0.5 font-medium ${isMine ? "text-right" : "text-left"}`}>
                        {formatTime(msg.created_at)}
                        {isMine && isMessageSeen(msg) && (
                          <span className="ml-1 text-accent font-semibold">Seen</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-text-secondary italic mt-2">
            <span className="w-2 h-2 rounded-full bg-text-tertiary animate-pulse" />
            {otherName} is typing...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border-quiet shrink-0">
        {pendingImage && (
          <div className="mb-3 relative inline-block">
            <img src={pendingImage} alt="Preview" className="h-20 rounded-lg object-cover border border-border-quiet" />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Upload image"
            className="h-[44px] w-[44px] rounded-xl border border-border-quiet text-text-secondary flex items-center justify-center shrink-0 hover:bg-surface transition-all disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ImageIcon className="h-[18px] w-[18px]" />
            )}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 min-h-[44px] max-h-[120px] px-4 py-3 rounded-xl bg-surface border border-border-quiet text-text-primary text-sm font-medium placeholder:text-text-tertiary resize-none outline-none focus:border-accent/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() && !pendingImage}
            aria-label="Send message"
            className="h-[44px] w-[44px] rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-all hover:scale-105 hover:bg-accent/90"
          >
            <Send className="h-[18px] w-[18px]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>
      </form>
    </div>
  );
};
