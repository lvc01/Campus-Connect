"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, Loader2, MessageCircle, Search, ShoppingBag, Users, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { RoleBadge } from "@/components/RoleBadge";
import { getInitials } from "@/lib/utils";
import Link from "next/link";

interface SearchResults {
  users: Array<{ id: string; email: string; display_name: string; faculty: string | null; year_of_study: number | null; role: string }>;
  posts: Array<{ id: string; content: string | null; author_name: string; author_id: string; created_at: string; like_count: number }>;
  clubs: Array<{ id: string; slug: string; name: string; description: string | null; member_count: number; is_premium: boolean }>;
  events: Array<{ id: string; title: string; start_time: string | null; location: string | null; status: string }>;
  listings: Array<{ id: string; title: string; price: number; category: string }>;
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <span className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase">{label}</span>
      <span className="text-[10px] font-bold text-text-tertiary">({count})</span>
    </div>
  );
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await apiClient.get("/search", { params: { q } });
      setResults(resp.data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const total = results
    ? results.users.length + results.posts.length + results.clubs.length + results.events.length + results.listings.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        ref={overlayRef}
        className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-[18px] w-[18px] text-text-tertiary shrink-0" strokeWidth={2.5} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search users, posts, clubs, events..."
            className="flex-1 bg-transparent text-sm font-medium text-text-primary placeholder-text-muted outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 text-accent mx-auto animate-spin" />
              <p className="text-sm text-text-secondary mt-2">Searching...</p>
            </div>
          ) : query.length >= 2 && total === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-text-secondary">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : query.length < 2 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-text-secondary">Type at least 2 characters to search.</p>
            </div>
          ) : results ? (
            <div className="flex flex-col">
              <SectionHeader label="People" count={results.users.length} />
              {results.users.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-text-inverse">{getInitials(u.display_name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary truncate">
                      {u.display_name}
                      {u.role && <RoleBadge role={u.role} hideStudent size={11} />}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">{u.faculty || "General"}{u.year_of_study ? ` · ${u.year_of_study}st Year` : ""}</p>
                  </div>
                </Link>
              ))}

              <SectionHeader label="Posts" count={results.posts.length} />
              {results.posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/profile/${p.author_id}`}
                  onClick={onClose}
                  className="flex items-start gap-3 px-4 py-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <MessageCircle className="h-[14px] w-[14px] text-text-tertiary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary leading-snug line-clamp-1">{p.content || "(no text)"}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{p.author_name} · {p.like_count} likes</p>
                  </div>
                </Link>
              ))}

              <SectionHeader label="Clubs" count={results.clubs.length} />
              {results.clubs.map((c) => (
                <Link
                  key={c.id}
                  href={`/clubs/${c.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <Users className="h-[14px] w-[14px] text-text-tertiary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">{c.name}</p>
                      {c.is_premium && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">PREMIUM</span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary">{c.member_count} members{c.description ? ` · ${c.description.slice(0, 60)}` : ""}</p>
                  </div>
                </Link>
              ))}

              <SectionHeader label="Events" count={results.events.length} />
              {results.events.map((e) => (
                <Link
                  key={e.id}
                  href="/events"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <Calendar className="h-[14px] w-[14px] text-text-tertiary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{e.title}</p>
                    <p className="text-xs text-text-tertiary">{e.location || "Online"} · {e.status}</p>
                  </div>
                </Link>
              ))}

              <SectionHeader label="Marketplace" count={results.listings.length} />
              {results.listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/marketplace/${l.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-[14px] w-[14px] text-text-tertiary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary truncate">{l.title}</p>
                    <p className="text-xs text-text-tertiary">₹{l.price} · {l.category}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
