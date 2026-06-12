export interface EventData {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  cover_image_url: string | null;
  rsvp_limit: number | null;
  rsvp_count: number;
  status: string;
  organizer_id: string;
  club_id: string | null;
  created_at: string;
  updated_at: string;
  organizer: {
    id: string;
    email: string;
    profile: { display_name: string; avatar_url: string | null } | null;
  };
  club: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  user_rsvp: "going" | "maybe" | "not_going" | null;
}
