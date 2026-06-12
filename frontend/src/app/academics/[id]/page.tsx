"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Loader2,
  BookOpen,
  Users,
  FileText,
  Download,
  Upload,
  Plus,
  UserPlus,
  UserMinus,
  XCircle,
  Search,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getInitials, getRelativeTime, formatCount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { UploadResource } from "@/components/upload-resource";
import Link from "next/link";
import type { CourseData, ResourceData, StudyGroupData } from "@/types/academics";

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  notes: "Notes",
  past_paper: "Past Paper",
  study_guide: "Study Guide",
  other: "Other",
};

const RESOURCE_TYPE_ICONS: Record<string, string> = {
  notes: "📝",
  past_paper: "📄",
  study_guide: "📚",
  other: "📎",
};

type TabKey = "resources" | "groups";

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [studyGroups, setStudyGroups] = useState<StudyGroupData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("resources");
  const [resourceFilter, setResourceFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const fetchCourse = useCallback(async () => {
    if (!params.id || !user) return;
    try {
      const res = await apiClient.get(`/academics/courses/${params.id}`);
      setCourse(res.data);
    } catch (err) {
      if (getApiErrorStatus(err) === 404) setError("Course not found.");
      else setError("Failed to load course.");
    }
  }, [params.id, user]);

  const fetchResources = useCallback(async () => {
    if (!params.id) return;
    try {
      const qs = resourceFilter ? `?resource_type=${resourceFilter}` : "";
      const res = await apiClient.get(`/academics/courses/${params.id}/resources${qs}`);
      setResources(Array.isArray(res.data) ? res.data : []);
    } catch {}
  }, [params.id, resourceFilter]);

  const fetchStudyGroups = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await apiClient.get(`/academics/courses/${params.id}/study-groups`);
      setStudyGroups(Array.isArray(res.data) ? res.data : []);
    } catch {}
  }, [params.id]);

  useEffect(() => {
    if (!params.id || !user) return;
    setIsLoading(true);
    Promise.all([fetchCourse(), fetchResources(), fetchStudyGroups()])
      .finally(() => setIsLoading(false));
  }, [params.id, user, fetchCourse, fetchResources, fetchStudyGroups]);

  useEffect(() => {
    fetchResources();
  }, [resourceFilter, fetchResources]);

  const handleJoinLeave = async () => {
    if (!course || isJoining) return;
    setIsJoining(true);
    try {
      if (course.is_member) {
        await apiClient.delete(`/academics/courses/${course.id}/join`);
      } else {
        await apiClient.post(`/academics/courses/${course.id}/join`);
      }
      setCourse((prev) => prev ? {
        ...prev,
        is_member: !prev.is_member,
        member_count: prev.member_count + (prev.is_member ? -1 : 1),
        member_role: prev.is_member ? null : "student",
      } : prev);
    } catch (err) {
      console.error("Failed to join/leave", err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      await apiClient.post(`/academics/study-groups/${groupId}/join`);
      setStudyGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, is_member: true, member_count: g.member_count + 1 }
            : g
        )
      );
    } catch (err) {
      console.error("Failed to join group", err);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      await apiClient.delete(`/academics/study-groups/${groupId}/join`);
      setStudyGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, is_member: false, member_count: g.member_count - 1 }
            : g
        )
      );
    } catch (err) {
      console.error("Failed to leave group", err);
    }
  };

  const handleDownload = async (resourceId: string) => {
    try {
      await apiClient.post(`/academics/resources/${resourceId}/download`);
      setResources((prev) =>
        prev.map((r) =>
          r.id === resourceId ? { ...r, download_count: r.download_count + 1 } : r
        )
      );
    } catch {}
  };

  const handleResourceUploaded = (resource: ResourceData) => {
    setResources((prev) => [resource, ...prev]);
    setShowUpload(false);
  };

  const handleGroupCreated = (group: StudyGroupData) => {
    setStudyGroups((prev) => [group, ...prev]);
    setShowCreateGroup(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg">
        <Loader2 className="h-10 w-10 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col items-center justify-center gap-4">
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center">
          <XCircle className="h-10 w-10 text-text-secondary mx-auto mb-3" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-text-secondary">{error || "Course not found"}</h2>
          <Link href="/academics" className="text-accent text-sm font-semibold mt-2 inline-block hover:underline">Back to Academics</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col relative">
      <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />

      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 relative z-10">
        <Link href="/academics" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          Back to Academics
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-accent/10 text-accent">{course.code}</span>
              {course.year && (
                <span className="text-xs font-semibold text-text-muted">Year {course.year}{course.semester ? ` · Sem ${course.semester}` : ""}</span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight">{course.name}</h1>
            <p className="text-sm text-text-secondary mt-1">{course.faculty}</p>
            {course.description && (
              <p className="text-sm text-text-secondary mt-2 max-w-xl leading-relaxed">{course.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-text-muted">{formatCount(course.member_count)} members</p>
              <p className="text-xs font-semibold text-text-muted">{formatCount(course.resource_count)} resources</p>
            </div>
            <Button
              onClick={handleJoinLeave}
              disabled={isJoining}
              variant={course.is_member ? "secondary" : "default"}
              className={course.is_member ? "gap-1.5 text-like border-like/20 hover:bg-like/10" : "gap-1.5"}
            >
              {course.is_member ? (
                <>
                  <UserMinus className="h-3.5 w-3.5" />
                  Leave Course
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Join Course
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border mb-6">
          {([
            { key: "resources", label: "Resources", icon: FileText, count: resources.length },
            { key: "groups", label: "Study Groups", icon: Users, count: studyGroups.length },
          ] as const).map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
                tab === key
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface text-text-muted">{count}</span>
              )}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {tab === "resources" && course.is_member && (
              <>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="text-[11px] font-semibold px-2 py-1.5 rounded-lg border border-border bg-surface text-text-primary outline-none focus:border-accent/50"
                >
                  <option value="">All Types</option>
                  <option value="notes">Notes</option>
                  <option value="past_paper">Past Papers</option>
                  <option value="study_guide">Study Guides</option>
                  <option value="other">Other</option>
                </select>
                <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
              </>
            )}
            {tab === "groups" && course.is_member && (
              <Button size="sm" onClick={() => setShowCreateGroup(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Create Group
              </Button>
            )}
          </div>
        </div>

        {tab === "resources" && (
          <div className="space-y-3">
            {resources.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-10 w-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-text-secondary">
                  {resourceFilter ? "No resources of this type." : "No resources uploaded yet."}
                </p>
                {course.is_member && (
                  <Button size="sm" className="mt-3" onClick={() => setShowUpload(true)}>
                    Upload Resource
                  </Button>
                )}
              </div>
            ) : (
              resources.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-surface hover:bg-surface transition-colors animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}
                >
                  <span className="text-2xl">{RESOURCE_TYPE_ICONS[r.resource_type] || "📎"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        {RESOURCE_TYPE_LABELS[r.resource_type] || r.resource_type}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        by {r.uploader?.profile?.display_name || r.uploader?.email?.split("@")[0] || "Unknown"}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {getRelativeTime(r.created_at)}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-1">{r.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-text-muted font-medium">
                      <Download className="h-3 w-3 inline mr-0.5" />
                      {r.download_count}
                    </span>
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleDownload(r.id)}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "groups" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {studyGroups.length === 0 ? (
              <div className="col-span-full py-12 text-center">
                <Users className="h-10 w-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-text-secondary">No study groups yet.</p>
                {course.is_member && (
                  <Button size="sm" className="mt-3" onClick={() => setShowCreateGroup(true)}>
                    Create Study Group
                  </Button>
                )}
              </div>
            ) : (
              studyGroups.map((g, i) => (
                <div
                  key={g.id}
                  className="p-5 rounded-xl border border-border bg-bg-surface hover:bg-surface transition-colors animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 50, 200)}ms` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-bold text-text-primary">{g.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      g.member_count >= g.max_members
                        ? "bg-like/10 text-like"
                        : "bg-accent/10 text-accent"
                    }`}>
                      {g.member_count}/{g.max_members}
                    </span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-text-secondary mb-3 line-clamp-2">{g.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-muted">
                      {formatCount(g.member_count)} members
                    </span>
                    {course.is_member && (
                      g.is_member ? (
                        <button
                          onClick={() => handleLeaveGroup(g.id)}
                          className="text-[11px] font-semibold text-like hover:text-like/80 transition-colors"
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinGroup(g.id)}
                          disabled={g.member_count >= g.max_members}
                          className="text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
                        >
                          {g.member_count >= g.max_members ? "Full" : "Join"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <UploadResource
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        courseId={course.id}
        onResourceUploaded={handleResourceUploaded}
      />

      {showCreateGroup && (
        <CreateGroupModal
          courseId={course.id}
          onClose={() => setShowCreateGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

function CreateGroupModal({
  courseId,
  onClose,
  onCreated,
}: {
  courseId: string;
  onClose: () => void;
  onCreated: (group: StudyGroupData) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await apiClient.post(`/academics/courses/${courseId}/study-groups`, {
        name: name.trim(),
        description: description.trim() || null,
        max_members: parseInt(maxMembers) || 10,
      });
      onCreated(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create study group."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-bg-surface border border-border rounded-3xl p-6 animate-pop-in">
        <h2 className="text-xl font-bold tracking-tight mb-1">Create Study Group</h2>
        <p className="text-xs text-text-muted mb-5">Form a group for collaborative studying</p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-like/10 border border-like/20 text-xs text-like font-semibold">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">Group Name</label>
            <input
              type="text"
              placeholder="e.g. Calculus Study Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl bg-bg-surface border border-border text-sm font-medium text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">Description</label>
            <textarea
              placeholder="What will this group focus on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-xl bg-bg-surface border border-border text-sm font-medium text-text-primary placeholder:text-text-muted resize-none outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-primary">Max Members</label>
            <input
              type="number"
              min="2"
              max="50"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              className="w-24 px-3 py-2 rounded-xl bg-bg-surface border border-border text-sm font-medium text-text-primary outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" isLoading={isLoading} disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
