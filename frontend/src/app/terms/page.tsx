"use client";

import { BackLink } from "@/components/layout/BackLink";

export default function TermsPage() {
  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="text-2xl font-black text-text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-text-tertiary mb-8">Last updated: June 2026</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">1. Acceptance of Terms</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              By accessing CU Campus Connect, you agree to these terms. This platform is exclusively
              for verified Chandigarh University students and staff.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">2. Eligibility</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              You must have a valid @cuchd.in email address to register. Accounts are non-transferable.
              Impersonation or misuse of the platform may result in account termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">3. User Conduct</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              You agree not to post content that is harmful, illegal, harassing, or violates
              university policies. You are responsible for all content you share on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">4. Content Ownership</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              You retain ownership of content you post. By posting, you grant CU Campus Connect
              a non-exclusive license to display and distribute your content within the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">5. Marketplace</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              The marketplace is a peer-to-peer listing service. CU Campus Connect is not a party
              to any transaction between buyers and sellers. Users are responsible for verifying
              listings before purchasing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">6. Account Termination</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these terms.
              You may delete your account at any time through the settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">7. Limitation of Liability</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              CU Campus Connect is provided &ldquo;as is&rdquo; without warranties. We are not liable
              for any damages arising from use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">8. Changes to Terms</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We may update these terms from time to time. Continued use of the platform after
              changes constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
