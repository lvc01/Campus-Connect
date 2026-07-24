"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount } from "@/lib/utils";
import { ListingCard } from "@/components/listing-card";
import { CreateListing } from "@/components/create-listing";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  Plus,
  Package,
  Loader2,
  XCircle,
  Bookmark,
  TrendingUp,
  ArrowUpDown,
} from "lucide-react";
import type { ListingData } from "@/types/marketplace";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "textbook", label: "Textbooks" },
  { value: "accommodation", label: "Accommodation" },
  { value: "tutoring", label: "Tutoring" },
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "furniture", label: "Furniture" },
  { value: "sports", label: "Sports" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "views_desc", label: "Most Viewed" },
  { value: "rating_desc", label: "Highest Rated" },
];

type TabKey = "browse" | "my" | "saved";

export default function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("browse");
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchListings = useCallback(
    async (cursor?: string, append = false) => {
      if (!user) return;
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const params: Record<string, string | number | boolean> = {
          sort,
          limit: 20,
        };
        if (cat) params.category = cat;
        if (search) params.search = search;
        if (minPrice) params.min_price = parseFloat(minPrice);
        if (maxPrice) params.max_price = parseFloat(maxPrice);
        if (cursor) params.cursor = cursor;
        if (tab === "my" && user) params.seller_id = user.id;
        if (tab === "saved") params.saved_only = true;

        const res = await apiClient.get("/marketplace/listings", { params });
        const data = res.data;
        const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];

        if (append) {
          setListings((prev) => [...prev, ...items]);
        } else {
          setListings(items);
        }
        setNextCursor(data.next_cursor || null);
        setHasMore(data.has_more || false);
      } catch (err) {
        setError("Failed to load listings.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, cat, search, sort, minPrice, maxPrice, tab]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && nextCursor) {
          fetchListings(nextCursor, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, loadingMore, fetchListings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleSaveToggle = (id: string, newSaved: boolean) => {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, is_saved: newSaved } : l))
    );
  };

  const handleListingCreated = (listing: Record<string, unknown>) => {
    setListings((prev) => [{ ...listing, is_saved: false } as ListingData, ...prev]);
    setShowCreate(false);
  };

  const handleClearFilters = () => {
    setCat("");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
    setSearchInput("");
  };

  const hasActiveFilters = cat || minPrice || maxPrice || search;

  if (!user) return null;

  return (
    <LayoutShell hideRightRail>
      <PageHeader title="Marketplace" />

      <div className="px-6">
        <div className="flex items-center gap-2 pt-3 pb-4 border-b border-border">
          {([
            { key: "browse", label: "Browse", icon: Package },
            { key: "my", label: "My Listings", icon: Package },
            { key: "saved", label: "Saved", icon: Bookmark },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                tab === key
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "gap-1.5",
                hasActiveFilters && "bg-accent/10 text-accent"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-text-inverse flex items-center justify-center">
                  {(cat ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0)}
                </span>
              )}
            </Button>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Post Listing
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="py-3 border-b border-border space-y-3 animate-slide-down">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCat(c.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-200",
                    cat === c.value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-text-secondary hover:bg-surface"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search listings..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50 transition-all"
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  Search
                </Button>
              </form>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-text-tertiary" />
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-8 w-auto min-w-[150px] gap-1.5 rounded-lg border-border bg-surface px-2.5 text-[11px] font-semibold text-text-primary shadow-none outline-none transition-colors hover:border-border-strong focus:ring-2 focus:ring-accent/30 data-[state=open]:border-accent/50 [&>span]:line-clamp-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-popover p-1 text-popover-foreground shadow-lg">
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="rounded-md text-[13px]">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-text-tertiary">Price:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-border bg-surface text-[11px] font-medium text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
                />
                <span className="text-text-tertiary">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-border bg-surface text-[11px] font-medium text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        <div className="py-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface overflow-hidden"
                >
                  <div className="h-44 bg-surface animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-surface animate-pulse rounded w-3/4" />
                    <div className="h-5 bg-surface animate-pulse rounded w-1/3" />
                    <div className="h-3 bg-surface animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <XCircle className="h-10 w-10 text-like mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-secondary">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => fetchListings()}
              >
                Retry
              </Button>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-10 w-10 text-text-tertiary mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-secondary">
                {tab === "my"
                  ? "You haven't posted any listings yet."
                  : tab === "saved"
                  ? "No saved listings."
                  : "No listings found."}
              </p>
              {(tab === "browse" || tab === "my") && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowCreate(true)}
                >
                  Post Listing
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((l, i) => (
                  <div
                    key={l.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
                  >
                    <ListingCard listing={l} onSaveToggle={handleSaveToggle} />
                  </div>
                ))}
              </div>

              {hasMore && (
                <div ref={sentinelRef} className="py-6 flex justify-center">
                  {loadingMore && (
                    <Loader2 className="h-6 w-6 text-accent animate-spin" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateListing
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onListingCreated={handleListingCreated}
      />
    </LayoutShell>
  );
}
