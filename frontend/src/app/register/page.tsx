"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

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
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-bg-main">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-text-inverse mb-6 shadow-lg shadow-accent/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-main">Create your account</h1>
          <p className="mt-2 text-sm text-text-muted">Join verified Chandigarh University campus circles</p>
        </div>

        {errors.form && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-sm font-semibold text-error text-center">{errors.form}</div>
        )}

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
            helperText="We restrict registrations to Chandigarh University (cuchd.in) email addresses."
          />

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
            helperText="Minimum 8 characters with at least one uppercase, lowercase and digit."
          />

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
            Create account
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
