import { BadgeCheck, Shield, ShieldCheck, GraduationCap, BookOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline role indicator shown next to an author's name.
 *
 * Mirrors the mobile app's role icons (`mobile/components/PostCard.tsx`):
 *   admin · moderator · university_staff · student
 * Colors are theme-agnostic Tailwind palette classes (readable in light + dark),
 * matching the mobile semantics rather than the drifted per-screen hex values.
 */
const ROLE_CONFIG: Record<string, { icon: LucideIcon; className: string; label: string }> = {
  admin: { icon: BadgeCheck, className: "text-sky-500", label: "Admin" },
  moderator: { icon: Shield, className: "text-violet-500", label: "Moderator" },
  club_admin: { icon: ShieldCheck, className: "text-emerald-500", label: "Club Admin" },
  university_staff: { icon: GraduationCap, className: "text-amber-500", label: "Staff" },
  student: { icon: BookOpen, className: "text-text-secondary", label: "Student" },
};

interface RoleBadgeProps {
  role: string | null | undefined;
  /** Icon size in px. Defaults to 14 to sit inline with body-sm text. */
  size?: number;
  /** Hide the student badge (it is the default role and often noise). */
  hideStudent?: boolean;
  className?: string;
}

export function RoleBadge({ role, size = 14, hideStudent = false, className }: RoleBadgeProps) {
  if (!role) return null;
  if (role === "student" && hideStudent) return null;
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Icon
      size={size}
      className={cn(config.className, "shrink-0", className)}
      aria-label={config.label}
    />
  );
}
