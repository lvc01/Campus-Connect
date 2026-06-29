"use client";

import { BackLink } from "@/components/layout/BackLink";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I reset my password?",
    a: "On the login screen, tap “Forgot password?” and enter your university email. We'll send a reset code. You can also change your password anytime from Settings → Account → Change Password.",
  },
  {
    q: "Who can see my posts?",
    a: "Public posts are visible to everyone on Campus Connect. Faculty-only posts are limited to your faculty. When you post to a club as a members-only announcement, only club members see it.",
  },
  {
    q: "How does the marketplace work?",
    a: "Listings are peer-to-peer between students. Message a seller from their listing to arrange a deal. Always meet in a safe campus location and verify the item before paying.",
  },
  {
    q: "How do I report something?",
    a: "Use the report option on any post, comment, message, listing, club, or profile. Our moderators review every report. See the Community Guidelines for what's allowed.",
  },
  {
    q: "How do I block someone?",
    a: "Open their profile and tap “Block User”. You can manage blocked users from Settings → Privacy → Blocked Users.",
  },
  {
    q: "Still need help?",
    a: "Email our team at support@campusconnect.app and we'll get back to you.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="text-2xl font-black text-text-primary mb-2">Help Center</h1>
        <p className="text-sm text-text-muted mb-8">Answers to common questions.</p>

        <div className="space-y-6">
          {FAQS.map((f) => (
            <section key={f.q}>
              <h2 className="text-lg font-bold text-text-primary mb-2">{f.q}</h2>
              <p className="text-sm text-text-secondary leading-relaxed">{f.a}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
