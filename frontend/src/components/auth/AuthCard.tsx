"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  logo?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Editorial auth card — logo block + display headline + optional subtitle
 * + form children. Replaces the duplicated inline headers across auth screens.
 *
 * Stagger classes compose with AuthShell — first paint reveals progressively.
 */
export function AuthCard({ logo, title, subtitle, error, children, className }: AuthCardProps) {
  return (
    <div className={cn("reveal-up stagger-1", className)}>
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-accent shadow-md shadow-accent/20">
          {logo ?? (
            <Image
              src="/logo-white.png"
              alt="Campus Connect"
              width={40}
              height={40}
              priority
              className="object-contain"
            />
          )}
        </div>
        <h1 className="font-display text-h1 font-medium text-text-primary leading-tight -tracking-[0.012em]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 font-sans text-body-sm text-text-secondary leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 -ml-1 border-l-2 border-error bg-error/8 px-4 py-3 rounded-r-md"
        >
          <p className="font-sans text-body-sm font-medium text-error">{error}</p>
        </div>
      )}

      {children}
    </div>
  );
}
