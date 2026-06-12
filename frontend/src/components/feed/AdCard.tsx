import { Megaphone } from "lucide-react";

interface AdCardProps {
  sponsor: string;
  headline: string;
  cta?: string;
}

export function AdCard({ sponsor, headline, cta = "Learn more" }: AdCardProps) {
  return (
    <div className="border-b border-border bg-surface/50 px-4 py-3">
      <div className="flex items-center gap-2 text-overline text-text-secondary">
        <Megaphone className="h-3 w-3" />
        <span>Sponsored</span>
      </div>
      <p className="mt-1 text-body-sm font-semibold text-text-primary">{headline}</p>
      <p className="text-caption text-text-secondary">{sponsor}</p>
      <button className="mt-2 rounded-full border border-border bg-background px-4 py-1 text-caption font-semibold text-text-primary transition-colors hover:bg-surface">
        {cta}
      </button>
    </div>
  );
}
