"use client";

import React, { useEffect, useState } from "react";

const QUOTES = [
  {
    text: "Your university, your story, your circle.",
    attribution: "Campus Connect",
  },
  {
    text: "Verified email in. The whole campus unlocked.",
    attribution: "Built for @cuchd.in",
  },
  {
    text: "Clubs, courses, chat, events — one verified network.",
    attribution: "Chandigarh University",
  },
];

/**
 * Editorial chrome shared by all auth pages.
 *
 * Two-column composition on lg+:
 *   - Left: wordmark + rotating editorial quote (warm dark panel)
 *   - Right: a centered 448px form container (children)
 *
 * On mobile, only the form column renders — chrome drops.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 12000);
    return () => window.clearInterval(id);
  }, []);

  const quote = QUOTES[quoteIndex];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left — editorial wordmark panel (lg+ only) */}
      <aside className="hidden lg:flex lg:flex-col lg:justify-between bg-accent text-accent-foreground p-16 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 20%, rgb(255 255 255 / 0.6) 0%, transparent 55%), radial-gradient(circle at 75% 80%, rgb(255 255 255 / 0.4) 0%, transparent 50%)",
          }}
        />
        <div className="relative">
          <h2 className="font-display text-h1 font-medium leading-tight">
            CU Campus<br />Connect
          </h2>
        </div>

        <div className="relative">
          <React.Suspense fallback={null}>
            <div key={quoteIndex} className="reveal-up">
              <p className="font-display text-h2 font-medium leading-snug max-w-md">
                {quote.text}
              </p>
              <p className="mt-3 text-overline uppercase tracking-[0.18em] opacity-70">
                {quote.attribution}
              </p>
            </div>
          </React.Suspense>
        </div>

        <div className="relative text-caption opacity-60">
          © 2026 Chandigarh University · A verified network
        </div>
      </aside>

      {/* Right — form container */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md reveal-up">{children}</div>
      </main>
    </div>
  );
}
