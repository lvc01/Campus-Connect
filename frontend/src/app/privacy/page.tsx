"use client";

import { BackLink } from "@/components/layout/BackLink";

export default function PrivacyPage() {
  return (
    <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="text-2xl font-black text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: June 2026</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">1. Information We Collect</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              When you register for CU Campus Connect, we collect your university email address,
              display name, faculty, and year of study. We also collect content you post,
              messages you send, and usage data to improve the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">2. How We Use Your Information</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We use your information to provide and improve the platform, verify your university
              affiliation, personalize your experience, and communicate important updates about
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">3. Data Sharing</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We do not sell your personal data to third parties. We may share anonymized,
              aggregated data for research purposes. Your profile information is visible to
              other verified university students.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">4. Data Security</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We implement industry-standard security measures including encrypted data transmission,
              secure authentication, and regular security audits. However, no method of
              transmission is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">5. Your Rights</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              You can access, update, or delete your account at any time through the settings page.
              To request a full data export, contact the platform administrators.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">6. Cookies</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We use httpOnly cookies for authentication and security. These cookies are essential
              for the platform to function and are not used for tracking purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text-primary mb-2">7. Contact</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              For questions about this privacy policy, contact the platform administrators
              through the university IT department.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
