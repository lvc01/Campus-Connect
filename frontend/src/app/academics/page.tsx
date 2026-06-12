"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Users,
  FileText,
  Search,
  UserPlus,
  UserMinus,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CourseData } from "@/types/academics";

const FACULTIES = ["All", "Engineering", "Computer Applications", "Management"];

type TabKey = "my" | "all";

export default function AcademicsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [faculty, setFaculty] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (faculty !== "All") params.faculty = faculty;
      if (search) params.search = search;
      const res = await apiClient.get("/academics/courses", { params });
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user, faculty, search]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleJoinLeave = async (course: CourseData) => {
    if (joiningId) return;
    setJoiningId(course.id);
    try {
      if (course.is_member) {
        await apiClient.delete(`/academics/courses/${course.id}/join`);
      } else {
        await apiClient.post(`/academics/courses/${course.id}/join`);
      }
      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id
            ? {
                ...c,
                is_member: !c.is_member,
                member_count: c.member_count + (c.is_member ? -1 : 1),
                member_role: c.is_member ? null : "student",
              }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to join/leave", err);
    } finally {
      setJoiningId(null);
    }
  };

  const displayed = tab === "my" ? courses.filter((c) => c.is_member) : courses;

  if (!user) return null;

  return (
    <LayoutShell hideRightRail>
      <PageHeader title="Academics" />

      <div className="px-6">
        <div className="flex items-center gap-2 pt-3 pb-4 border-b border-border">
          {([
            { key: "all", label: "All Courses", icon: BookOpen },
            { key: "my", label: "My Courses", icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                tab === key
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === "my" && courses.some((c) => c.is_member) && (
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                  {courses.filter((c) => c.is_member).length}
                </span>
              )}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-48 pl-9 pr-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">Search</Button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 py-3 border-b border-border">
          {FACULTIES.map((f) => (
            <button
              key={f}
              onClick={() => setFaculty(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-200",
                faculty === f
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-text-secondary hover:bg-surface"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="py-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-surface animate-pulse">
                  <div className="h-4 bg-border rounded w-20 mb-3" />
                  <div className="h-5 bg-border rounded w-3/4 mb-2" />
                  <div className="h-3 bg-border rounded w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-6 bg-border rounded-lg w-16" />
                    <div className="h-6 bg-border rounded-lg w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-text-secondary">
                {tab === "my"
                  ? "You haven't joined any courses yet."
                  : "No courses found."}
              </p>
              {tab === "my" && (
                <Button size="sm" className="mt-3" onClick={() => setTab("all")}>
                  Browse Courses
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayed.map((course, i) => (
                <div
                  key={course.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
                >
                  <Link
                    href={`/academics/${course.id}`}
                    className="block p-5 rounded-xl border border-border bg-bg-surface hover:bg-surface transition-all duration-200 hover:scale-[1.01] group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-accent/10 text-accent">
                          {course.code}
                        </span>
                        {course.is_member && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            Joined
                          </span>
                        )}
                      </div>
                      {course.year && (
                        <span className="text-[10px] font-semibold text-text-muted">
                          Y{course.year}{course.semester ? `S${course.semester}` : ""}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                      {course.name}
                    </h3>
                    <p className="text-xs text-text-secondary mb-4">{course.faculty}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-text-muted font-medium">
                          <Users className="h-3 w-3" />
                          {formatCount(course.member_count)} members
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-text-muted font-medium">
                          <FileText className="h-3 w-3" />
                          {formatCount(course.resource_count)} resources
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleJoinLeave(course);
                        }}
                        disabled={joiningId === course.id}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95",
                          course.is_member
                            ? "text-like hover:bg-like/10"
                            : "bg-accent/10 text-accent hover:bg-accent/20"
                        )}
                      >
                        {joiningId === course.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : course.is_member ? (
                          <>
                            <UserMinus className="h-3 w-3" />
                            Leave
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3" />
                            Join
                          </>
                        )}
                      </button>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LayoutShell>
  );
}
