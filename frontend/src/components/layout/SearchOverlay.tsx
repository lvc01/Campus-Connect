"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, User as UserIcon, Users, Calendar, ShoppingBag, MessageSquare } from "lucide-react";
import { SEARCH_OPEN_EVENT } from "@/lib/compose-events";
import { apiClient } from "@/lib/api-client";

interface SearchUser {
  id: string;
  email: string;
  profile?: { display_name?: string | null } | null;
}

interface SearchPost {
  id: string;
  content: string;
  author?: { display_name?: string | null } | null;
}

interface SearchClub {
  id: string;
  name: string;
}

interface SearchEvent {
  id: string;
  title: string;
}

interface SearchListing {
  id: string;
  title: string;
  price: number;
}

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
  clubs: SearchClub[];
  events: SearchEvent[];
  listings: SearchListing[];
}

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setQ("");
    };
    window.addEventListener(SEARCH_OPEN_EVENT, handler);
    return () => window.removeEventListener(SEARCH_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const term = q.trim();

  useEffect(() => {
    if (!term || term.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        setResults(res.data);
      } catch {
        // cancelled or error
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const hasResults =
    results &&
    (results.users.length ||
      results.posts.length ||
      results.clubs.length ||
      results.events.length ||
      results.listings.length);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
            <Search className="h-4 w-4 text-text-secondary" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users, posts, clubs, events, marketplace"
              className="flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-secondary"
            />
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-text-primary"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!term && (
            <p className="py-12 text-center text-body-sm text-text-secondary">
              Start typing to search across campus.
            </p>
          )}
          {term && !hasResults && !loading && (
            <p className="py-12 text-center text-body-sm text-text-secondary">
              No results for &ldquo;{q}&rdquo;.
            </p>
          )}
          {loading && (
            <p className="py-12 text-center text-body-sm text-text-secondary">
              Searching...
            </p>
          )}
          {results && hasResults ? (
            <div className="flex flex-col gap-6">
              {results.users.length > 0 && (
                <Section icon={UserIcon} title="People">
                  {results.users.map((u) => (
                    <Link
                      key={u.id}
                      href={`/profile/${u.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-surface"
                    >
                      <span className="text-body-sm font-semibold text-text-primary">
                        {u.profile?.display_name || u.email}
                      </span>{" "}
                      <span className="text-caption text-text-secondary">
                        @{u.email.split("@")[0]}
                      </span>
                    </Link>
                  ))}
                </Section>
              )}
              {results.posts.length > 0 && (
                <Section icon={MessageSquare} title="Posts">
                  {results.posts.map((p) => (
                    <Link
                      key={p.id}
                      href="/"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-surface"
                    >
                      <span className="text-caption text-text-secondary">
                        {p.author?.display_name || "User"}
                      </span>
                      <p className="line-clamp-1 text-body-sm text-text-primary">
                        {p.content}
                      </p>
                    </Link>
                  ))}
                </Section>
              )}
              {results.clubs.length > 0 && (
                <Section icon={Users} title="Clubs">
                  {results.clubs.map((c) => (
                    <Link
                      key={c.id}
                      href="/clubs"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-body-sm text-text-primary hover:bg-surface"
                    >
                      {c.name}
                    </Link>
                  ))}
                </Section>
              )}
              {results.events.length > 0 && (
                <Section icon={Calendar} title="Events">
                  {results.events.map((e) => (
                    <Link
                      key={e.id}
                      href="/events"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-body-sm text-text-primary hover:bg-surface"
                    >
                      {e.title}
                    </Link>
                  ))}
                </Section>
              )}
              {results.listings.length > 0 && (
                <Section icon={ShoppingBag} title="Marketplace">
                  {results.listings.map((l) => (
                    <Link
                      key={l.id}
                      href="/marketplace"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-body-sm text-text-primary hover:bg-surface"
                    >
                      {l.title} · ${l.price}
                    </Link>
                  ))}
                </Section>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 px-3 text-overline uppercase tracking-wide text-text-secondary">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}
