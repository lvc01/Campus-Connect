import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-pop-in">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface text-text-secondary">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-h3 font-bold text-text-primary">{title}</h3>
      <p className="mt-1 text-body-sm text-text-secondary max-w-xs">{description}</p>
    </div>
  );
}
