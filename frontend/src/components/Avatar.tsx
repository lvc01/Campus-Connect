import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

const COLORS = [
  "37 99 235", "236 72 153", "22 163 74", "234 179 8", "168 85 247", "249 115 22",
];

interface AvatarUser {
  id?: string;
  name?: string;
  email?: string;
  display_name?: string;
  profile?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

function getUserName(user: AvatarUser): string {
  return user.name || user.display_name || user.profile?.display_name || user.email || "User";
}

function getUserColor(user: AvatarUser): string {
  const id = user.id || user.email || "default";
  return COLORS[Math.abs(hashCode(id)) % COLORS.length];
}

export function Avatar({
  user,
  size = 40,
  className,
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  const name = getUserName(user);
  const color = getUserColor(user);
  const avatarUrl = user.profile?.avatar_url;
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden select-none",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={name}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: `rgb(${color})`,
      }}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  );
}
