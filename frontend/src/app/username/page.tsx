"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Loader2, Check, X } from "lucide-react";
import { BackLink } from "@/components/layout/BackLink";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;

export default function UsernamePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentUsername = user?.username || user?.email?.split("@")[0] || "";
  const isValid = USERNAME_REGEX.test(username);
  const isChanged = username !== currentUsername && username.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error("Username must be 3-30 characters (letters, numbers, dots, underscores)");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiClient.patch("/users/me/username", { username });
      await refreshUser();
      toast.success("Username updated");
      router.push("/settings");
    } catch (err) {
      const response = (err as { response?: { data?: { detail?: string } } }).response;
      const detail = response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Failed to update username";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 relative z-10">
        <BackLink href="/settings" label="Back to Settings" />

        <h1 className="text-2xl font-black text-text-primary mb-2">
          Username
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Choose a unique username for your profile.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-text-primary mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase());
                  setError("");
                }}
                className={`w-full pl-10 pr-10 py-2.5 bg-background border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors ${
                  error
                    ? "border-error"
                    : isChanged && isValid
                    ? "border-success"
                    : "border-border"
                }`}
                placeholder="yourname"
                required
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChanged && isValid && !error && (
                  <Check className="h-4 w-4 text-success" />
                )}
                {error && (
                  <X className="h-4 w-4 text-error" />
                )}
              </div>
            </div>
            {error && (
              <p className="text-xs text-error font-semibold mt-1.5">{error}</p>
            )}
            <p className="text-xs text-text-tertiary mt-1.5">
              3-30 characters. Letters, numbers, dots, and underscores only.
            </p>
          </div>

          {/* Preview */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Preview
            </p>
            <p className="text-sm text-text-primary">
              <span className="font-semibold">
                {user?.profile?.display_name || "Student"}
              </span>{" "}
              <span className="text-accent">@{username || "yourname"}</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !isChanged || !isValid}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Username"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
