export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  faculty: string | null;
  year_of_study: number | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: "student" | "moderator" | "admin" | "university_staff";
  is_verified: boolean;
  is_active: boolean;
  post_count: number;
  social_links: string[] | null;
  created_at: string;
  profile?: {
    id?: string;
    display_name: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
    faculty: string | null;
    year_of_study: number | null;
    social_links: Record<string, string> | null;
  } | null;
}

export interface UserProfile extends User {
  profile: {
    display_name: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
    faculty: string | null;
    year_of_study: number | null;
    social_links: Record<string, string> | null;
  } | null;
}

export interface AuthResponse {
  user: User;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PollOption {
  id: string;
  text: string;
  position: number;
  vote_count: number;
}

export interface PollData {
  options: PollOption[];
  total_votes: number;
  user_vote_option_id: string | null;
}

export interface Post {
  id: string;
  content: string;
  media: { url: string; type: string }[] | null;
  author: User;
  faculty_only: boolean;
  visibility: string;
  tags: string[] | null;
  mentioned_users: string[] | null;
  club_id: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_liked: boolean;
  is_reposted: boolean;
  is_saved?: boolean;
  edited_at?: string | null;
  created_at: string;
  // Poll data — only populated for poll posts (mirrors backend PollData).
  poll?: PollData | null;
}

export interface Comment {
  id: string;
  content: string;
  author: User;
  post_id: string;
  parent_id: string | null;
  created_at: string;
  edited_at?: string | null;
  replies?: Comment[];
}

export interface Conversation {
  id: string;
  members: ConversationMember[];
  last_message: string | null;
  last_sender_id: string | null;
  unread_count: number;
  is_muted: boolean;
  updated_at: string;
}

export interface ConversationMember {
  user: {
    id: string;
    email?: string;
    role?: string;
    is_verified?: boolean;
    profile?: {
      display_name: string;
      avatar_url: string | null;
    } | null;
  };
  role: string;
  last_read_at: string | null;
  is_muted: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: {
    id: string;
    email?: string;
    role?: string;
    is_verified?: boolean;
    profile?: {
      display_name: string;
      avatar_url: string | null;
    } | null;
  };
  content: string;
  message_type: "text" | "image" | "file";
  file_url: string | null;
  reply_to: {
    id: string;
    sender: {
      profile?: { display_name: string } | null;
    };
    content: string | null;
    message_type: string;
  } | null;
  is_edited: boolean;
  edited_at: string | null;
  reactions: { id: string; user_id: string; emoji: string }[];
  created_at: string;
}

export interface RSVPUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export interface EventAttendees {
  going: RSVPUser[];
  maybe: RSVPUser[];
  not_going: RSVPUser[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  organizer: User;
  rsvp_count: number;
  rsvp_limit: number | null;
  user_rsvp: "going" | "maybe" | "not_going" | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  is_saved?: boolean;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string | null;
  category: string;
  location: string | null;
  images: { url: string; media_type: string }[] | null;
  seller: User;
  is_saved: boolean;
  created_at: string;
  view_count?: number;
  avg_rating?: number;
  rating_count?: number;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  member_count: number;
  is_member: boolean;
  is_pending: boolean;
  is_verified: boolean;
  is_premium: boolean;
  is_approved: boolean;
  requires_approval: boolean;
  avatar_url: string | null;
  banner_url: string | null;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  member_role?: string | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  faculty: string;
  description: string;
  year: number | null;
  semester: number | null;
  member_count: number;
  resource_count: number;
  is_member: boolean;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "repost" | "follow" | "mention" | "event" | "dm" | "event_reminder" | "club_announcement" | "report_resolved" | "report_new" | "system";
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  actor: User | null;
  created_at: string;
}

export interface Ad {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
  boosted_post_id: string | null;
  impression_count: number;
  click_count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface Report {
  id: string;
  target_type: string;
  target_id: string;
  category: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  reporter: User;
  created_at: string;
  content_preview?: string;
  notes?: string;
}

export interface SearchResults {
  users: User[];
  posts: Post[];
  clubs: Club[];
  events: Event[];
  listings: Listing[];
}
