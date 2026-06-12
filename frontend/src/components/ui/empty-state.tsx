import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-full bg-accent-light text-accent",
            compact ? "w-12 h-12" : "w-16 h-16",
          )}
        >
          <span
            className={cn(compact ? "w-6 h-6" : "w-8 h-8", "inline-flex items-center justify-center")}
          >
            {icon}
          </span>
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary leading-snug">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-text-secondary leading-relaxed max-w-[360px]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
