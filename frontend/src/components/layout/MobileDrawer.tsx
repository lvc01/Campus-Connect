"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shield, X } from "lucide-react";
import { useEffect } from "react";
import { navItems } from "./nav-config";
import { useAuth } from "@/context/auth-context";
import { openSearch } from "@/lib/compose-events";
import { ThemeToggle } from "./ThemeToggle";
import { UserChip } from "./UserChip";
import { cn } from "@/lib/utils";

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/40 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-[280px] flex-col gap-1 bg-background p-4 shadow-lg transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent overflow-hidden">
              <Image
                src="/logo-white.png"
                alt="Campus Connect"
                width={36}
                height={36}
                className="object-contain"
              />
            </span>
            <span className="text-h3 font-bold text-text-primary">
              Campus Connect
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const classes = cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-body transition-colors",
              !item.isSearch && isActive(item.to)
                ? "font-bold text-text-primary"
                : "text-text-secondary hover:bg-surface hover:text-text-primary",
            );
            if (item.isSearch) {
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    onClose();
                    openSearch();
                  }}
                  className={cn(classes, "text-left")}
                >
                  <item.icon className="h-[22px] w-[22px]" />
                  {item.label}
                </button>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.to}
                onClick={onClose}
                className={classes}
              >
                <item.icon className="h-[22px] w-[22px]" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-body transition-colors",
                isActive("/admin")
                  ? "font-bold text-text-primary"
                  : "text-text-secondary hover:bg-surface hover:text-text-primary",
              )}
            >
              <Shield className="h-[22px] w-[22px]" />
              Admin
            </Link>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-body-sm text-text-secondary">Theme</span>
          </div>
          <UserChip />
        </div>
      </div>
    </div>
  );
}
