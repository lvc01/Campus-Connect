"use client";

import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { getInitials, getRelativeTimeShort } from "@/lib/utils";
import { useChat, Conversation } from "@/context/chat-context";

function getOtherName(conv: Conversation, currentUserId: string): string {
  if (conv.name) return conv.name;
  const other = conv.members?.find((m) => m.user.id !== currentUserId);
  return other?.user?.profile?.display_name || other?.user?.email?.split("@")[0] || "Unknown";
}

interface ConversationListProps {
  currentUserId: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({ currentUserId }) => {
  const { conversations, activeConvId, setActiveConvId } = useChat();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = getOtherName(c, currentUserId).toLowerCase();
      const lastMsg = (c.last_message || "").toLowerCase();
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, search, currentUserId]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" strokeWidth={2.5} />
          <input
            type="search"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-bg-surface border border-border text-text-primary text-xs font-medium placeholder:text-text-muted outline-none focus:border-accent/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-text-secondary">No conversations yet.</p>
            <p className="text-[10px] text-text-muted mt-1">Start one from a marketplace listing or user profile.</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConvId}
              currentUserId={currentUserId}
              onClick={() => setActiveConvId(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface ConversationRowProps {
  conv: Conversation;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}

const ConversationRow: React.FC<ConversationRowProps> = ({ conv, isActive, currentUserId, onClick }) => {
  const name = getOtherName(conv, currentUserId);
  const lastMsg = conv.last_message?.split(": ").slice(1).join(": ") || conv.last_message || "No messages yet";
  const hasUnread = conv.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 text-left transition-all duration-150 border-b border-border/50 ${
        isActive
          ? "bg-[rgba(var(--bg-hover),0.08)] border-l-2 border-l-accent"
          : "hover:bg-[rgba(var(--bg-hover),0.08)] border-l-2 border-l-transparent"
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-sm font-bold text-text-inverse select-none">{getInitials(name)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-text-primary truncate">{name}</span>
          {conv.last_message_at && (
            <span className="text-[10px] text-text-secondary shrink-0 font-medium">{getRelativeTimeShort(conv.last_message_at)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-secondary truncate flex-1">{lastMsg}</span>
          {hasUnread && (
            <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
};
