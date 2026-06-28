"use client";

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Pencil, Search, UserPlus, X, Paperclip, Smile, MoreVertical,
  PencilIcon, Trash2, VolumeX, Volume2, Download, FileText, Image as ImageIcon,
  ArrowLeft, MessageSquareOff, Reply, Flag,
} from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { Avatar } from "@/components/Avatar";
import { ReportModal } from "@/components/report-modal";
import { useAuth } from "@/context/auth-context";
import { useChat, Conversation, MessageData } from "@/context/chat-context";
import { apiClient } from "@/lib/api-client";
import { cn, getRelativeTimeShort } from "@/lib/utils";
import data from "@emoji-mart/data";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

function getOtherName(conv: Conversation, currentUserId: string): string {
  if (conv.name) return conv.name;
  const other = conv.members?.find((m) => m.user.id !== currentUserId);
  return other?.user?.profile?.display_name || other?.user?.email?.split("@")[0] || "Unknown";
}

function MessageBubble({
  msg,
  isMine,
  user,
  onEdit,
  onDelete,
  onReact,
  onOpenEmojiPicker,
  onReply,
  onReport,
  seen,
}: {
  msg: MessageData;
  isMine: boolean;
  user: any;
  onEdit: (msg: MessageData) => void;
  onDelete: (msgId: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onOpenEmojiPicker: (msgId: string, anchor: HTMLElement) => void;
  onReply: (msg: MessageData) => void;
  onReport: (msgId: string) => void;
  seen?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isImage = msg.message_type === "image" && msg.file_url;
  const isFile = msg.message_type === "file" && msg.file_url;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactions(false);
      }
    };
    if (showMenu || showReactions) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showReactions]);

  const groupedReactions = useMemo(() => {
    if (!msg.reactions?.length) return [];
    const map = new Map<string, { emoji: string; count: number; hasOwn: boolean }>();
    for (const r of msg.reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user.id) existing.hasOwn = true;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          hasOwn: r.user_id === user.id,
        });
      }
    }
    return Array.from(map.values());
  }, [msg.reactions, user.id]);

  return (
    <div className={cn("flex mb-1 group", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%]", !isMine && "flex items-end gap-2")}>
        {!isMine && <Avatar user={msg.sender} size={24} />}
        <div className="relative">
          <div
            className={cn(
              "px-3 py-2 text-body-sm leading-relaxed rounded-2xl",
              isMine
                ? "bg-accent text-accent-foreground"
                : "bg-surface text-text-primary border border-border",
            )}
          >
            {msg.reply_to && (
              <div
                className={cn(
                  "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px]",
                  isMine ? "border-white/50 bg-black/10" : "border-accent bg-accent/5",
                )}
              >
                <span className="block font-semibold opacity-80">
                  {msg.reply_to.sender?.profile?.display_name || msg.reply_to.sender?.email?.split("@")[0] || "Reply"}
                </span>
                <span className="block truncate opacity-70">
                  {msg.reply_to.message_type !== "text" ? "Attachment" : msg.reply_to.content}
                </span>
              </div>
            )}
            {isImage && (
              <img src={msg.file_url!} alt="" className="rounded-lg max-w-[280px] max-h-[200px] object-cover mb-1" />
            )}
            {isFile && (
              <a
                href={msg.file_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 underline decoration-1 underline-offset-2 opacity-90 hover:opacity-100"
              >
                <FileText className="h-4 w-4 shrink-0" />
                {msg.content || "Attachment"}
              </a>
            )}
            {!isImage && !isFile && msg.content}
            {msg.edited_at && (
              <span className="text-[10px] opacity-60 ml-1">(edited)</span>
            )}
          </div>

          {/* Reactions */}
          {groupedReactions.length > 0 && (
            <div className={cn("flex flex-wrap gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
              {groupedReactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => onReact(msg.id, r.emoji)}
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors",
                    r.hasOwn
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-surface border-border text-text-secondary hover:border-accent/30"
                  )}
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 && <span className="font-medium">{r.count}</span>}
                </button>
              ))}
              <button
                onClick={() => onOpenEmojiPicker(msg.id, menuRef.current!)}
                className="flex items-center justify-center w-6 h-6 rounded-full border border-border text-text-secondary hover:border-accent/30 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
              >
                <Smile className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Timestamp + read receipt */}
          <p className={cn("text-[10px] text-text-secondary mt-0.5 font-medium", isMine ? "text-right" : "text-left")}>
            {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            {isMine && seen && <span className="ml-1.5 text-accent">· Seen</span>}
          </p>

          {/* Hover menu */}
          <div ref={menuRef} className={cn(
            "absolute z-50",
            isMine ? "right-0" : "left-0",
            "top-0 -translate-y-full",
            "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto"
          )}>
            <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg shadow-lg p-0.5 mb-1">
              <button
                onClick={() => onOpenEmojiPicker(msg.id, menuRef.current!)}
                className="p-1.5 rounded-md hover:bg-surface transition-colors text-text-secondary"
                title="React"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReply(msg)}
                className="p-1.5 rounded-md hover:bg-surface transition-colors text-text-secondary"
                title="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {isMine ? (
                <>
                  <button
                    onClick={() => { onEdit(msg); setShowMenu(false); }}
                    className="p-1.5 rounded-md hover:bg-surface transition-colors text-text-secondary"
                    title="Edit"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { onDelete(msg.id); setShowMenu(false); }}
                    className="p-1.5 rounded-md hover:bg-surface transition-colors text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onReport(msg.id)}
                  className="p-1.5 rounded-md hover:bg-surface transition-colors text-text-secondary"
                  title="Report"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    conversations,
    activeConvId,
    setActiveConvId,
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
  } = useChat();

  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [editingMsg, setEditingMsg] = useState<MessageData | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
  const [reportMsgId, setReportMsgId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState<MessageData[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [reactingToMsgId, setReactingToMsgId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Deep-link from a profile's "Message" button: /messages?to=<userId>.
  // Create/open the DM, then strip the param so it doesn't re-fire.
  const handledToRef = useRef(false);
  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || handledToRef.current) return;
    handledToRef.current = true;
    createDM(to).then((convId) => {
      if (convId) setMobileShowChat(true);
      router.replace("/messages");
    });
  }, [searchParams, createDM, router]);

  // Id of my most recent message — used to anchor the "Seen" receipt.
  const lastOwnMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender.id === user?.id) return messages[i].id;
    }
    return null;
  }, [messages, user?.id]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const active = conversations.find((c) => c.id === activeConvId);
  const partner = active?.members.find((m) => m.user.id !== user.id)?.user;
  const isMuted = active?.members.find((m) => m.user.id === user.id)?.is_muted ?? false;
  const partnerLastRead = active?.members.find((m) => m.user.id !== user.id)?.last_read_at ?? null;

  const filtered = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        const name = getOtherName(c, user.id).toLowerCase();
        const lastMsg = (c.last_message || "").toLowerCase();
        return name.includes(q) || lastMsg.includes(q);
      })
    : conversations;

  // Mark read when switching conversations
  useEffect(() => {
    if (activeConvId && active && active.unread_count > 0) {
      markRead(activeConvId);
    }
  }, [activeConvId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSearchUsers = async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    try {
      const res = await apiClient.get(`/search`, { params: { q } });
      setUserResults((res.data?.users || []).filter((u: any) => u.id !== user.id));
    } catch { setUserResults([]); } finally { setSearching(false); }
  };

  const handleStartDM = async (userId: string) => {
    const convId = await createDM(userId);
    if (convId) { setActiveConvId(convId); setShowNewConv(false); setUserSearch(""); setUserResults([]); }
  };

  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(activeConvId, true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(activeConvId, false);
    }, 3000);
  }, [activeConvId, sendTyping]);

  const handleSend = () => {
    if (!messageInput.trim()) return;
    if (editingMsg) {
      editMessage(editingMsg.id, messageInput.trim());
      setEditingMsg(null);
    } else {
      sendMessage(messageInput.trim(), "text", undefined, replyingTo?.id);
      setReplyingTo(null);
    }
    setMessageInput("");
    if (isTypingRef.current && activeConvId) {
      isTypingRef.current = false;
      sendTyping(activeConvId, false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await apiClient.post("/posts/upload", formData);
      const { url, type } = resp.data;
      const msgType = type === "video" ? "image" : (file.size > 0 && file.type.startsWith("image/") ? "image" : "file");
      sendMessage(file.name, msgType, url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearchMessages = async () => {
    if (!activeConvId || !msgSearchQuery.trim()) return;
    setSearchingMessages(true);
    try {
      const results = await searchMessages(activeConvId, msgSearchQuery.trim());
      setMsgSearchResults(results);
    } finally { setSearchingMessages(false); }
  };

  const handleReact = (msgId: string, emoji: string) => {
    toggleReaction(msgId, emoji);
  };

  const handleOpenEmojiPicker = (msgId: string, _anchor: HTMLElement) => {
    setReactingToMsgId(msgId);
    setShowEmojiPicker(true);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
        setReactingToMsgId(null);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  return (
    <LayoutShell hideRightRail>
      <div className="flex h-[calc(100vh-105px)] lg:h-[calc(100vh-52px)]">
        {/* Sidebar */}
        <div className={cn("w-full shrink-0 border-r border-border flex flex-col sm:w-[320px]", mobileShowChat ? "hidden sm:flex" : "flex")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-h3 font-bold">Messages</h2>
            <button onClick={() => setShowNewConv(true)} className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-accent" aria-label="New conversation">
              <Pencil className="h-5 w-5" />
            </button>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input type="search" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-text-primary text-body-sm placeholder:text-text-secondary outline-none focus:border-accent transition-colors" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3"><Search className="h-6 w-6 text-text-secondary" /></div>
                <p className="text-body-sm font-semibold text-text-primary">{search ? "No matches" : "No conversations yet"}</p>
                <p className="text-caption text-text-secondary mt-1">{search ? "Try a different search" : "Start one from a user profile"}</p>
              </div>
            ) : filtered.map((conv) => {
              const otherUser = conv.members?.find((m) => m.user.id !== user.id)?.user;
              const name = getOtherName(conv, user.id);
              const rawLast = conv.last_message?.split(": ").slice(1).join(": ") || conv.last_message || "No messages yet";
              const lastMsg = conv.last_sender_id === user.id && conv.last_message ? `You: ${rawLast}` : rawLast;
              const hasUnread = conv.unread_count > 0;
              const muted = conv.members?.find((m) => m.user.id === user.id)?.is_muted ?? false;
              return (
                <button key={conv.id} onClick={() => { setActiveConvId(conv.id); setMobileShowChat(true); }}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/50",
                    conv.id === activeConvId ? "bg-surface border-l-2 border-l-accent" : "hover:bg-surface/50 border-l-2 border-l-transparent",
                  )}>
                  <Avatar user={otherUser || { id: "", email: "" }} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-body-sm truncate", hasUnread ? "font-bold" : "font-semibold")}>{name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {muted && <VolumeX className="h-3 w-3 text-text-secondary" />}
                        {conv.last_message_at && <span className="text-[11px] text-text-secondary">{getRelativeTimeShort(conv.last_message_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-caption truncate flex-1", hasUnread ? "text-text-primary font-medium" : "text-text-secondary")}>{lastMsg}</span>
                      {hasUnread && <span className="min-w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center px-1.5">{conv.unread_count}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className={cn("flex-1 flex-col min-w-0", mobileShowChat ? "flex" : "hidden sm:flex")}>
          {active && partner ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
                <button onClick={() => setMobileShowChat(false)} className="p-2 -ml-2 rounded-lg hover:bg-surface transition-colors text-text-secondary lg:hidden">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar user={partner} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-bold text-text-primary truncate">{partner.profile?.display_name || partner.email}</p>
                  <p className="text-[11px] text-text-secondary">
                    {typingUsers.size > 0 ? (
                      <span className="text-accent font-medium">typing...</span>
                    ) : (
                      <span>{active.members.length} members</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowMsgSearch(!showMsgSearch)} className={cn("p-2 rounded-lg transition-colors", showMsgSearch ? "bg-surface text-accent" : "hover:bg-surface text-text-secondary")} title="Search messages">
                    <Search className="h-4 w-4" />
                  </button>
                  <button onClick={() => activeConvId && toggleMute(activeConvId)} className={cn("p-2 rounded-lg transition-colors", isMuted ? "text-accent" : "hover:bg-surface text-text-secondary")} title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className="flex items-center gap-2 border-b border-border px-4 py-2 shrink-0 bg-surface/50">
                  <Search className="h-4 w-4 text-text-secondary shrink-0" />
                  <input autoFocus value={msgSearchQuery} onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchMessages()}
                    placeholder="Search in conversation..."
                    className="flex-1 h-8 px-2 rounded-md bg-background border border-border text-body-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-accent" />
                  {msgSearchQuery && (
                    <button onClick={() => { setMsgSearchQuery(""); setMsgSearchResults([]); }} className="p-1 rounded hover:bg-surface">
                      <X className="h-3.5 w-3.5 text-text-secondary" />
                    </button>
                  )}
                  <button onClick={handleSearchMessages} disabled={searchingMessages}
                    className="h-8 px-3 rounded-md bg-accent text-accent-foreground text-caption font-medium disabled:opacity-40">
                    {searchingMessages ? "..." : "Search"}
                  </button>
                </div>
              )}

              {/* Search results */}
              {showMsgSearch && msgSearchResults.length > 0 && (
                <div className="border-b border-border px-4 py-2 max-h-40 overflow-y-auto shrink-0 bg-surface/30">
                  <p className="text-caption text-text-secondary mb-1">{msgSearchResults.length} result{msgSearchResults.length !== 1 ? "s" : ""}</p>
                  {msgSearchResults.map((r) => (
                    <button key={r.id} onClick={() => { setShowMsgSearch(false); setMsgSearchResults([]); setMsgSearchQuery(""); }}
                      className="w-full text-left p-2 rounded-md hover:bg-surface text-caption text-text-primary truncate">
                      <span className="font-medium">{r.sender.profile?.display_name || r.sender.email?.split("@")[0]}:</span> {r.content}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messagesLoading && messages.length === 0 && (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3"><span className="text-xl">💬</span></div>
                    <p className="text-body-sm font-semibold text-text-primary">No messages yet</p>
                    <p className="text-caption text-text-secondary mt-1">Send a message to start the conversation!</p>
                  </div>
                )}
                {hasMoreMessages && (
                  <div ref={(el) => {
                    if (el) {
                      const observer = new IntersectionObserver(([entry]) => {
                        if (entry.isIntersecting && hasMoreMessages && !messagesLoading) loadMoreMessages();
                      }, { threshold: 0.1 });
                      observer.observe(el);
                    }
                  }} className="h-1" />
                )}
                {(() => {
                  const groups: { date: string; msgs: MessageData[] }[] = [];
                  let currentDate = "";
                  for (const msg of messages) {
                    const d = new Date(msg.created_at);
                    const today = new Date();
                    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
                    let dateStr = "";
                    if (d.toDateString() === today.toDateString()) dateStr = "Today";
                    else if (d.toDateString() === yesterday.toDateString()) dateStr = "Yesterday";
                    else dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    if (dateStr !== currentDate) { currentDate = dateStr; groups.push({ date: dateStr, msgs: [] }); }
                    groups[groups.length - 1].msgs.push(msg);
                  }
                  return groups.map((group) => (
                    <div key={group.date}>
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] font-semibold text-text-secondary bg-surface px-3 py-1 rounded-full border border-border">{group.date}</span>
                      </div>
                      {group.msgs.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isMine={msg.sender.id === user.id}
                          user={user}
                          onEdit={(m) => { setEditingMsg(m); setMessageInput(m.content || ""); }}
                          onDelete={deleteMessage}
                          onReact={handleReact}
                          onOpenEmojiPicker={handleOpenEmojiPicker}
                          onReply={(m) => { setReplyingTo(m); setEditingMsg(null); }}
                          onReport={(id) => setReportMsgId(id)}
                          seen={
                            msg.id === lastOwnMsgId &&
                            !!partnerLastRead &&
                            new Date(partnerLastRead) >= new Date(msg.created_at)
                          }
                        />
                      ))}
                    </div>
                  ));
                })()}
                {typingUsers.size > 0 && (() => {
                  const otherMember = active.members?.find((m) => typingUsers.has(m.user.id));
                  if (!otherMember) return null;
                  return (
                    <div className="flex items-center gap-2 text-caption text-text-secondary italic mt-2">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      {otherMember.user.profile?.display_name || "They"} is typing...
                    </div>
                  );
                })()}
                <div ref={messagesEndRef} className="h-1" />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 shrink-0">
                {editingMsg && (
                  <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-surface rounded-lg border border-border">
                    <span className="text-caption text-text-secondary truncate">Editing: {editingMsg.content}</span>
                    <button onClick={() => { setEditingMsg(null); setMessageInput(""); }} className="p-1 rounded hover:bg-background">
                      <X className="h-3.5 w-3.5 text-text-secondary" />
                    </button>
                  </div>
                )}
                {replyingTo && !editingMsg && (
                  <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-surface rounded-lg border-l-2 border-accent">
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-accent">
                        Replying to {replyingTo.sender?.profile?.display_name || replyingTo.sender?.email?.split("@")[0]}
                      </span>
                      <span className="block text-caption text-text-secondary truncate">
                        {replyingTo.message_type !== "text" ? "Attachment" : replyingTo.content}
                      </span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 rounded hover:bg-background shrink-0">
                      <X className="h-3.5 w-3.5 text-text-secondary" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="p-2.5 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-accent disabled:opacity-40 shrink-0">
                    {uploading ? <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <Paperclip className="h-5 w-5" />}
                  </button>
                  <textarea
                    value={messageInput}
                    onChange={(e) => { setMessageInput(e.target.value); handleTyping(); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={editingMsg ? "Edit message..." : "Type a message..."}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] px-4 py-2.5 rounded-xl bg-surface border border-border text-body-sm text-text-primary placeholder:text-text-secondary resize-none outline-none focus:border-accent transition-colors"
                  />
                  <button onClick={handleSend} disabled={!messageInput.trim() && !editingMsg}
                    className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-all hover:opacity-90 active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl bg-surface flex items-center justify-center mx-auto mb-4"><span className="text-2xl">💬</span></div>
                <h3 className="text-h3 font-bold text-text-primary">Select a conversation</h3>
                <p className="text-body-sm text-text-secondary mt-1">Choose from the sidebar or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 bg-background rounded-xl border border-border shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-h3 font-bold">New conversation</h3>
              <button onClick={() => { setShowNewConv(false); setUserSearch(""); setUserResults([]); }} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
                <X className="h-5 w-5 text-text-secondary" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input autoFocus value={userSearch} onChange={(e) => handleSearchUsers(e.target.value)} placeholder="Search by name or email..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface border border-border text-body-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-accent transition-colors" />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {searching && <div className="flex justify-center py-4"><div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}
                {!searching && userResults.length === 0 && userSearch.length >= 2 && <p className="text-center text-caption text-text-secondary py-4">No users found</p>}
                {userResults.map((u: any) => (
                  <button key={u.id} onClick={() => handleStartDM(u.id)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface transition-colors text-left">
                    <Avatar user={u} size={36} />
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-text-primary truncate">{u.profile?.display_name || u.email.split("@")[0]}</p>
                      <p className="text-caption text-text-secondary truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
                {userSearch.length < 2 && !searching && (
                  <div className="text-center py-6">
                    <UserPlus className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                    <p className="text-caption text-text-secondary">Type at least 2 characters to search</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emoji Picker (reactions) */}
      {showEmojiPicker && reactingToMsgId && (
        <div ref={emojiPickerRef} className="fixed z-[9999] bg-background border border-border rounded-xl shadow-lg p-2"
          style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <div className="grid grid-cols-4 gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => { handleReact(reactingToMsgId, emoji); setShowEmojiPicker(false); setReactingToMsgId(null); }}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface text-xl transition-colors">
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {reportMsgId && (
        <ReportModal
          targetType="message"
          targetId={reportMsgId}
          onClose={() => setReportMsgId(null)}
        />
      )}
    </LayoutShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageInner />
    </Suspense>
  );
}
