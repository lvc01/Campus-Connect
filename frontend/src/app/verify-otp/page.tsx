"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const CELL_COUNT = 6;

function VerifyOtpContent() {
  const { verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [values, setValues] = useState<string[]>(Array(CELL_COUNT).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtp] = useState(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("cc_dev_otp") : null;
    if (stored) sessionStorage.removeItem("cc_dev_otp");
    return stored;
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) router.push("/register");
  }, [email, router]);

  useEffect(() => {
    // Focus first cell on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const code = values.join("");

  const handleChange = (index: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[index] = char;
    setValues(next);

    // Auto-advance on fill
    if (char && index < CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 cells are filled
    if (char && index === CELL_COUNT - 1) {
      const fullCode = next.join("");
      if (/^\d{6}$/.test(fullCode)) {
        // Fire async submission without awaiting — handled by effect
        setTimeout(() => void submitCode(fullCode), 0);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      // Move to previous cell on backspace when current is empty
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CELL_COUNT);
    if (!text) return;
    const next = Array(CELL_COUNT).fill("");
    text.split("").forEach((c, i) => (next[i] = c));
    setValues(next);
    const focusIndex = Math.min(text.length, CELL_COUNT - 1);
    inputRefs.current[focusIndex]?.focus();

    if (text.length === CELL_COUNT) {
      setTimeout(() => void submitCode(text), 0);
    }
  };

  const submitCode = async (fullCode: string) => {
    if (!/^\d{6}$/.test(fullCode)) {
      setErrors({ code: "Must be a 6-digit code." });
      return;
    }
    setIsLoading(true);
    setErrors({});
    try {
      const loggedUser = await verifyOtp(email, fullCode);
      if (!loggedUser.profile?.faculty) {
        router.push("/profile/setup");
      } else {
        router.push("/");
      }
    } catch (err) {
      setErrors({ code: getApiErrorMessage(err, "Invalid or expired code.") });
      // Clear cells on error so the user can retype
      setValues(Array(CELL_COUNT).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCode(code);
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
    <AuthCard
      title="Verify your email."
      subtitle={<>We sent a 6-digit code to <strong className="text-text-primary">{email}</strong></>}
      error={errors.form}
    >
      {devOtp && (
        <div className="mb-6 -ml-1 border-l-2 border-warning bg-warning/10 px-4 py-2.5 rounded-r-md">
          <p className="font-sans text-caption text-warning">
            <span className="font-semibold">Dev OTP:</span> {devOtp}
          </p>
        </div>
      )}

      {errors.code && (
        <p className="mb-3 font-sans text-caption text-error">{errors.code}</p>
      )}

      <form onSubmit={handleSubmit}>
        <div
          className="flex gap-2 sm:gap-2.5 justify-between"
          onPaste={handlePaste}
        >
          {values.map((val, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              value={val}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={isLoading}
              aria-label={`Verification digit ${i + 1}`}
              className={cn(
                "h-14 w-full min-w-0 flex-1 bg-transparent text-center font-display text-h2 font-medium text-text-primary outline-none transition-all",
                "border-b-2 placeholder:text-text-tertiary",
                val
                  ? "border-accent text-text-primary"
                  : "border-border-strong text-text-secondary hover:border-text-secondary focus:border-accent",
                errors.code && "border-error",
              )}
              style={{ maxWidth: "3.25rem" }}
            />
          ))}
        </div>

        <Button type="submit" isLoading={isLoading} fullWidth className="mt-8 py-3">
          Verify & continue
        </Button>
      </form>

      <div className="mt-8 text-center font-sans text-body-sm text-text-secondary">
        Didn&apos;t receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendTimer > 0 || resendLoading}
          className={`font-semibold transition-colors ${
            resendTimer > 0 || resendLoading
              ? "text-text-tertiary cursor-not-allowed"
              : "text-accent hover:underline"
          }`}
        >
          {resendTimer > 0 ? `Resend code (${resendTimer}s)` : "Resend code"}
        </button>
      </div>
    </AuthCard>
  );
}

export default function VerifyOtpPage() {
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
        <VerifyOtpContent />
      </Suspense>
    </AuthShell>
  );
}
