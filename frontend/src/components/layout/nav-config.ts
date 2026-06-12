import {
  Home,
  Search,
  Bell,
  Mail,
  Users,
  Calendar,
  GraduationCap,
  ShoppingBag,
  Bookmark,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  isSearch?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Explore", to: "/", icon: Search, isSearch: true },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Messages", to: "/messages", icon: Mail },
  { label: "Clubs", to: "/clubs", icon: Users },
  { label: "Events", to: "/events", icon: Calendar },
  { label: "Marketplace", to: "/marketplace", icon: ShoppingBag },
  { label: "Academics", to: "/academics", icon: GraduationCap },
  { label: "Saved", to: "/saved", icon: Bookmark },
  { label: "Moderation", to: "/moderation", icon: Shield },
];

export const mobileNavItems: NavItem[] = [
  { label: "Home", to: "/", icon: Home },
  { label: "Explore", to: "/", icon: Search, isSearch: true },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Messages", to: "/messages", icon: Mail },
];
