/**
 * Shared types for users, profiles, and related entities.
 *
 * Single source of truth — profile page, settings page, mention picker,
 * post card authors, etc. all import from here.
 */

import type { PostData } from "./post";

export interface UserProfileData {
  id: string;
  display_name: string;
  faculty: string | null;
  year_of_study: number | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  social_links: Record<string, string> | null;
  created_at: string;
}

export interface UserData {
  id: string;
  email: string;
  username?: string | null;
  role: string;
  is_verified: boolean;
  profile: UserProfileData | null;
  created_at: string;
}

export interface PublicProfileData extends UserData {
  posts_count: number;
  clubs_count: number;
  listings_count: number;
  events_count: number;
}

export interface PublicProfileResponse {
  profile: PublicProfileData;
  posts: PostData[];
  next_cursor: string | null;
  has_more: boolean;
}
