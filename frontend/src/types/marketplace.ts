export interface ListingData {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  condition: string | null;
  location: string | null;
  status: string;
  view_count: number;
  created_at: string;
  avg_rating: number;
  rating_count: number;
  is_saved: boolean;
  seller: {
    id: string;
    email: string;
    profile: { display_name: string; avatar_url: string | null } | null;
  };
  images: { id?: string; url: string; order?: number }[];
}
