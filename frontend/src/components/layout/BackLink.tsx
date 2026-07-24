import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard "back" affordance for sub-pages (detail, settings, legal, etc.).
 * Replaces the ~13 copy-pasted ChevronLeft+label snippets so every back
 * link looks and behaves identically.
 */
export function BackLink({
  href,
  label = "Back",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-6 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary",
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </Link>
  );
}
