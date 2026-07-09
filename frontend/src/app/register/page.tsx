"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { getApiErrorMessage } from "@/lib/api-error";

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "A number" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!displayName.trim()) newErrors.displayName = "Name is required.";
    if (!email) {
      newErrors.email = "Email is required.";
    } else {
      const allowedDomains = ["cuchd.in"];
      const emailDomain = email.split("@")[1]?.toLowerCase();
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        newErrors.email = "Must use a Chandigarh University (@cuchd.in) email address.";
      }
    }
    if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    } else {
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      if (!hasUppercase || !hasLowercase || !hasNumber) {
        newErrors.password = "Must contain uppercase, lowercase, and a number.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setErrors({});
    try {
      const res = await register({
        display_name: displayName,
        email: email.toLowerCase().trim(),
        password,
      });
      if (res.dev_otp) sessionStorage.setItem("cc_dev_otp", res.dev_otp);
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Registration failed. Please try again.") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        title="Create your account."
        subtitle={<>Join verified Chandigarh University campus circles.</>}
        error={errors.form}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Full name"
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="e.g. Sipho Nkosi"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            required
          />

          <Input
            label="University email"
            id="email"
            type="email"
            autoComplete="username"
            placeholder="student@cuchd.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
            helperText="Restricted to Chandigarh University (@cuchd.in) email addresses."
          />

          <div>
            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
            />
            {/* Live password-rule checklist */}
            <ul className="mt-3 space-y-1">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-2 font-sans text-caption transition-colors ${
                      met ? "text-success" : "text-text-tertiary"
                    }`}
                  >
                    <span
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${
                        met ? "border-success bg-success/15" : "border-border-strong"
                      }`}
                    >
                      {met && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-success" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="2,6.5 4.5,9 10,3.5" />
                        </svg>
                      )}
                    </span>
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2 py-3">
            Create account
          </Button>
        </form>

        <p className="mt-8 text-center font-sans text-body-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
