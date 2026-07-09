"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { getApiErrorMessage } from "@/lib/api-error";

function ResetPasswordContent() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [devOtp] = useState(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("cc_dev_otp") : null;
    if (stored) sessionStorage.removeItem("cc_dev_otp");
    return stored;
  });

  useEffect(() => {
    if (!email) router.push("/forgot-password");
  }, [email, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!code || !/^\d{6}$/.test(code)) {
      newErrors.code = "Must be a 6-digit code.";
    }
    if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
    } else {
      const hasUppercase = /[A-Z]/.test(newPassword);
      const hasLowercase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      if (!hasUppercase || !hasLowercase || !hasNumber) {
        newErrors.newPassword = "Must contain uppercase, lowercase, and a number.";
      }
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
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
      await resetPassword(email, code, newPassword);
      setSuccess(true);
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Reset failed. Please try again.") });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Password reset successful."
        subtitle="You can now log in with your new password."
      >
        <Link href="/login">
          <Button fullWidth className="py-3">
            Log in
          </Button>
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set new password."
      subtitle={
        <>
          Enter the reset code sent to{" "}
          <strong className="text-text-primary">{email}</strong>
        </>
      }
      error={errors.form}
    >
      {devOtp && (
        <div className="mb-6 -ml-2 border-l-2 border-warning bg-warning/10 px-4 py-2.5 rounded-r-md">
          <p className="font-sans text-caption text-warning">
            <span className="font-semibold">Dev OTP:</span> {devOtp}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Reset code"
          id="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="e.g. 123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          error={errors.code}
          required
          helperText="Enter the 6-digit code sent to your email."
        />

        <Input
          label="New password"
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          required
          helperText="Minimum 8 characters with at least one uppercase, lowercase and digit."
        />

        <Input
          label="Confirm password"
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" isLoading={isLoading} fullWidth className="mt-2 py-3">
          Reset password
        </Button>
      </form>

      <p className="mt-8 text-center font-sans text-body-sm text-text-secondary">
        <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
          Resend code
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center p-8">
            <svg className="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
