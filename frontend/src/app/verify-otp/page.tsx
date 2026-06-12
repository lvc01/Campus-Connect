"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

function VerifyOtpContent() {
  const { verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtp] = useState(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("cc_dev_otp") : null;
    if (stored) sessionStorage.removeItem("cc_dev_otp");
    return stored;
  });

  useEffect(() => {
    if (!email) router.push("/register");
  }, [email, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!code) {
      newErrors.code = "Verification code is required.";
    } else if (!/^\d{6}$/.test(code)) {
      newErrors.code = "Must be a 6-digit number.";
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
      const loggedUser = await verifyOtp(email, code);
      if (!loggedUser.profile?.faculty) {
        router.push("/profile/setup");
      } else {
        router.push("/");
      }
    } catch (err) {
      setErrors({ code: getApiErrorMessage(err, "Invalid or expired code.") });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return;
    setResendLoading(true);
    setErrors({});
    try {
      const message = await resendOtp(email);
      setResendTimer(60);
      alert(message);
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Resend failed. Please wait and try again.") });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-text-inverse mb-6 shadow-lg shadow-accent/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="16" x="4" y="4" rx="2" /><path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-text-main">Verify Email</h1>
        <p className="mt-2 text-sm text-text-muted">
          We sent a 6-digit OTP code to <strong className="text-text-main">{email}</strong>
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
          label="Verification code"
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

        <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
          Verify & continue
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-text-muted">
        Didn&apos;t receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendTimer > 0 || resendLoading}
          className={`font-semibold transition-colors ${
            resendTimer > 0 || resendLoading
              ? "text-text-muted cursor-not-allowed"
              : "text-accent hover:underline"
          }`}
        >
          {resendTimer > 0 ? `Resend code (${resendTimer}s)` : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
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
        <VerifyOtpContent />
      </Suspense>
    </div>
  );
}
