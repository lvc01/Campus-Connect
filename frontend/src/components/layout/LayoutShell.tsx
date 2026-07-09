"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { LeftRail } from "./LeftRail";
import { RightRail } from "./RightRail";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { ComposeDialog } from "./ComposeDialog";
import { SearchOverlay } from "./SearchOverlay";

export function LayoutShell({ children, hideRightRail }: { children: ReactNode; hideRightRail?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent overflow-hidden">
            <Image
              src="/logo-white.png"
              alt="Campus Connect"
              width={56}
              height={56}
              className="object-contain"
            />
          </span>
          <h1 className="text-h1 font-bold text-text-primary">Campus Connect</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            The social platform for your university campus.
          </p>
          <a
            href="/login"
            className="mt-6 block w-full rounded-full bg-accent py-2.5 text-body font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Log in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileTopBar />
      <div className={`mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-5 px-0 md:px-4 lg:w-fit lg:px-6 ${hideRightRail ? 'md:grid-cols-[60px_1fr] lg:grid-cols-[60px_890px] xl:grid-cols-[240px_940px]' : 'md:grid-cols-[60px_1fr] lg:grid-cols-[60px_580px_290px] xl:grid-cols-[240px_580px_340px]'}`}>
        <LeftRail />
        <main className="min-h-screen w-full border-x border-border pb-24 md:pb-20 lg:pb-0">
          {children}
        </main>
        {!hideRightRail && <RightRail />}
      </div>
      <MobileBottomNav />
      <ComposeDialog />
      <SearchOverlay />
    </div>
  );
}
