"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { useIntersectionObserver } from "@/hooks/use-intersection";
import { CreatePost } from "@/components/create-post";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { toast } from "sonner";
import { MoreVertical, Shield, ShieldOff, UserMinus, Trash2, Flag } from "lucide-react";
import { ReportModal } from "@/components/report-modal";
import type { PostData } from "@/types/post";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  banner_url: string | null;
  logo_url: string | null;
  is_verified: boolean;
  is_approved: boolean;
  is_premium: boolean;
  member_count: number;
  is_member: boolean;
  member_role: string | null;
}

interface MemberData {
  id: string;
  club_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: {
    id: string;
    email: string;
    role: string;
    profile: {
      display_name: string;
      faculty: string | null;
      avatar_url: string | null;
    } | null;
  };
}

const CATEGORY_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  academic: { label: "Academic", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  sports: { label: "Sports", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  cultural: { label: "Cultural", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  social: { label: "Social", bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  political: { label: "Political", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  religious: { label: "Religious", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  tech: { label: "Tech", bg: "bg-accent/10", text: "text-accent", border: "border-accent/20" },
  other: { label: "General", bg: "bg-zinc-500/10", text: "text-text-muted", border: "border-zinc-500/20" },
};

export default function ClubHubPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  const [club, setClub] = useState<ClubData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [clubEvents, setClubEvents] = useState<{ id: string; title: string; start_time: string; location: string | null; rsvp_count: number; rsvp_limit: number | null }[]>([]);
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchClubDetails = async () => {
    window.setTimeout(() => setIsPageLoading(true), 0);
    try {
      const clubRes = await apiClient.get<ClubData>(`/clubs/${slug}`);
      const clubData = clubRes.data;
      window.setTimeout(() => {
        setClub(clubData);
        setEditDesc(clubData.description || "");
        setEditLogo(clubData.logo_url || "");
        setEditBanner(clubData.banner_url || "");
      }, 0);

      // Load members
      const membersRes = await apiClient.get<MemberData[]>(`/clubs/${clubData.id}/members`);
      window.setTimeout(() => setMembers(membersRes.data), 0);

      // Load club events
      try {
        const eventsRes = await apiClient.get("/events", { params: { club_id: clubData.id, status: "upcoming" } });
        window.setTimeout(() => setClubEvents(eventsRes.data.slice(0, 3)), 0);
      } catch { /* non-critical */ }

      // Trigger feed load
      fetchFeed(clubData.id, null, false);
    } catch (err) {
      console.error("Failed to load club details", err);
      if (getApiErrorStatus(err) === 404) {
        router.push("/clubs");
      }
    } finally {
      window.setTimeout(() => setIsPageLoading(false), 0);
    }
  };

  const fetchFeed = async (clubId: string, cursor: string | null = null, append = false) => {
    if (cursor) {
      window.setTimeout(() => setIsMoreLoading(true), 0);
    } else {
      window.setTimeout(() => setIsFeedLoading(true), 0);
    }

    try {
      const response = await apiClient.get("/posts", {
        params: {
          cursor: cursor,
          limit: 10,
          club_id: clubId,
        },
      });

      const { items, next_cursor, has_more } = response.data;

      window.setTimeout(() => {
        if (append) {
          setPosts((prev) => [...prev, ...items]);
        } else {
          setPosts(items);
        }
        setNextCursor(next_cursor);
        setHasMore(has_more);
      }, 0);
    } catch (err) {
      console.error("Failed to load club feed", err);
    } finally {
      window.setTimeout(() => {
        setIsFeedLoading(false);
        setIsMoreLoading(false);
      }, 0);
    }
  };

  useEffect(() => {
    if (user && slug) {
      fetchClubDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, slug]);

  // Infinite Scroll Hook
  useIntersectionObserver(
    loaderRef,
    () => {
      if (club && hasMore && !isMoreLoading) {
        fetchFeed(club.id, nextCursor, true);
      }
    },
    hasMore && !isFeedLoading && !isMoreLoading
  );

  const handleJoinLeave = async () => {
    if (!club) return;
    setActionLoading(true);
    try {
      if (club.is_member) {
        await apiClient.delete(`/clubs/${club.id}/join`);
        setClub((prev) =>
          prev
            ? { ...prev, is_member: false, member_count: prev.member_count - 1, member_role: null }
            : null
        );
        // Remove from local members list
        setMembers((prev) => prev.filter((m) => m.user_id !== user?.id));
      } else {
        await apiClient.post(`/clubs/${club.id}/join`);
        setClub((prev) =>
          prev
            ? { ...prev, is_member: true, member_count: prev.member_count + 1, member_role: "member" }
            : null
        );
        // Refresh members list
        const membersRes = await apiClient.get<MemberData[]>(`/clubs/${club.id}/members`);
        setMembers(membersRes.data);
      }
    } catch (err) {
      console.error("Failed to join or leave society", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostCreated = (newPost: PostData) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleUpdateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;

    setIsUpdating(true);
    setUpdateError("");

    try {
      const res = await apiClient.patch(`/clubs/${club.id}`, {
        description: editDesc.trim() || null,
        logo_url: editLogo.trim() || null,
        banner_url: editBanner.trim() || null,
      });

      setClub((prev) => (prev ? { ...prev, ...res.data } : null));
      setIsEditOpen(false);
    } catch (err) {
      setUpdateError(
        getApiErrorMessage(err, "Failed to update society hub profile. Please try again.")
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    if (!club) return;
    try {
      const res = await apiClient.patch(`/clubs/${club.id}/members/${userId}/role`, { role: newRole });
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role: res.data.role } : m));
      toast.success(`Member role updated`);
      setMemberMenuOpen(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update role."));
    }
  };

  const handleKickMember = async (userId: string) => {
    if (!club) return;
    try {
      await apiClient.delete(`/clubs/${club.id}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setClub((prev) => prev ? { ...prev, member_count: prev.member_count - 1 } : null);
      toast.success("Member removed");
      setMemberMenuOpen(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to remove member."));
    }
  };

  const handleDeleteClub = async () => {
    if (!club) return;
    try {
      await apiClient.delete(`/clubs/${club.id}`);
      toast.success("Club deleted");
      router.push("/clubs");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete club."));
    }
  };

  // Document Title update
  useEffect(() => {
    if (club) {
      document.title = `${club.name} Hub | CU Campus Connect`;
    }
  }, [club]);

  // Close member menu on outside click
  useEffect(() => {
    if (!memberMenuOpen) return;
    const handleClick = () => setMemberMenuOpen(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [memberMenuOpen]);

  if (loading || isPageLoading || !user) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-main">
        <svg className="animate-spin h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-main text-text-main p-8 text-center">
        <h3 className="text-xl font-bold">Society Hub Loading Failed</h3>
        <p className="text-text-muted text-sm mt-2">The requested university page could not be located.</p>
        <Link href="/clubs" className="mt-6 text-sm text-accent font-bold hover:underline">
          Return to Clubs directory
        </Link>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return (name || "?").charAt(0).toUpperCase();
  };

  const isManagementAllowed = club.member_role === "owner" || club.member_role === "admin";
  const catInfo = CATEGORY_MAP[club.category] || CATEGORY_MAP.other;

  return (
    <div className="flex-1 min-h-screen bg-bg-main text-text-main flex flex-col relative">
      {/* Background radial overlays */}
      <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />

      {/* Main Grid Layout Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 relative z-10">
        
        {/* Left Sidebar */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          {/* Logo Header */}
          <Link href="/" className="flex items-center gap-3 px-2 select-none group">
            <div className="w-10 h-10 rounded-xl bg-accent text-text-inverse flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-black tracking-wider text-accent block">CU CAMPUS</span>
              <span className="text-[10px] font-black tracking-widest text-text-muted block -mt-1">CONNECT</span>
            </div>
          </Link>

          {/* Navigation mini-menu */}
          <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-1 select-none">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-muted hover:text-text-main rounded-xl hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Feed Dashboard
            </Link>
            <Link
              href="/clubs"
              className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-text-muted hover:text-text-main rounded-xl hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Clubs & Societies
            </Link>
            <Link
              href="/clubs"
              className="flex items-center gap-2 mt-2 pt-2.5 border-t border-border text-xs font-bold text-accent hover:text-accent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back to directory
            </Link>
          </div>

          {/* Student mini-card */}
          <div className="bg-bg-surface border border-border rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-xl bg-accent flex items-center justify-center shadow-md">
              <span className="text-3xl font-bold text-text-inverse select-none">
                {getInitials(user?.profile?.display_name || "")}
              </span>
            </div>
            <h2 className="text-lg font-bold text-text-main mt-4">{user?.profile?.display_name}</h2>
            <p className="text-text-muted text-xs font-semibold mt-0.5">{user?.email}</p>
          </div>

          <div className="hidden lg:block mt-auto">
            <Button variant="secondary" onClick={logout} fullWidth>
              Log out session
            </Button>
          </div>
        </aside>

        {/* Dynamic Club Hub Panel */}
        <main className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* Banner Container */}
          <div className="w-full h-44 sm:h-56 rounded-3xl overflow-hidden border border-border bg-bg-main relative shadow-xl select-none shrink-0">
            {club.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={club.banner_url}
                alt={`${club.name} banner`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full bg-accent/5 flex items-center justify-center relative">
                {/* Abstract geometric grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
              </div>
            )}

            {/* Hub Header Overlay Controls */}
            {isManagementAllowed && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="absolute right-4 top-4 px-3.5 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-border hover:bg-black/80 text-xs font-extrabold text-text-main flex items-center gap-1.5 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Hub
              </button>
            )}
          </div>

          {/* Identity Header row */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 -mt-3 select-none">
            <div className="flex gap-4 items-start">
              {club.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.logo_url}
                  alt={`${club.name} logo`}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-bg-main bg-bg-surface -mt-8 shadow-xl relative z-10 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-bg-surface border-2 border-bg-main flex items-center justify-center shrink-0 -mt-8 shadow-xl relative z-10">
                  <span className="text-text-muted font-black text-xl">
                    {club.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-text-main">{club.name}</h1>
                  
                  {club.is_verified && (
                    <svg
                      className="w-5 h-5 text-sky-400 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-label="Verified society"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a.75.75 0 00-.708-.523H4.5a2.5 2.5 0 00-2.5 2.5v1.059a.75.75 0 00.523.708 3.5 3.5 0 010 6.596.75.75 0 00-.523.708V15.5a2.5 2.5 0 002.5 2.5h1.059a.75.75 0 00.708-.523 3.5 3.5 0 016.596 0 .75.75 0 00.708.523H15.5a2.5 2.5 0 002.5-2.5v-1.059a.75.75 0 00-.523-.708 3.5 3.5 0 010-6.596.75.75 0 00.523-.708V4.5a2.5 2.5 0 00-2.5-2.5h-1.059a.75.75 0 00-.708.523 3.5 3.5 0 01-6.596 0zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 7a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {club.is_premium && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 shrink-0 select-none">
                      PREMIUM
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${catInfo.bg} ${catInfo.text} border ${catInfo.border}`}>
                    {catInfo.label}
                  </span>
                  <span className="text-xs font-bold text-text-muted">
                    {club.member_count} {club.member_count === 1 ? "Member" : "Members"}
                  </span>
                </div>
              </div>
            </div>

            {club.member_role === "owner" ? (
              <span className="text-[10px] font-black uppercase tracking-widest text-accent px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl">
                Society Owner
              </span>
            ) : (
              <Button
                variant={club.is_member ? "secondary" : "primary"}
                onClick={handleJoinLeave}
                isLoading={actionLoading}
                className="shrink-0 min-w-[80px]"
              >
                {club.is_member ? "Leave Society" : "Join Society"}
              </Button>
            )}
          </div>

          {!club.is_member && club.member_role !== "owner" && (
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-like transition-colors mt-1"
            >
              <Flag className="h-3.5 w-3.5" />
              Report Society
            </button>
          )}

          {/* Description */}
          <div className="bg-bg-surface border border-border rounded-2xl p-5 select-none shrink-0">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">ABOUT THIS SOCIETY</h3>
            <p className="text-sm text-text-main mt-2 leading-relaxed font-medium">
              {club.description || "Official university society hub, encouraging academic research, recreational engagement, and professional training."}
            </p>
          </div>

          {/* Two-Column Workspace Feed vs Members */}
          <div className="w-full flex flex-col md:flex-row gap-6 items-start">
            
            {/* Column 1: Society Social Stream */}
            <section className="flex-1 w-full flex flex-col gap-6 order-2 md:order-1">
              
              <div className="border-b border-border pb-2 flex items-center justify-between select-none">
                <h2 className="text-base font-black text-text-main uppercase tracking-wider">Society Feed</h2>
                <span className="text-[10px] font-bold text-text-muted">
                  {posts.length} {posts.length === 1 ? "Update" : "Updates"}
                </span>
              </div>

              {/* Feed Gated Notice if not member */}
              {!club.is_member ? (
                <div className="bg-bg-surface border border-border rounded-2xl p-6 text-center select-none bg-zinc-900/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-muted mx-auto mb-3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <h4 className="text-sm font-bold text-text-muted">Feed is view-only</h4>
                  <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                    You must join the <strong>{club.name}</strong> to publish discussions, share advice, or interact with other members on this page.
                  </p>
                </div>
              ) : (
                <CreatePost onPostCreated={handlePostCreated} clubId={club.id} />
              )}

              {/* Club-linked Posts Feed */}
              {isFeedLoading ? (
                <div className="space-y-6 animate-pulse">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-bg-surface border border-border rounded-2xl p-6 h-48 flex flex-col gap-4">
                      <div className="flex gap-3 items-center">
                        <div className="w-11 h-11 bg-bg-surface rounded-xl" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-bg-surface rounded w-1/4" />
                          <div className="h-3 bg-bg-surface rounded w-1/6" />
                        </div>
                      </div>
                      <div className="h-4 bg-bg-surface rounded w-full mt-2" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center select-none">
                  <h3 className="text-base font-bold text-text-muted">No posts in society hub yet</h3>
                  <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                    {club.is_member
                      ? "Start the conversation! Be the first member to share tips, announce an event, or chat here."
                      : "Feed is quiet. Once members join, active updates and announcements will populate this stream."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}

                  {/* Infinite scroll loader anchor */}
                  <div ref={loaderRef} className="h-10 flex justify-center items-center">
                    {isMoreLoading && (
                      <svg className="animate-spin h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Column 2: Members list side directory (Takes 1/3 width) */}
            <section className="w-full md:w-80 shrink-0 flex flex-col gap-6 order-1 md:order-2">
              
              <div className="border-b border-border pb-2 select-none">
                <h2 className="text-base font-black text-text-main uppercase tracking-wider">Members directory</h2>
              </div>

              <div className="bg-bg-surface border border-border rounded-2xl p-4 flex flex-col gap-4 max-h-[420px] overflow-y-auto">
                {members.map((member) => {
                  const prof = member.user?.profile;
                  const display = prof?.display_name || member.user?.email.split("@")[0].toUpperCase();
                  const canManage = isManagementAllowed && member.role !== "owner" && member.user_id !== user?.id;

                  return (
                    <div key={member.id} className="flex items-center justify-between gap-3 relative">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-text-inverse">
                            {getInitials(display)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-text-main truncate block">
                            {display}
                          </span>
                          <span className="text-[10px] text-text-muted truncate block -mt-0.5">
                            {prof?.faculty || "General Student"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {member.role === "owner" && (
                          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent text-[8px] font-black uppercase select-none">
                            Owner
                          </span>
                        )}
                        {member.role === "admin" && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase select-none">
                            Admin
                          </span>
                        )}
                        {member.role === "member" && (
                          <span className="text-[8px] font-bold text-text-muted uppercase select-none">
                            Member
                          </span>
                        )}

                        {canManage && (
                          <div className="relative">
                            <button
                              onClick={() => setMemberMenuOpen(memberMenuOpen === member.user_id ? null : member.user_id)}
                              className="p-1 rounded hover:bg-[rgba(var(--bg-hover),0.08)] text-text-muted transition-colors"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                            {memberMenuOpen === member.user_id && (
                              <div className="absolute right-0 top-full mt-1 z-50 bg-bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px] animate-fade-in">
                                {member.role === "member" && (
                                  <button
                                    onClick={() => handleUpdateMemberRole(member.user_id, "admin")}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-main hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                                  >
                                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                                    Promote to Admin
                                  </button>
                                )}
                                {member.role === "admin" && (
                                  <button
                                    onClick={() => handleUpdateMemberRole(member.user_id, "member")}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-main hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors"
                                  >
                                    <ShieldOff className="h-3.5 w-3.5 text-text-muted" />
                                    Demote to Member
                                  </button>
                                )}
                                <button
                                  onClick={() => handleKickMember(member.user_id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                  Remove from Club
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Club Events */}
              {clubEvents.length > 0 && (
                <div>
                  <div className="border-b border-border pb-2 mb-4 select-none">
                    <h2 className="text-base font-black text-text-main uppercase tracking-wider">Upcoming Events</h2>
                  </div>
                  <div className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                    {clubEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="flex flex-col gap-1 p-2.5 rounded-lg hover:bg-[rgba(var(--bg-hover),0.08)] transition-colors duration-200"
                      >
                        <p className="text-sm font-semibold text-text-main leading-snug line-clamp-1">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-text-muted">
                          <span>{new Date(event.start_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          {event.location && <span className="truncate">{event.location}</span>}
                          <span className="text-accent font-semibold">
                            {event.rsvp_count}/{event.rsvp_limit || "∞"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Edit Hub Modal Overlay */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-bg-surface border border-border rounded-3xl p-6 sm:p-8 animate-pop-in relative shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="absolute right-6 top-6 p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-[rgba(var(--bg-hover),0.08)] focus:outline-none transition-colors"
              aria-label="Close edit modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-text-main">Edit Society Hub</h2>
              <p className="text-text-muted text-xs mt-1.5">
                Customize banners, logos, and descriptions for <strong>{club.name}</strong>.
              </p>
            </div>

            {updateError && (
              <div className="mb-4 p-3 rounded-xl bg-like/10 border border-like/20 text-xs font-semibold text-like text-center">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateClub} className="space-y-5">
              {/* Logo URL */}
              <Input
                label="Logo Image URL"
                id="edit-logo"
                placeholder="e.g. https://images.unsplash.com/photo-..."
                value={editLogo}
                onChange={(e) => setEditLogo(e.target.value)}
                type="url"
                maxLength={500}
              />

              {/* Banner URL */}
              <Input
                label="Banner Image URL"
                id="edit-banner"
                placeholder="e.g. https://images.unsplash.com/photo-..."
                value={editBanner}
                onChange={(e) => setEditBanner(e.target.value)}
                type="url"
                maxLength={500}
              />

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="edit-description"
                  className="text-sm font-semibold text-text-main cursor-pointer"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  placeholder="What is your society about? Meeting schedules, mission details..."
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full min-h-[120px] p-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm placeholder-zinc-600 transition-all duration-200 outline-none resize-none"
                  maxLength={2000}
                />
              </div>

              <div className="flex gap-4 justify-end pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isUpdating}>
                  Save changes
                </Button>
              </div>
            </form>

            {/* Danger Zone - Delete Club (Owner only) */}
            {club.member_role === "owner" && (
              <div className="mt-6 pt-5 border-t border-border">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Danger Zone</h4>
                <p className="text-xs text-text-muted mb-3">Permanently delete this club. This action cannot be undone.</p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Club
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-bg-surface border border-border rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">Delete Club</h3>
                <p className="text-xs text-text-muted">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Are you sure you want to permanently delete <strong>{club?.name}</strong>? All posts, members, and data will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeleteClub} className="bg-red-500 text-white hover:bg-red-600">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {showReport && club && (
        <ReportModal
          targetType="club"
          targetId={club.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
