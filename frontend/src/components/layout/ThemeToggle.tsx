"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-all duration-200 hover:bg-surface hover:text-text-primary active:scale-90",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 transition-transform duration-300 rotate-0 dark:rotate-180" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-300" />
      )}
    </button>
  );
}
