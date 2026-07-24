/**
 * Shared types for sponsored ads.
 *
 * Single source of truth for ad-related shapes — the home feed widget,
 * the AdCard component, and any future ad surface imports from here.
 */

export interface ActiveAdData {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
  boosted_post_id: string | null;
}
