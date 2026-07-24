"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { BackLink } from "@/components/layout/BackLink";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed successfully");
      router.push("/settings");
    } catch (err) {
      const response = (err as { response?: { data?: { detail?: string } } }).response;
      const detail = response?.data?.detail;
      const msg = detail || "Failed to change password";
      toast.error(typeof msg === "string" ? msg : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 relative z-10">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="font-display text-h1 font-medium text-text-primary mb-2">
          Change Password
        </h1>
        <p className="font-sans text-body-sm text-text-secondary mb-8 leading-relaxed">
          Enter your current password and choose a new one.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="block font-sans text-body-sm font-semibold text-text-primary mb-1.5"
            >
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-xl font-sans text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors placeholder:text-text-tertiary"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block font-sans text-body-sm font-semibold text-text-primary mb-1.5"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                id="newPassword"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-xl font-sans text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors placeholder:text-text-tertiary"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="font-sans text-caption text-text-tertiary mt-1">At least 8 characters</p>
          </div>

          {/* Confirm password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block font-sans text-body-sm font-semibold text-text-primary mb-1.5"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-xl font-sans text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors placeholder:text-text-tertiary"
                required
                minLength={8}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-xl font-sans text-body-sm font-semibold hover:bg-accent-press transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
