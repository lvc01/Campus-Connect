"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, LogIn, Sparkles, Flag, Ban, Check } from "lucide-react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfilePostsList } from "@/components/profile/profile-posts-list";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { useAuth } from "@/context/auth-context";
import { usePublicProfile } from "@/hooks/use-public-profile";
import { ReportModal } from "@/components/report-modal";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const SignedOutView: React.FC = () => (
  <main className="flex min-h-screen items-center justify-center bg-background px-6">
    <div className="max-w-md text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/30">
        <LogIn className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight">Sign in to view profiles</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        You need to be signed in to see what others are sharing on campus.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground shadow-md shadow-accent/25 transition hover:bg-accent/90 active:scale-95"
      >
        Log in
      </Link>
    </div>
  </main>
);

const LoadingSplash: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
    <Sparkles className="h-8 w-8 animate-pulse text-accent" />
  </div>
);

const ProfileNotFound: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4">
    <div className="border border-border rounded-xl p-8 text-center max-w-md">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">User not found</h2>
      <p className="text-sm text-muted-foreground mt-2">
        This user does not exist or has been deactivated.
      </p>
      <div className="mt-6">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">
          Back to feed
        </Link>
      </div>
    </div>
  </div>
);

export default function PublicProfilePage() {
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : "";
  const { user, loading } = useAuth();
  const { profile, isLoading, error, refresh } = usePublicProfile(userId);
  const [showReport, setShowReport] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (user && profile && user.id !== profile.id) {
      checkBlockStatus();
    }
  }, [user, profile]);

  async function checkBlockStatus() {
    try {
      const { data } = await apiClient.get("/users/me/blocks");
      setIsBlocked(data.some((b: { id: string }) => b.id === userId));
    } catch {}
  }

  async function handleBlock() {
    if (blocking) return;
    setBlocking(true);
    try {
      if (isBlocked) {
        await apiClient.delete(`/users/${userId}/block`);
        setIsBlocked(false);
        toast.success("User unblocked");
      } else {
        await apiClient.post(`/users/${userId}/block`);
        setIsBlocked(true);
        toast.success("User blocked");
      }
    } catch {
      toast.error("Failed to update block status");
    } finally {
      setBlocking(false);
    }
  }

  if (loading) return <LoadingSplash />;
  if (!user) return <SignedOutView />;
  if (error === "User not found") return <ProfileNotFound />;
  if (!profile && !isLoading) return <ProfileNotFound />;
  if (isLoading || !profile) return <LoadingSplash />;

  const isOwn = user.id === profile.id;

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto w-full px-6 py-6">
        <ProfileHeader profile={profile} isOwn={isOwn} onProfileUpdated={refresh} />

        {!isOwn && (
          <div className="mt-3 flex justify-end gap-3">
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-error transition-colors disabled:opacity-50"
            >
              {isBlocked ? <Check className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              {isBlocked ? "Blocked" : "Block User"}
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-like transition-colors"
            >
              <Flag className="h-3.5 w-3.5" />
              Report User
            </button>
          </div>
        )}

        <div className="mt-6">
          <ProfilePostsList userId={profile.id} />
        </div>
      </div>

      {showReport && (
        <ReportModal
          targetType="user"
          targetId={profile.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </LayoutShell>
  );
}
