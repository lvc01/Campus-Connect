/**
 * Shared types for posts, feeds, and related entities.
 *
 * Single source of truth — the home feed, profile page, saved page, search
 * page, club page, and any future surface that renders posts imports from here.
 */

export interface UserProfile {
  display_name: string;
  faculty: string | null;
  year_of_study: number | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio?: string | null;
  social_links?: Record<string, string> | null;
}

export interface PostAuthor {
  id: string;
  email: string;
  role: string;
  profile: UserProfile | null;
}

export interface MediaAttachment {
  id: string;
  url: string;
  media_type: string;
}

export interface PollOptionData {
  id: string;
  text: string;
  position: number;
  vote_count: number;
}

export interface PollData {
  options: PollOptionData[];
  total_votes: number;
  user_vote_option_id: string | null;
}

export type PostVisibility = "public" | "faculty_only" | "club_only";

export interface PostData {
  id: string;
  author_id: string;
  content: string | null;
  post_type: string;
  visibility: PostVisibility;
  tags: string[] | null;
  is_promoted: boolean;
  is_pinned: boolean;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
  updated_at: string;
  media: MediaAttachment[];
  is_liked: boolean;
  is_saved: boolean;
  is_shared: boolean;
  author: PostAuthor;
  poll: PollData | null;
}

export interface FeedPage {
  items: PostData[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface FeedQuery {
  cursor?: string | null;
  faculty_only?: boolean;
  limit?: number;
}

export interface EventData {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  rsvp_count: number;
  rsvp_limit: number | null;
  status: string;
}

export interface ActiveAdData {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
  boosted_post_id: string | null;
}
