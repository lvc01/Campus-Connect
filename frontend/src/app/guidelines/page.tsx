"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const GUIDELINES: { title: string; body: string }[] = [
  {
    title: "1. Be kind and respectful",
    body: "Treat everyone the way you would in a lecture hall. Harassment, bullying, hate speech, and personal attacks have no place on Campus Connect and will be removed.",
  },
  {
    title: "2. Keep it authentic",
    body: "Use your real identity. Impersonating other students, staff, clubs, or the university is not allowed. Don't spread misinformation or run scams.",
  },
  {
    title: "3. Post relevant content",
    body: "Campus Connect is for campus life — events, clubs, academics, the marketplace, and community. Spam, mass self-promotion, and off-topic flooding are not welcome.",
  },
  {
    title: "4. Respect privacy",
    body: "Don't share someone else's personal information, private messages, or images without their consent.",
  },
  {
    title: "5. Trade safely",
    body: "Marketplace listings must be genuine. Meet in safe, public campus locations and verify items before paying. Prohibited or illegal goods will be removed.",
  },
  {
    title: "6. Report, don't retaliate",
    body: "If you see something that breaks these guidelines, use the report option. Our moderators review every report. Don't take matters into your own hands.",
  },
];

export default function GuidelinesPage() {
  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          Back to Settings
        </Link>

        <h1 className="text-2xl font-black text-text-primary mb-2">Community Guidelines</h1>
        <p className="text-sm text-text-muted mb-8">Be kind, be respectful, be campus-spirited.</p>

        <div className="space-y-6">
          {GUIDELINES.map((g) => (
            <section key={g.title}>
              <h2 className="text-lg font-bold text-text-primary mb-2">{g.title}</h2>
              <p className="text-sm text-text-secondary leading-relaxed">{g.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
