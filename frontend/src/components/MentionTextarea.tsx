"use client";

import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface MentionUser {
  id: string;
  email: string;
  display_name: string;
}

/**
 * Textarea with @mention autocomplete, mirroring the mobile compose flow
 * (`mobile/app/(tabs)/compose.tsx`). Typing "@" + 2+ chars queries `/search`
 * and shows a dropdown; selecting a user inserts "@handle" into the text and
 * reports the selected user IDs via `onMentionsChange` (the backend's
 * `mentioned_users` expects user IDs).
 */
interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (userIds: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

function handleOf(u: MentionUser): string {
  // Search results carry no username; fall back to the email local part,
  // matching the mobile mention handle fallback.
  return (u.email.split("@")[0] || "user").replace(/[^\w.]/g, "");
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(function MentionTextarea(
  { value, onChange, onMentionsChange, placeholder, rows = 2, className, maxLength, autoFocus },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || innerRef;

  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<number | null>(null);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportMentions = useCallback(
    (ids: string[]) => {
      setMentionIds(ids);
      onMentionsChange?.(ids);
    },
    [onMentionsChange],
  );

  // Query /search when an active @token of length >= 2 exists.
  useEffect(() => {
    if (anchor === null || query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await apiClient.get("/search", { params: { q: query } });
        setResults((resp.data?.users ?? []).slice(0, 5));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, anchor]);

  const detectMention = (text: string, caret: number) => {
    // Walk back from the caret to the nearest "@" not preceded by a word char.
    const upto = text.slice(0, caret);
    const match = upto.match(/(?:^|\s)@([\w.]*)$/);
    if (match) {
      setAnchor(caret - match[1].length - 1);
      setQuery(match[1]);
    } else {
      setAnchor(null);
      setQuery("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);
    detectMention(text, e.target.selectionStart ?? text.length);
  };

  const selectUser = (u: MentionUser) => {
    if (anchor === null) return;
    const handle = handleOf(u);
    const before = value.slice(0, anchor);
    const after = value.slice(anchor + query.length + 1);
    const next = `${before}@${handle} ${after}`;
    onChange(next);
    if (!mentionIds.includes(u.id)) reportMentions([...mentionIds, u.id]);
    setAnchor(null);
    setQuery("");
    setResults([]);
    // Restore focus + caret after the inserted mention.
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = before.length + handle.length + 2;
        el.focus();
        el.selectionStart = el.selectionEnd = pos;
      }
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={cn(
          "w-full resize-none bg-transparent text-body text-text-primary outline-none placeholder:text-text-secondary",
          className,
        )}
      />
      {anchor !== null && query.length >= 2 && (loading || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-3 text-caption text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectUser(u);
                }}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface"
              >
                <Avatar user={{ id: u.id, display_name: u.display_name, email: u.email }} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-text-primary">
                    {u.display_name || u.email.split("@")[0]}
                  </span>
                  <span className="block truncate text-caption text-text-secondary">@{handleOf(u)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
