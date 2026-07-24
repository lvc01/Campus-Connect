import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api-client";
import { useTheme } from "../lib/theme-context";
import { spacing, fontSize, borderRadius } from "../lib/theme";
import { useToast } from "./Toast";
import type { PollData } from "../types";

interface PollViewProps {
  postId: string;
  poll: PollData;
}

/**
 * Poll display + voting. Mirrors the web PostCard poll behavior:
 * optimistic local vote updates with rollback on failure, percentage
 * bars shown only after the user has voted. Calls POST /posts/{id}/poll/vote.
 */
export function PollView({ postId, poll }: PollViewProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [localPoll, setLocalPoll] = useState<PollData>(poll);
  const [votingId, setVotingId] = useState<string | null>(null);

  const hasVoted = localPoll.user_vote_option_id !== null;

  const handleVote = async (optionId: string) => {
    if (votingId) return;
    const previous = localPoll;
    setVotingId(optionId);

    const isSameOption = optionId === localPoll.user_vote_option_id;
    const isChangingVote = localPoll.user_vote_option_id !== null && !isSameOption;
    const optimistic: PollData = {
      options: localPoll.options.map((opt) => {
        if (isSameOption && opt.id === optionId)
          return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
        if (!isSameOption && opt.id === optionId)
          return { ...opt, vote_count: opt.vote_count + 1 };
        if (isChangingVote && opt.id === localPoll.user_vote_option_id)
          return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
        return opt;
      }),
      total_votes: isSameOption
        ? Math.max(0, localPoll.total_votes - 1)
        : isChangingVote
          ? localPoll.total_votes
          : localPoll.total_votes + 1,
      user_vote_option_id: isSameOption ? null : optionId,
    };
    setLocalPoll(optimistic);

    try {
      await api.post(`/posts/${postId}/poll/vote`, { option_id: optionId });
    } catch {
      // Roll back on failure.
      setLocalPoll(previous);
      toast("Failed to register vote", "error");
    } finally {
      setVotingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {localPoll.options.map((opt) => {
        const pct = localPoll.total_votes > 0 ? Math.round((opt.vote_count / localPoll.total_votes) * 100) : 0;
        const isSelected = localPoll.user_vote_option_id === opt.id;
        const isVoting = votingId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.option,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.accentLight : colors.muted,
              },
            ]}
            onPress={() => handleVote(opt.id)}
            disabled={votingId !== null}
            activeOpacity={0.7}
          >
            {hasVoted && (
              <View
                style={[
                  styles.fillBar,
                  { backgroundColor: isSelected ? colors.primary : colors.border, width: `${pct}%` },
                ]}
              />
            )}
            <View style={styles.optionContent}>
              <View style={styles.optionLabel}>
                {isVoting ? (
                  <ActivityIndicator size="small" color={isSelected ? colors.primary : colors.textSecondary} />
                ) : (
                  isSelected && <Ionicons name="checkmark" size={16} color={colors.primary} />
                )}
                <Text
                  style={[
                    styles.optionText,
                    { color: isSelected ? colors.primary : colors.textPrimary },
                  ]}
                >
                  {opt.text}
                </Text>
              </View>
              {hasVoted && (
                <Text
                  style={[
                    styles.optionPct,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {pct}%
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.total, { color: colors.textSecondary }]}>
        {localPoll.total_votes} {localPoll.total_votes === 1 ? "vote" : "votes"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  option: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
  },
  fillBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.15,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  optionText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    flexShrink: 1,
  },
  optionPct: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  total: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
