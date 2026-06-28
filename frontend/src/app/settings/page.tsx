"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  Loader2,
  User,
  Key,
  AtSign,
  Bell,
  Eye,
  HelpCircle,
  MessageSquare,
  Info,
  Trash2,
  Shield,
  Mail,
  Heart,
  MessageCircle,
  Calendar,
  Radio,
  CheckCheck,
  Bug,
  Send,
  Share2,
  FileText,
  BookOpen,
  Sun,
  Moon,
  Ban,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/context/theme-context";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface BlockedUser {
  id: string;
  email: string;
  display_name: string;
}

interface UserSettings {
  push_notifications: boolean;
  email_notifications: boolean;
  like_notifications: boolean;
  comment_notifications: boolean;
  mention_notifications: boolean;
  event_notifications: boolean;
  public_profile: boolean;
  show_online_status: boolean;
  show_read_receipts: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    push_notifications: true,
    email_notifications: true,
    like_notifications: true,
    comment_notifications: true,
    mention_notifications: true,
    event_notifications: true,
    public_profile: true,
    show_online_status: true,
    show_read_receipts: true,
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data } = await apiClient.get("/users/me/settings");
      setSettings(data);
    } catch {} finally {
      setLoading(false);
    }
  }

  async function updateSettings(patch: Partial<UserSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await apiClient.patch("/users/me/settings", patch);
    } catch {
      setSettings(settings);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    logout();
    router.push("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await apiClient.delete("/users/me");
      logout();
      router.push("/login");
      toast.success("Account deleted");
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function toggleBlockedPanel() {
    const next = !showBlocked;
    setShowBlocked(next);
    if (next) {
      setBlockedLoading(true);
      try {
        const { data } = await apiClient.get("/users/me/blocks");
        setBlocked(data);
      } catch {
        toast.error("Failed to load blocked users");
      } finally {
        setBlockedLoading(false);
      }
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const shareData = { title: "Campus Connect", text: "Join me on Campus Connect", url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // user cancelled the share sheet — no-op
    }
  }

  async function handleUnblock(id: string) {
    try {
      await apiClient.delete(`/users/${id}/block`);
      setBlocked((prev) => prev.filter((b) => b.id !== id));
      toast.success("User unblocked");
    } catch {
      toast.error("Failed to unblock user");
    }
  }

  const displayName = user?.profile?.display_name || "Student";
  const username = user?.username || user?.email?.split("@")[0] || "user";

  return (
    <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col relative">
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          Back
        </Link>

        <h1 className="text-2xl font-black text-text-primary mb-6">Settings</h1>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile card */}
            <div
              className="bg-bg-elevated border border-border rounded-2xl p-6 cursor-pointer hover:border-accent/30 transition-colors"
              onClick={() => router.push(`/profile/${user?.id}`)}
            >
              <div className="flex items-center gap-4">
                <Avatar user={user || {}} size={72} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary truncate">
                    {displayName}
                  </h3>
                  <p className="text-sm text-text-muted truncate">{user?.email}</p>
                  {user?.username && (
                    <p className="text-sm text-accent font-semibold mt-0.5">
                      @{user.username}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-text-muted shrink-0" />
              </div>
            </div>

            {/* Appearance */}
            <Section icon={Sun} title="Appearance">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Theme</p>
                  <p className="text-xs text-text-muted mt-0.5">Choose how Campus Connect looks</p>
                </div>
                <div className="flex items-center rounded-full border border-border bg-bg-surface p-0.5">
                  <button
                    onClick={() => setTheme("light")}
                    aria-pressed={theme === "light"}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      theme === "light" ? "bg-accent text-accent-foreground" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" /> Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    aria-pressed={theme === "dark"}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      theme === "dark" ? "bg-accent text-accent-foreground" : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" /> Dark
                  </button>
                </div>
              </div>
            </Section>

            {/* Account */}
            <Section icon={Shield} title="Account">
              <SettingsRow
                icon={AtSign}
                iconColor="#8b5cf6"
                label="Username"
                value={`@${username}`}
                onClick={() => router.push("/username")}
              />
              <SettingsRow
                icon={Lock}
                iconColor="#3b82f6"
                label="Change Password"
                onClick={() => router.push("/change-password")}
              />
            </Section>

            {/* Notifications */}
            <Section icon={Bell} title="Notifications">
              <ToggleRow
                icon={Bell}
                iconColor="#f59e0b"
                label="Push Notifications"
                description="Receive notifications on your device"
                checked={settings.push_notifications}
                onChange={(v) => updateSettings({ push_notifications: v })}
              />
              <ToggleRow
                icon={Mail}
                iconColor="#3b82f6"
                label="Email Notifications"
                description="Get notified via email"
                checked={settings.email_notifications}
                onChange={(v) => updateSettings({ email_notifications: v })}
              />
              {settings.push_notifications !== false && (
                <>
                  <ToggleRow
                    icon={Heart}
                    iconColor="#ef4444"
                    label="Likes"
                    checked={settings.like_notifications}
                    onChange={(v) => updateSettings({ like_notifications: v })}
                  />
                  <ToggleRow
                    icon={MessageCircle}
                    iconColor="#10b981"
                    label="Comments & Replies"
                    checked={settings.comment_notifications}
                    onChange={(v) => updateSettings({ comment_notifications: v })}
                  />
                  <ToggleRow
                    icon={AtSign}
                    iconColor="#8b5cf6"
                    label="Mentions"
                    checked={settings.mention_notifications}
                    onChange={(v) => updateSettings({ mention_notifications: v })}
                  />
                  <ToggleRow
                    icon={Calendar}
                    iconColor="#f97316"
                    label="Events"
                    checked={settings.event_notifications}
                    onChange={(v) => updateSettings({ event_notifications: v })}
                  />
                </>
              )}
            </Section>

            {/* Privacy */}
            <Section icon={Eye} title="Privacy">
              <ToggleRow
                icon={Eye}
                iconColor="#10b981"
                label="Public Profile"
                description="Allow others to view your profile"
                checked={settings.public_profile}
                onChange={(v) => updateSettings({ public_profile: v })}
              />
              <ToggleRow
                icon={Radio}
                iconColor="#3b82f6"
                label="Online Status"
                description="Show when you're active"
                checked={settings.show_online_status}
                onChange={(v) => updateSettings({ show_online_status: v })}
              />
              <ToggleRow
                icon={CheckCheck}
                iconColor="#8b5cf6"
                label="Read Receipts"
                description="Show when you've read messages"
                checked={settings.show_read_receipts}
                onChange={(v) => updateSettings({ show_read_receipts: v })}
              />
              <SettingsRow
                icon={Ban}
                iconColor="#ef4444"
                label="Blocked Users"
                value={blocked.length > 0 && showBlocked ? String(blocked.length) : undefined}
                onClick={toggleBlockedPanel}
              />
              {showBlocked && (
                <div className="px-4 py-3 border-t border-border bg-bg-surface/40">
                  {blockedLoading ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                    </div>
                  ) : blocked.length === 0 ? (
                    <p className="text-sm text-text-muted py-2 text-center">You haven&apos;t blocked anyone.</p>
                  ) : (
                    <div className="space-y-2">
                      {blocked.map((b) => (
                        <div key={b.id} className="flex items-center gap-3">
                          <Avatar user={{ id: b.id, display_name: b.display_name, email: b.email }} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{b.display_name || b.email.split("@")[0]}</p>
                            <p className="text-xs text-text-muted truncate">{b.email}</p>
                          </div>
                          <button
                            onClick={() => handleUnblock(b.id)}
                            className="text-xs font-semibold text-accent hover:underline shrink-0"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Support */}
            <Section icon={HelpCircle} title="Support">
              <SettingsRow
                icon={HelpCircle}
                iconColor="#3b82f6"
                label="Help Center"
                onClick={() => router.push("/help")}
              />
              <SettingsRow
                icon={Bug}
                iconColor="#ef4444"
                label="Report a Bug"
                onClick={() => { window.location.href = "mailto:support@campusconnect.app?subject=Bug%20Report"; }}
              />
              <SettingsRow
                icon={Send}
                iconColor="#10b981"
                label="Send Feedback"
                onClick={() => { window.location.href = "mailto:support@campusconnect.app?subject=Feedback"; }}
              />
            </Section>

            {/* Legal */}
            <Section icon={FileText} title="Legal">
              <SettingsRow
                icon={FileText}
                label="Terms of Service"
                onClick={() => router.push("/terms")}
              />
              <SettingsRow
                icon={Shield}
                label="Privacy Policy"
                onClick={() => router.push("/privacy")}
              />
              <SettingsRow
                icon={BookOpen}
                label="Community Guidelines"
                onClick={() => router.push("/guidelines")}
              />
            </Section>

            {/* About */}
            <Section icon={Info} title="About">
              <SettingsRow
                icon={Info}
                label="App Version"
                value="1.0.0"
                showChevron={false}
              />
              <SettingsRow
                icon={Share2}
                iconColor="#06b6d4"
                label="Share Campus Connect"
                onClick={handleShare}
              />
            </Section>

            {/* Danger Zone */}
            <div className="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
              <div className="p-4 space-y-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-error/5 rounded-xl transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
                    <LogOut className="h-4 w-4 text-error" />
                  </div>
                  <span className="text-sm font-semibold text-error flex-1">Log Out</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-error/5 rounded-xl transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-error" />
                  </div>
                  <span className="text-sm font-semibold text-error flex-1">Delete Account</span>
                </button>
              </div>

              {/* Delete confirmation */}
              {showDeleteConfirm && (
                <div className="px-4 pb-4 pt-2 border-t border-border">
                  <p className="text-sm text-text-secondary mb-3">
                    This action is permanent and cannot be undone. All your data will be lost.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 bg-error text-white rounded-xl text-sm font-semibold hover:bg-error/90 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2.5 bg-bg border border-border text-text-secondary rounded-xl text-sm font-semibold hover:bg-bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-text-muted text-center pb-8">
              Campus Connect v1.0.0
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  iconColor,
  label,
  value,
  onClick,
  showChevron = true,
}: {
  icon: typeof Key;
  iconColor?: string;
  label: string;
  value?: string;
  onClick?: () => void;
  showChevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-surface transition-colors text-left disabled:cursor-default"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: iconColor ? iconColor + "1f" : "rgb(var(--accent) / 0.1)" }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor || "rgb(var(--accent))" }} />
      </div>
      <span className="text-sm font-semibold text-text-primary flex-1">{label}</span>
      {value && (
        <span className="text-sm text-text-secondary mr-1">{value}</span>
      )}
      {showChevron && onClick && (
        <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
      )}
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  iconColor,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof Key;
  iconColor?: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: iconColor ? iconColor + "1f" : "rgb(var(--accent) / 0.1)" }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor || "rgb(var(--accent))" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-bg-elevated ${
          checked ? "bg-accent" : "bg-bg-surface border-border"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
