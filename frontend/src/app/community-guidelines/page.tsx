"use client";

import { BackLink } from "@/components/layout/BackLink";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Be respectful",
    body: "Treat everyone with respect. Harassment, hate speech, bullying, or targeting people based on identity has no place on Campus Connect.",
  },
  {
    title: "2. Keep it authentic",
    body: "Use your real campus identity. Impersonation, fake accounts, and coordinated inauthentic behavior are not allowed.",
  },
  {
    title: "3. No spam or scams",
    body: "Don't post repetitive content, misleading links, or fraudulent marketplace listings. Selling prohibited or illegal items is banned.",
  },
  {
    title: "4. Safe content only",
    body: "No sexually explicit material, graphic violence, or content that promotes self-harm. Keep posts appropriate for a university community.",
  },
  {
    title: "5. Protect privacy",
    body: "Don't share someone else's private information — phone numbers, addresses, schedules, or photos — without their consent.",
  },
  {
    title: "6. Report, don't retaliate",
    body: "If you see something that breaks these rules, use the report option on the post, profile, listing, or message. Moderators review every report.",
  },
  {
    title: "7. Consequences",
    body: "Violations may result in content removal, temporary suspension, or permanent loss of access. You can appeal moderation decisions from the affected content.",
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary">
      <div className="w-full max-w-2xl mx-auto px-4 py-6">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="text-2xl font-black text-text-primary mb-2">Community Guidelines</h1>
        <p className="text-sm text-text-tertiary mb-8">Be kind, be respectful, be campus-spirited.</p>

        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold text-text-primary mb-2">{s.title}</h2>
              <p className="text-sm text-text-secondary leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
