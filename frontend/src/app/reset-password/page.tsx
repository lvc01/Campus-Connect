"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent mb-6 shadow-lg shadow-accent/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-main mb-2">Password reset successful</h1>
        <p className="text-sm text-text-muted mb-8">You can now log in with your new password.</p>
        <Link href="/login">
          <Button fullWidth>Log in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent mb-6 shadow-lg shadow-accent/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="7" rx="2" ry="2" />
            <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" strokeWidth="2.5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-main">Set new password</h1>
        <p className="mt-2 text-sm text-text-muted">
          Enter the reset code sent to <strong className="text-text-main">{email}</strong>
        </p>
      </div>

      {devOtp && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-center">
          <span className="font-semibold text-amber-400">Dev OTP: {devOtp}</span>
        </div>
      )}

      {errors.form && (
        <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-sm font-semibold text-error text-center">{errors.form}</div>
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

        <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
          Reset password
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        <Link href="/forgot-password" className="font-semibold text-accent hover:underline">
          Resend code
        </Link>
        {" · "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 bg-bg-main">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center p-8">
          <svg className="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
