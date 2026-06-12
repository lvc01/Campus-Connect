"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useChat, Conversation, MessageData } from "@/context/chat-context";

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
  const { messages, messagesLoading, sendMessage, loadMoreMessages, hasMoreMessages, typingUsers } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const otherMember = useMemo(() => {
    return conversation.members?.find((m) => m.user.id !== currentUserId);
  }, [conversation, currentUserId]);

  const otherName = otherMember?.user?.profile?.display_name || otherMember?.user?.email?.split("@")[0] || "Unknown";
  const otherId = otherMember?.user?.id || "";
  const isTyping = typingUsers.has(otherId);

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
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

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
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-sm">
          <span className="text-sm font-bold text-text-inverse select-none">{getInitials(otherName)}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">{otherName}</p>
          {conversation.members && (
            <p className="text-[10px] text-text-secondary font-medium">{conversation.members.length} members</p>
          )}
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
            <MessageCircle className="h-9 w-9 text-text-muted mb-3" strokeWidth={1.5} />
            <p className="text-xs text-text-secondary">No messages yet.</p>
            <p className="text-[10px] text-text-muted mt-1">Send a message to start chatting!</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] font-semibold text-text-secondary bg-bg-surface px-3 py-1 rounded-full border border-border">
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
                        <span className="text-[8px] font-bold text-text-inverse select-none">{getInitials(senderName)}</span>
                      </div>
                    )}
                    <div>
                      <div
                        className={`px-3 py-2 text-sm leading-relaxed rounded-2xl ${
                          isMine
                            ? "bg-accent/25 text-text-primary border border-accent/20"
                            : "bg-bg-surface text-text-primary border border-border"
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
                      <p className={`text-[9px] text-text-muted mt-0.5 font-medium ${isMine ? "text-right" : "text-left"}`}>
                        {formatTime(msg.created_at)}
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
            <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
            {otherName} is typing...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border shrink-0 flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 min-h-[44px] max-h-[120px] px-4 py-3 rounded-xl bg-bg-surface border border-border text-text-primary text-sm font-medium placeholder:text-text-muted resize-none outline-none focus:border-accent/50 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send message"
          className="h-[44px] w-[44px] rounded-xl bg-accent text-text-inverse flex items-center justify-center shrink-0 disabled:opacity-40 transition-all hover:scale-105 hover:bg-accent/90"
        >
          <Send className="h-[18px] w-[18px]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </button>
      </form>
    </div>
  );
};
