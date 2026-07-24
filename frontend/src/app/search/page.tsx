"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Sparkles, Users, FileText, BookOpen, Calendar, ShoppingBag, Loader2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/RoleBadge";
import { BackLink } from "@/components/layout/BackLink";
import { apiClient } from "@/lib/api-client";

interface SearchResult {
  users: Array<{ id: string; email: string; display_name: string; faculty: string | null; role: string }>;
  posts: Array<{ id: string; content: string; author_name: string; author_id: string; created_at: string }>;
  clubs: Array<{ id: string; slug: string; name: string; description: string | null; member_count: number }>;
  events: Array<{ id: string; title: string; start_time: string | null; location: string | null; status: string }>;
  listings: Array<{ id: string; title: string; price: number; category: string }>;
}

type TabKey = "top" | "users" | "posts" | "clubs" | "events" | "listings";

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "top", label: "Top", icon: Sparkles },
  { key: "users", label: "People", icon: Users },
  { key: "posts", label: "Posts", icon: FileText },
  { key: "clubs", label: "Clubs", icon: BookOpen },
  { key: "events", label: "Events", icon: Calendar },
  { key: "listings", label: "Market", icon: ShoppingBag },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);
  const [tab, setTab] = useState<TabKey>("top");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search for the URL query on first load / back-forward navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.length >= 2) doSearch(query);
  }, [query, doSearch]);

  // Real-time debounced search as the user types; keep the URL in sync.
  const handleChange = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
      const trimmed = val.trim();
      router.replace(trimmed.length >= 2 ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    }, 300);
  };

  const counts = results
    ? {
        users: results.users.length,
        posts: results.posts.length,
        clubs: results.clubs.length,
        events: results.events.length,
        listings: results.listings.length,
      }
    : null;
  const total = counts ? counts.users + counts.posts + counts.clubs + counts.events + counts.listings : 0;

  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        <BackLink href="/" />

        <h1 className="text-2xl font-black text-text-primary mb-6">Search</h1>

        <div className="mb-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search users, posts, clubs..."
              className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-text-primary placeholder:text-text-tertiary"
              autoFocus
            />
          </div>
        </div>

        {/* Category tabs */}
        {results && total > 0 && (
          <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-border mb-4 -mx-1 px-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  tab === key ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key !== "top" && counts && counts[key as Exclude<TabKey, "top">] > 0 && (
                  <span className="text-[10px] text-text-tertiary">{counts[key as Exclude<TabKey, "top">]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
          </div>
        )}

        {!loading && query.length < 2 && searchInput.trim().length < 2 && (
          <div className="flex flex-col items-center justify-center p-12 text-text-tertiary">
            <SearchIcon className="h-12 w-12 mb-4 opacity-50" />
            <p>Type at least 2 characters to search</p>
          </div>
        )}

        {!loading && results && total === 0 && (searchInput.trim().length >= 2 || query.length >= 2) && (
          <div className="flex flex-col items-center justify-center p-12 text-text-tertiary">
            <p>No results found.</p>
          </div>
        )}

        {!loading && results && total > 0 && (
          <div className="space-y-6">
            {(tab === "top" || tab === "users") && results.users.length > 0 && (
              <Section label="People" icon={Users} showAll={tab === "top" && results.users.length > 3} onSeeAll={() => setTab("users")}>
                {(tab === "top" ? results.users.slice(0, 3) : results.users).map((u) => (
                  <Link key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <Avatar user={u} size={36} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-text-primary truncate">
                        {u.display_name}
                        {u.role && <RoleBadge role={u.role} hideStudent size={11} />}
                      </p>
                      {u.faculty && <p className="text-xs text-text-tertiary">{u.faculty}</p>}
                    </div>
                  </Link>
                ))}
              </Section>
            )}

            {(tab === "top" || tab === "posts") && results.posts.length > 0 && (
              <Section label="Posts" icon={FileText} showAll={tab === "top" && results.posts.length > 3} onSeeAll={() => setTab("posts")}>
                {(tab === "top" ? results.posts.slice(0, 3) : results.posts).map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`} className="block bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <p className="text-sm text-text-primary line-clamp-2">{post.content}</p>
                    <p className="text-xs text-text-tertiary mt-1">{post.author_name} &middot; {new Date(post.created_at).toLocaleDateString()}</p>
                  </Link>
                ))}
              </Section>
            )}

            {(tab === "top" || tab === "clubs") && results.clubs.length > 0 && (
              <Section label="Clubs" icon={BookOpen} showAll={tab === "top" && results.clubs.length > 3} onSeeAll={() => setTab("clubs")}>
                {(tab === "top" ? results.clubs.slice(0, 3) : results.clubs).map((club) => (
                  <Link key={club.id} href={`/clubs/${club.slug}`} className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <BookOpen className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{club.name}</p>
                      <p className="text-xs text-text-tertiary">{club.member_count} members</p>
                    </div>
                  </Link>
                ))}
              </Section>
            )}

            {(tab === "top" || tab === "events") && results.events.length > 0 && (
              <Section label="Events" icon={Calendar} showAll={tab === "top" && results.events.length > 3} onSeeAll={() => setTab("events")}>
                {(tab === "top" ? results.events.slice(0, 3) : results.events).map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="block bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <p className="font-medium text-text-primary">{event.title}</p>
                    <p className="text-xs text-text-tertiary">
                      {event.start_time && new Date(event.start_time).toLocaleDateString()}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </Link>
                ))}
              </Section>
            )}

            {(tab === "top" || tab === "listings") && results.listings.length > 0 && (
              <Section label="Marketplace" icon={ShoppingBag} showAll={tab === "top" && results.listings.length > 3} onSeeAll={() => setTab("listings")}>
                {(tab === "top" ? results.listings.slice(0, 3) : results.listings).map((listing) => (
                  <Link key={listing.id} href={`/marketplace/${listing.id}`} className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition-colors">
                    <div>
                      <p className="font-medium text-text-primary">{listing.title}</p>
                      <p className="text-xs text-text-tertiary">{listing.category}</p>
                    </div>
                    <span className="text-sm font-bold text-success">₹{listing.price.toLocaleString("en-IN")}</span>
                  </Link>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  icon: Icon,
  showAll,
  onSeeAll,
  children,
}: {
  label: string;
  icon: typeof Users;
  showAll: boolean;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-tertiary uppercase tracking-wider">
          <Icon className="h-4 w-4" /> {label}
        </h3>
        {showAll && (
          <button onClick={onSeeAll} className="text-xs font-semibold text-accent hover:underline">
            See all
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
