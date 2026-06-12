"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = "Email is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const res = await forgotPassword(email.toLowerCase().trim());
      if (res.dev_otp) sessionStorage.setItem("cc_dev_otp", res.dev_otp);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Something went wrong. Please try again.") });
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
              <rect width="18" height="11" x="3" y="7" rx="2" ry="2" />
              <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" strokeWidth="2.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-main">Reset your password</h1>
          <p className="mt-2 text-sm text-text-muted">Enter your email and we&apos;ll send you a reset code</p>
        </div>

        {errors.form && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-sm font-semibold text-error text-center">{errors.form}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
          />

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
            Send reset code
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-muted">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
