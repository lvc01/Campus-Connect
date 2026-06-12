"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ReportModal } from "@/components/report-modal";

interface PostMenuProps {
  postId: string;
  authorId: string;
  content: string | null;
  onDeleted: () => void;
  onEdited: (newContent: string) => void;
}

export function PostMenu({ postId, authorId, content, onDeleted, onEdited }: PostMenuProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = user?.id === authorId;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleEdit = async () => {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.patch(`/posts/${postId}`, { content: editText.trim() });
      onEdited(editText.trim());
      setEditing(false);
      setOpen(false);
      toast.success("Post updated");
    } catch {
      toast.error("Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/posts/${postId}`);
      onDeleted();
      setOpen(false);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg mx-4 bg-background rounded-xl border border-border shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-text-primary">Edit post</h3>
            <button onClick={() => setEditing(false)} className="p-1 rounded-lg hover:bg-surface transition-colors">
              <X className="h-5 w-5 text-text-secondary" />
            </button>
          </div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm text-text-primary outline-none focus:border-accent transition-colors"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-sm font-semibold rounded-full hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={!editText.trim() || editText === content || saving}
              className="px-4 py-1.5 text-sm font-semibold rounded-full bg-accent text-accent-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-full transition-all hover:bg-surface hover:text-text-primary active:scale-95 text-text-secondary"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-background shadow-lg z-50 animate-pop-in overflow-hidden">
            {isOwner && (
              <>
                <button
                  onClick={() => {
                    setEditText(content || "");
                    setEditing(true);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-text-primary hover:bg-surface transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Edit post
                </button>
                <button
                  onClick={() => {
                    setConfirmDelete(true);
                    setOpen(false);
                  }}
                  disabled={deleting}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-like hover:bg-like/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </button>
              </>
            )}
            {!isOwner && (
              <button
                onClick={() => {
                  setShowReport(true);
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-text-primary hover:bg-surface transition-colors"
              >
                <Flag className="h-4 w-4" />
                Report post
              </button>
            )}
          </div>
        )}
      </div>

      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl p-6 animate-pop-in">
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete post?</h3>
            <p className="text-sm text-text-secondary mb-6">This can&apos;t be undone and the post will be permanently removed.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-semibold rounded-full hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-like text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showReport && (
        <ReportModal
          targetType="post"
          targetId={postId}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
