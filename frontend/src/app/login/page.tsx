"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = "Email is required.";
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const loggedUser = await login({
        email: email.toLowerCase().trim(),
        password,
      });
      if (!loggedUser.profile?.faculty) {
        router.push("/profile/setup");
      } else {
        router.push("/");
      }
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Invalid email or password.") });
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" strokeWidth="2.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-main">Sign in to Campus Connect</h1>
          <p className="mt-2 text-sm text-text-muted">Log in to your Chandigarh University campus network</p>
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

          <Input
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />

          <div className="text-right -mt-3">
            <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
            Log in
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
