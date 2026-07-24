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
    <AuthShell>
      <AuthCard
        title="Welcome back."
        subtitle={<>Log in to your Chandigarh University campus network.</>}
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
            <Link href="/forgot-password" className="font-sans text-caption font-semibold text-accent hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2 py-3">
            Log in
          </Button>
        </form>

        <p className="mt-8 text-center font-sans text-body-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
