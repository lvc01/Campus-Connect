"use client";

import { useEffect, useState, useRef } from "react";
import { Image, X, Loader2, BarChart3, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useAuth } from "@/context/auth-context";
import { Avatar } from "@/components/Avatar";
import { COMPOSE_OPEN_EVENT } from "@/lib/compose-events";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const MAX = 500;
const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;

export function ComposeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Poll state
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(COMPOSE_OPEN_EVENT, handler);
    return () => window.removeEventListener(COMPOSE_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  if (!user || !open) return null;

  const remaining = MAX - text.length;
  const over = remaining < 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/posts/upload", formData);
      setMediaUrl(res.data.url);
    } catch (err: unknown) {
      const detail =
        typeof err === "object" && err && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setUploadError(detail || "Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.slice(0, start) + emoji.native + text.slice(end);
      setText(newText);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
        textarea.focus();
      }, 0);
    } else {
      setText((t) => t + emoji.native);
    }
    setShowEmojiPicker(false);
  };

  const togglePollMode = () => {
    if (pollMode) {
      setPollMode(false);
      setPollOptions(["", ""]);
    } else {
      setPollMode(true);
      setMediaUrl("");
    }
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addPollOption = () => {
    if (pollOptions.length < MAX_POLL_OPTIONS) {
      setPollOptions((prev) => [...prev, ""]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > MIN_POLL_OPTIONS) {
      setPollOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const submit = async () => {
    if ((!text.trim() && !mediaUrl && !(pollMode && pollOptions.some((o) => o.trim()))) || over || posting) return;
    setPosting(true);
    try {
      const payload: {
        content: string;
        visibility: string;
        media_urls?: string[];
        post_type?: string;
        poll_options?: { text: string; position: number }[];
      } = {
        content: text.trim(),
        visibility: "public",
      };

      if (pollMode && pollOptions.some((o) => o.trim())) {
        payload.post_type = "poll";
        payload.poll_options = pollOptions
          .filter((o) => o.trim())
          .map((text, i) => ({ text: text.trim(), position: i }));
      }

      if (mediaUrl) payload.media_urls = [mediaUrl];
      await apiClient.post("/posts", payload);
      toast.success("Your post is live!");
      setText("");
      setMediaUrl("");
      setPollMode(false);
      setPollOptions(["", ""]);
      setOpen(false);
    } catch {
      toast.error("Failed to create post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20">
      <div
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-3">
          <Avatar user={user} size={40} />
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={pollMode ? "Ask a question..." : "What is happening on campus?"}
              rows={4}
              className="w-full resize-none bg-transparent text-body text-text-primary outline-none placeholder:text-text-secondary"
            />

            {/* Media preview */}
            {mediaUrl && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border relative max-h-[200px]">
                <img src={mediaUrl} alt="" className="w-full max-h-[200px] object-cover" />
                <button
                  type="button"
                  onClick={() => setMediaUrl("")}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                  aria-label="Remove media"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Poll options */}
            {pollMode && (
              <div className="mt-3 space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      <span className="text-caption text-text-secondary shrink-0">{i + 1}.</span>
                      <input
                        value={opt}
                        onChange={(e) => updatePollOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                        maxLength={200}
                      />
                    </div>
                    {pollOptions.length > MIN_POLL_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => removePollOption(i)}
                        className="text-text-secondary hover:text-like transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <button
                    type="button"
                    onClick={addPollOption}
                    className="text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                  >
                    + Add option
                  </button>
                )}
              </div>
            )}

            {uploadError && (
              <p className="mt-2 text-xs text-like font-semibold">{uploadError}</p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-1 text-accent relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || pollMode}
                  className="rounded-md p-2 hover:bg-surface disabled:opacity-30"
                  aria-label="Add media"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Image className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={togglePollMode}
                  className={cn(
                    "rounded-md p-2 hover:bg-surface transition-colors",
                    pollMode && "bg-accent/15 text-accent"
                  )}
                  aria-label="Create poll"
                >
                  <BarChart3 className="h-5 w-5" />
                </button>
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={cn(
                      "rounded-md p-2 hover:bg-surface transition-colors",
                      showEmojiPicker && "bg-accent/15 text-accent"
                    )}
                    aria-label="Add emoji"
                  >
                    <SmilePlus className="h-5 w-5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 z-50 mt-1">
                      <Picker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="dark"
                        previewPosition="none"
                        skinTonePosition="none"
                        maxFrequentRows={2}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-caption",
                    over ? "text-error" : "text-text-secondary",
                  )}
                >
                  {remaining}
                </span>
                <button
                  onClick={submit}
                  disabled={(!text.trim() && !mediaUrl && !(pollMode && pollOptions.some((o) => o.trim()))) || over || posting}
                  className="rounded-full bg-accent px-4 py-1.5 text-body-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {posting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
