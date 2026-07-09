"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, Users, Verified, Crown, Loader2 } from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateClub } from "@/components/create-club";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  member_count: number;
  is_member: boolean;
  is_verified: boolean;
  is_premium: boolean;
  logo_url: string | null;
  banner_url: string | null;
}

const CATEGORY_MAP: Record<string, string> = {
  tech: "Technology",
  academic: "Academic",
  cultural: "Arts & Culture",
  social: "Social",
  sports: "Sports",
  political: "Political",
  religious: "Religious",
  other: "General",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tech: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
  academic: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  cultural: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  social: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  sports: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  political: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  religious: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  other: { bg: "bg-zinc-500/10", text: "text-text-secondary", border: "border-zinc-500/20" },
};

const CATEGORIES = ["All", "tech", "academic", "cultural", "social", "sports", "political", "religious", "other"];

function formatMemberCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function getInitials(name: string): string {
  return (name || "?").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

export default function ClubsPage() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [showMyClubs, setShowMyClubs] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiClient.get("/clubs").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setClubs(data);
    }).catch(() => toast.error("Failed to load clubs")).finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    return clubs.filter((c) => {
      if (showMyClubs && !c.is_member) return false;
      if (cat !== "All" && c.category !== cat) return false;
      if (q.trim() && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [clubs, showMyClubs, cat, q]);

  const handleJoinLeave = async (club: Club, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (joiningClubId) return;
    setJoiningClubId(club.id);
    try {
      if (club.is_member) {
        await apiClient.delete(`/clubs/${club.id}/join`);
        setClubs((prev) =>
          prev.map((c) => c.id === club.id ? { ...c, is_member: false, member_count: c.member_count - 1 } : c)
        );
        toast.success(`Left ${club.name}`);
      } else {
        await apiClient.post(`/clubs/${club.id}/join`);
        setClubs((prev) =>
          prev.map((c) => c.id === club.id ? { ...c, is_member: true, member_count: c.member_count + 1 } : c)
        );
        toast.success(`Joined ${club.name}`);
      }
    } catch (err) {
      toast.error("Action failed. Please try again.");
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleClubCreated = (newClub: { id: string; name: string; description: string | null; category: string; logo_url: string | null; banner_url: string | null }) => {
    setClubs((prev) => [{ ...newClub, is_member: true, member_count: 1, is_verified: false, is_premium: false, slug: "", logo_url: null, banner_url: null }, ...prev]);
    toast.success("Club created! Awaiting moderator approval.");
  };

  if (!user) return null;

  return (
    <LayoutShell hideRightRail>
      <PageHeader title="Clubs" />
      <div className="px-6 py-4">
        {/* Search + Create Club */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2.5 transition-colors focus-within:border-accent">
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs..."
              className="flex-1 bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-accent-foreground text-body-sm font-semibold hover:opacity-90 active:scale-95 transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Club</span>
          </button>
        </div>

        {/* My Clubs Toggle + Category Chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowMyClubs(!showMyClubs)}
            className={cn(
              "rounded-full border px-3 py-1 text-caption font-semibold transition-all",
              showMyClubs
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border-strong text-text-secondary hover:bg-surface",
            )}
          >
            My Clubs
          </button>
          <div className="w-px h-5 self-center bg-border" />
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-caption font-medium transition-all",
                cat === c
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border-strong text-text-secondary hover:bg-surface",
              )}
            >
              {c === "All" ? "All" : CATEGORY_MAP[c] || c}
            </button>
          ))}
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border-strong bg-surface p-5 animate-pulse reveal-up" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-xl bg-border-strong" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border-strong rounded w-2/3" />
                    <div className="h-3 bg-border-strong rounded w-1/3" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-3 bg-border-strong rounded w-full" />
                  <div className="h-3 bg-border-strong rounded w-4/5" />
                </div>
                <div className="h-9 bg-border-strong rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="mt-16 flex flex-col items-center justify-center text-center reveal-up stagger-1">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-text-secondary" />
            </div>
            <h3 className="font-display text-h2 font-medium text-text-primary leading-tight">
              {showMyClubs ? "You haven't joined any clubs" : q ? "No clubs found" : "No clubs yet"}
            </h3>
            <p className="font-sans text-body-sm text-text-secondary mt-1 max-w-xs leading-relaxed">
              {showMyClubs
                ? "Browse the directory and join clubs that interest you."
                : q
                  ? "Try a different search term or category."
                  : "Be the first to create a club on campus!"}
            </p>
            {!showMyClubs && !q && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-body-sm font-semibold hover:bg-accent-press active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Create Club
              </button>
            )}
          </div>
        ) : (
          /* Club Grid */
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((club, idx) => {
              const catColor = CATEGORY_COLORS[club.category] || CATEGORY_COLORS.other;
              const catLabel = CATEGORY_MAP[club.category] || club.category;
              const stagger = Math.min(idx + 1, 8);
              return (
                <Link
                  key={club.id}
                  href={`/clubs/${club.slug}`}
                  className={`group rounded-xl border border-border-strong bg-surface p-5 hover:border-accent/30 hover:shadow-md transition-all duration-200 active:scale-[0.98] reveal-up stagger-${stagger}`}
                >
                  {/* Header: Logo + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover border border-border-strong" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="font-display text-h2 text-accent font-medium">{getInitials(club.name)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display text-body-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                          {club.name}
                        </p>
                        {club.is_verified && <Verified className="h-3.5 w-3.5 text-sky-400 shrink-0" fill="currentColor" />}
                        {club.is_premium && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", catColor.bg, catColor.text, "border", catColor.border)}>
                          {catLabel}
                        </span>
                        <span className="font-sans text-caption text-text-secondary">
                          {formatMemberCount(club.member_count)} members
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {club.description && (
                    <p className="font-sans text-body-sm text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                      {club.description}
                    </p>
                  )}

                  {/* Join/Leave Button */}
                  <button
                    onClick={(e) => handleJoinLeave(club, e)}
                    disabled={joiningClubId === club.id}
                    className={cn(
                      "w-full rounded-full py-2 font-sans text-body-sm font-semibold transition-all active:scale-95 disabled:opacity-50",
                      club.is_member
                        ? "bg-surface border border-border-strong text-text-secondary hover:border-accent/30 hover:text-accent"
                        : "bg-accent text-accent-foreground hover:bg-accent-press",
                    )}
                  >
                    {joiningClubId === club.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : club.is_member ? (
                      "Joined"
                    ) : (
                      "Join"
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreateClub
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onClubCreated={handleClubCreated}
      />
    </LayoutShell>
  );
}
