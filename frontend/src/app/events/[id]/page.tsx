"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Clock,
  Users,
  Calendar,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Trash2,
  Edit,
  ImageOff,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount, getInitials, getRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import type { EventData } from "@/types/events";

const RSVP_OPTIONS = [
  { value: "going", label: "Going", icon: CheckCircle2, activeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { value: "maybe", label: "Maybe", icon: HelpCircle, activeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { value: "not_going", label: "Can't Go", icon: XCircle, activeColor: "bg-like/10 text-like border-like/30" },
] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string, end: string | null): string {
  const s = new Date(start);
  const timeStr = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (end) {
    const e = new Date(end);
    const endTimeStr = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${timeStr} – ${endTimeStr}`;
  }
  return timeStr;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!params.id || !user) return;
    try {
      const res = await apiClient.get(`/events/${params.id}`);
      setEvent(res.data);
    } catch (err) {
      if (getApiErrorStatus(err) === 404) setError("Event not found.");
      else setError("Failed to load event.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id, user]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleRsvp = async (status: string) => {
    if (!event || rsvpLoading) return;
    setRsvpLoading(true);
    try {
      await apiClient.post(`/events/${event.id}/rsvp`, { status });
      const wasGoing = event.user_rsvp === "going";
      const isNowGoing = status === "going";
      let delta = 0;
      if (!wasGoing && isNowGoing) delta = 1;
      else if (wasGoing && !isNowGoing) delta = -1;
      setEvent((prev) => prev ? {
        ...prev,
        user_rsvp: (prev.user_rsvp === status ? null : status) as EventData["user_rsvp"],
        rsvp_count: prev.rsvp_count + delta,
      } : prev);
    } catch (err) {
      console.error("RSVP failed", err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/events/${event.id}`);
      router.push("/events");
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isOrganizer = user && event && user.id === event.organizer_id;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg">
        <Loader2 className="h-10 w-10 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center gap-4">
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center">
          <XCircle className="h-10 w-10 text-text-secondary mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-text-secondary">{error || "Event not found"}</h2>
          <Link href="/events" className="text-accent text-sm font-semibold mt-2 inline-block hover:underline">Back to Events</Link>
        </div>
      </div>
    );
  }

  const capacityPercent = event.rsvp_limit ? Math.min((event.rsvp_count / event.rsvp_limit) * 100, 100) : null;
  const organizerName = event.organizer?.profile?.display_name || event.organizer?.email?.split("@")[0] || "Unknown";

  return (
    <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col relative">
      <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />

      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 relative z-10">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          Back to Events
        </Link>

        {event.cover_image_url ? (
          <div className="relative h-64 rounded-2xl overflow-hidden mb-6">
            <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              {event.club && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white border border-white/10 mb-2 inline-block">
                  {event.club.name}
                </span>
              )}
              <h1 className="text-3xl font-black text-white tracking-tight">{event.title}</h1>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              {event.club && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent/10 text-accent">
                  {event.club.name}
                </span>
              )}
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                event.status === "upcoming" ? "bg-emerald-500/10 text-emerald-400" :
                event.status === "ongoing" ? "bg-accent/10 text-accent" :
                event.status === "cancelled" ? "bg-like/10 text-like" :
                "bg-text-muted/10 text-text-muted"
              )}>
                {event.status}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">{event.title}</h1>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {event.description && (
              <div className="bg-bg-surface border border-border rounded-2xl p-6">
                <h2 className="text-sm font-bold text-text-primary mb-3">About This Event</h2>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            <div className="bg-bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-sm font-bold text-text-primary mb-4">Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{formatDateTime(event.start_time)}</p>
                    <p className="text-xs text-text-muted mt-0.5">{formatTimeRange(event.start_time, event.end_time)}</p>
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <p className="text-sm font-semibold text-text-primary">{event.location}</p>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {event.rsvp_count} attending
                      {event.rsvp_limit ? ` of ${event.rsvp_limit} capacity` : ""}
                    </p>
                    {capacityPercent !== null && (
                      <div className="mt-2 w-48 h-1.5 rounded-full bg-surface overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            capacityPercent >= 90 ? "bg-like" : capacityPercent >= 70 ? "bg-amber-400" : "bg-accent"
                          )}
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-bg-surface border border-border rounded-2xl p-6">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">RSVP</h3>
              <div className="flex flex-col gap-2">
                {RSVP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRsvp(opt.value)}
                    disabled={rsvpLoading || event.status === "past"}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95",
                      event.user_rsvp === opt.value
                        ? opt.activeColor
                        : "border-border text-text-secondary hover:bg-surface",
                      (rsvpLoading || event.status === "past") && "opacity-50"
                    )}
                  >
                    {rsvpLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <opt.icon className="h-4 w-4" />
                    )}
                    {opt.label}
                    {event.user_rsvp === opt.value && (
                      <span className="text-[10px]">(selected)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-bg-surface border border-border rounded-2xl p-5">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Organizer</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-text-inverse select-none">
                    {getInitials(organizerName)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{organizerName}</p>
                  <p className="text-[11px] text-text-secondary">Event Organizer</p>
                </div>
              </div>
            </div>

            {isOrganizer && (
              <div className="bg-bg-surface border border-border rounded-2xl p-5">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Manage</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl bg-like/10 text-like border border-like/20 hover:bg-like/20 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Event
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-bg-surface border border-border rounded-3xl p-6 animate-pop-in text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete Event?</h3>
            <p className="text-xs text-text-secondary mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button onClick={handleDelete} isLoading={isDeleting}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
