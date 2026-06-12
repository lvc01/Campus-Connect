"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Search,
  Plus,
  Loader2,
  XCircle,
  CheckCircle2,
  HelpCircle,
  XCircle as XCircleIcon,
  ImageOff,
} from "lucide-react";
import Link from "next/link";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount, getInitials, getRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateEvent } from "@/components/create-event";
import type { EventData } from "@/types/events";

const STATUS_TABS = ["upcoming", "my_events", "past"] as const;
type TabKey = (typeof STATUS_TABS)[number];

const RSVP_OPTIONS = [
  { value: "going", label: "Going", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "maybe", label: "Maybe", icon: HelpCircle, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "not_going", label: "Can't Go", icon: XCircleIcon, color: "text-like bg-like/10 border-like/20" },
] as const;

function formatEventDate(start: string, end: string | null): string {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dateStr = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (e) {
    const endTimeStr = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dateStr} · ${timeStr} – ${endTimeStr}`;
  }
  return `${dateStr} · ${timeStr}`;
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (tab === "upcoming") params.status = "upcoming";
      else if (tab === "past") params.status = "completed";
      if (search) params.search = search;
      const res = await apiClient.get("/events", { params });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user, tab, search]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleRsvp = async (eventId: string, status: string) => {
    if (rsvpLoading) return;
    setRsvpLoading(eventId);
    try {
      const res = await apiClient.post(`/events/${eventId}/rsvp`, { status });
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const wasGoing = ev.user_rsvp === "going";
          const isNowGoing = status === "going";
          let delta = 0;
          if (!wasGoing && isNowGoing) delta = 1;
          else if (wasGoing && !isNowGoing) delta = -1;
          return {
            ...ev,
            user_rsvp: (ev.user_rsvp === status ? null : status) as EventData["user_rsvp"],
            rsvp_count: ev.rsvp_count + delta,
          };
        })
      );
    } catch (err) {
      console.error("RSVP failed", err);
    } finally {
      setRsvpLoading(null);
    }
  };

  const handleEventCreated = (event: any) => {
    setEvents((prev) => [{ ...event, user_rsvp: null } as EventData, ...prev]);
    setShowCreate(false);
  };

  const displayed = tab === "my_events"
    ? events.filter((e) => e.user_rsvp === "going" || e.user_rsvp === "maybe")
    : events;

  if (!user) return null;

  return (
    <LayoutShell hideRightRail>
      <PageHeader title="Events" />

      <div className="px-6">
        <div className="flex items-center gap-2 pt-3 pb-4 border-b border-border">
          {([
            { key: "upcoming", label: "Upcoming", icon: Calendar },
            { key: "my_events", label: "My Events", icon: Users },
            { key: "past", label: "Past", icon: Clock },
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
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-48 pl-9 pr-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">Search</Button>
            </form>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Event
            </Button>
          </div>
        </div>

        <div className="py-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden animate-pulse">
                  <div className="h-40 bg-border" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-border rounded w-3/4" />
                    <div className="h-4 bg-border rounded w-1/2" />
                    <div className="h-4 bg-border rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="h-10 w-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-secondary">
                {tab === "my_events"
                  ? "You haven't RSVP'd to any events yet."
                  : tab === "past"
                  ? "No past events."
                  : "No upcoming events."}
              </p>
              {tab !== "past" && (
                <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayed.map((event, i) => (
                <div
                  key={event.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
                >
                  <Link
                    href={`/events/${event.id}`}
                    className="block rounded-xl border border-border bg-bg-surface overflow-hidden hover:scale-[1.01] transition-all duration-200 group"
                  >
                    {event.cover_image_url ? (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                          <h3 className="text-base font-black text-white leading-tight line-clamp-2">{event.title}</h3>
                        </div>
                        {event.club && (
                          <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white border border-white/10">
                            {event.club.name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative h-32 bg-gradient-to-br from-accent/20 via-accent/10 to-surface flex items-end p-4">
                        <div>
                          <h3 className="text-base font-black text-text-primary leading-tight">{event.title}</h3>
                          {event.club && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent mt-1 inline-block">
                              {event.club.name}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary mb-2">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-medium">{formatEventDate(event.start_time, event.end_time)}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary mb-3">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="font-medium">{event.location}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
                            <span className="text-[9px] font-bold text-text-inverse select-none">
                              {getInitials(event.organizer?.profile?.display_name || event.organizer?.email || "")}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-text-secondary">
                            {event.organizer?.profile?.display_name || event.organizer?.email?.split("@")[0]}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-text-muted">
                          <Users className="h-3 w-3 inline mr-0.5" />
                          {event.rsvp_count}{event.rsvp_limit ? `/${event.rsvp_limit}` : ""}
                        </span>
                      </div>

                      {event.status !== "past" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          {RSVP_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRsvp(event.id, opt.value);
                              }}
                              disabled={rsvpLoading === event.id}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95",
                                event.user_rsvp === opt.value
                                  ? opt.color
                                  : "border-border text-text-secondary hover:bg-surface"
                              )}
                            >
                              {rsvpLoading === event.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <opt.icon className="h-3 w-3" />
                              )}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateEvent
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onEventCreated={handleEventCreated}
      />
    </LayoutShell>
  );
}
