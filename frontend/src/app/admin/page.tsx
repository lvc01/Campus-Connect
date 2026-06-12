"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface AdminStat {
  label: string;
  value: string;
  change: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStat[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin" || user?.role === "university_staff";

  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }
    apiClient.get("/admin/stats").then((res) => {
      const d = res.data as Record<string, number>;
      const items: AdminStat[] = [
        { label: "Users", value: String(d.users ?? 0), change: "" },
        { label: "Posts", value: String(d.posts ?? 0), change: "" },
        { label: "Clubs", value: String(d.clubs ?? 0), change: "" },
        { label: "Events", value: String(d.events ?? 0), change: "" },
        { label: "Listings", value: String(d.listings ?? 0), change: "" },
        { label: "Messages", value: String(d.messages ?? 0), change: "" },
      ];
      setStats(items);
    }).finally(() => setLoading(false));
  }, [user, isAdmin]);

  if (!user) return null;

  return (
    <LayoutShell>
      <PageHeader title="Admin" />
      {!isAdmin ? (
        <div className="flex flex-col items-center justify-center gap-2 p-20 text-center">
          <Lock className="h-8 w-8 text-text-secondary" />
          <p className="text-sm font-semibold text-text-primary">Staff only</p>
          <p className="text-xs text-text-secondary">You don&apos;t have permission to view this page.</p>
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading...</div>
      ) : (
        <div className="space-y-6 p-4">
          {stats.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-text-secondary">{s.label}</p>
                  <p className="text-xl font-bold text-text-primary">{s.value}</p>
                  <p className="text-xs text-emerald-400">{s.change}</p>
                </div>
              ))}
            </div>
          )}

          <Link href="/moderation" className="block">
            <div className="rounded-xl border border-border bg-card p-5 hover:bg-surface transition-colors group cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">Moderation Dashboard</p>
                    <p className="text-xs text-text-secondary">Review reports, resolve issues, manage content</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors" />
              </div>
            </div>
          </Link>
        </div>
      )}
    </LayoutShell>
  );
}
