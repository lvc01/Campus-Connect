"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-[53px] z-20 flex h-[52px] items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:top-0">
      <h1 className="text-h2 font-bold text-text-primary">{title}</h1>
      {children}
    </div>
  );
}
