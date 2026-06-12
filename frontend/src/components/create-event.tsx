"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";

interface Club {
  id: string;
  name: string;
  is_member: boolean;
  member_role: string | null;
}

export interface CreateEventPayload {
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  rsvp_limit: number | null;
  club_id: string | null;
}

interface CreatedEvent extends CreateEventPayload {
  id: string;
  status: string;
  organizer_id: string;
  organizer: { id: string; profile: { display_name: string } | null } | null;
  club: { id: string; name: string } | null;
  rsvp_count: number;
  user_rsvp: string | null;
  created_at: string;
}

interface CreateEventProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: CreatedEvent) => void;
}

export const CreateEvent: React.FC<CreateEventProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [rsvpLimit, setRsvpLimit] = useState<number | "">("");
  const [hasRsvpLimit, setHasRsvpLimit] = useState(false);
  const [clubId, setClubId] = useState("");
  
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch societies user can host as
  useEffect(() => {
    if (!isOpen) return;

    const fetchMyClubs = async () => {
      try {
        const response = await apiClient.get<Club[]>("/clubs");
        const adminClubs = response.data.filter(
          (c) =>
            c.is_member &&
            (c.member_role === "owner" || c.member_role === "admin")
        );
        setMyClubs(adminClubs);
      } catch (err) {
        console.error("Failed to load clubs", err);
      }
    };

    fetchMyClubs();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) return;

    setIsLoading(true);
    setError("");

    try {
      const payload: CreateEventPayload = {
        title: title.trim(),
        description: description.trim() || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        location: location.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        rsvp_limit: hasRsvpLimit && typeof rsvpLimit === "number" ? rsvpLimit : null,
        club_id: clubId || null,
      };

      const response = await apiClient.post<CreatedEvent>("/events", payload);
      onEventCreated(response.data);

      // Reset form
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime("");
      setEndTime("");
      setCoverImageUrl("");
      setRsvpLimit("");
      setHasRsvpLimit(false);
      setClubId("");
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Failed to create event. Please verify all fields.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-bg-surface border border-border rounded-3xl p-6 sm:p-8 animate-pop-in relative border border-border bg-bg-main shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl text-text-muted hover:text-accent hover:bg-[rgba(var(--bg-hover),0.08)] focus:outline-none transition-colors"
          aria-label="Close modal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-text-main">Create Campus Event</h2>
          <p className="text-text-muted text-xs mt-1.5 font-medium">
            Publish an upcoming workshop, tournament, social gathering, or talk.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs font-semibold text-red-400 text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Host Context Option */}
          {myClubs.length > 0 && (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="event-host"
                className="text-sm font-semibold text-text-main"
              >
                Host as
              </label>
              <select
                id="event-host"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm transition-all duration-200 outline-none cursor-pointer"
              >
                <option value="">Independent Student (Personal Event)</option>
                {myClubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} (Official Club Event)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Event Title */}
          <Input
            label="Event Title"
            id="event-title"
            placeholder="e.g. Annual Campus Hackathon 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
          />

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="start-time" className="text-sm font-semibold text-text-main">
                Start Time *
              </label>
              <input
                type="datetime-local"
                id="start-time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm transition-all duration-200 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="end-time" className="text-sm font-semibold text-text-main">
                End Time (Optional)
              </label>
              <input
                type="datetime-local"
                id="end-time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm transition-all duration-200 outline-none"
              />
            </div>
          </div>

          {/* Location */}
          <Input
            label="Location"
            id="event-location"
            placeholder="e.g. Leslie Social Hall, Sports Center, Online"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={300}
          />

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="event-description"
              className="text-sm font-semibold text-text-main"
            >
              Description
            </label>
            <textarea
              id="event-description"
              placeholder="Detail what attendees should expect, prerequisites, schedules, guest speakers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[100px] p-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm placeholder:text-text-muted transition-all duration-200 outline-none resize-none"
              maxLength={5000}
            />
          </div>

          {/* Cover Image URL */}
          <Input
            label="Cover Image URL (Optional)"
            id="event-cover"
            placeholder="e.g. https://images.unsplash.com/photo-..."
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            type="url"
            maxLength={500}
          />

          {/* RSVP and Capacity Limit */}
          <div className="p-4 rounded-2xl bg-bg-surface/50 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-text-main">Limit Attendance Capacity</span>
                <p className="text-text-muted text-xs mt-0.5">
                  Cap RSVPs to avoid overbooking small rooms.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasRsvpLimit}
                  onChange={(e) => {
                    setHasRsvpLimit(e.target.checked);
                    if (!e.target.checked) setRsvpLimit("");
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-accent/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
              </label>
            </div>

            {hasRsvpLimit && (
              <div className="animate-fade-in">
                <Input
                  label="RSVP Capacity Limit"
                  id="event-rsvp-limit"
                  placeholder="e.g. 50"
                  type="number"
                  min="1"
                  value={rsvpLimit}
                  onChange={(e) => setRsvpLimit(e.target.value ? parseInt(e.target.value) : "")}
                  required
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!title.trim() || !startTime}
            >
              Publish Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
