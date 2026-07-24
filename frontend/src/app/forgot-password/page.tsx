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
    <AuthShell>
      <AuthCard
        title="Reset your password."
        subtitle={"Enter your email and we'll send you a reset code."}
        error={errors.form}
      >
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

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2 py-3">
            Send reset code
          </Button>
        </form>

        <p className="mt-8 text-center font-sans text-body-sm text-text-secondary">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Log in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
