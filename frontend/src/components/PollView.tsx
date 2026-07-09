"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PollData } from "@/types/post";

/**
 * Poll display + optimistic voting, shared by the feed card and post detail.
 * Mirrors the mobile PollView / the original inline feed-card implementation:
 * tapping an option votes (or unvotes if already selected) via
 * `POST /posts/{id}/poll/vote` and updates bars/percentages optimistically.
 */
export function PollView({ postId, poll: initialPoll }: { postId: string; poll: PollData }) {
  const { user } = useAuth();
  const [poll, setPoll] = useState<PollData>(initialPoll);
  const [voting, setVoting] = useState(false);

  const handleVote = async (optionId: string) => {
    if (!user || voting) return;
    const previousVote = poll.user_vote_option_id ?? null;
    const isSameVote = previousVote === optionId;
    setVoting(true);
    try {
      await apiClient.post(`/posts/${postId}/poll/vote`, { option_id: optionId });
      if (!isSameVote) {
        const newOptions = poll.options.map((opt) => {
          if (opt.id === optionId) return { ...opt, vote_count: opt.vote_count + 1 };
          if (opt.id === previousVote) return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
          return opt;
        });
        setPoll({
          options: newOptions,
          total_votes: previousVote ? poll.total_votes : poll.total_votes + 1,
          user_vote_option_id: optionId,
        });
      } else {
        const newOptions = poll.options.map((opt) =>
          opt.id === optionId ? { ...opt, vote_count: Math.max(0, opt.vote_count - 1) } : opt,
        );
        setPoll({
          options: newOptions,
          total_votes: Math.max(0, poll.total_votes - 1),
          user_vote_option_id: null,
        });
      }
    } catch {
      toast.error("Failed to vote");
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((opt) => {
        const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
        const isSelected = poll.user_vote_option_id === opt.id;
        const hasVoted = poll.user_vote_option_id !== null;
        return (
          <button
            key={opt.id}
            onClick={() => handleVote(opt.id)}
            disabled={voting}
            className={cn(
              "relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-200",
              hasVoted
                ? isSelected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-text-secondary"
                : "border-border bg-surface text-text-primary hover:border-accent/50 hover:bg-accent/5",
              voting && "cursor-not-allowed opacity-60",
            )}
          >
            {hasVoted && (
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-500 ease-out",
                  isSelected ? "bg-accent/15" : "bg-border/50",
                )}
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative flex items-center justify-between">
              <span className="flex items-center gap-2">
                {isSelected && <Check size={14} className="shrink-0 text-accent" />}
                {opt.text}
              </span>
              {hasVoted && (
                <span className={cn("text-xs tabular-nums", isSelected ? "font-semibold text-accent" : "text-text-secondary")}>
                  {pct}%
                </span>
              )}
            </span>
          </button>
        );
      })}
      <p className="pt-0.5 text-[11px] text-text-secondary">
        {poll.total_votes} {poll.total_votes === 1 ? "vote" : "votes"}
      </p>
    </div>
  );
}
