"use client";

import React, { useState, useEffect } from "react";
import { Bookmark, ChevronLeft, MessageCircle, XCircle, Edit, Eye, Tag, Flag, MapPin } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getInitials, getRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { DetailSkeleton } from "@/components/ui/detail-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { CreateListing } from "@/components/create-listing";
import { ReportModal } from "@/components/report-modal";
import Link from "next/link";
import type { ListingData } from "@/types/marketplace";

interface ListingDetail extends ListingData {
  seller: {
    id: string;
    email: string;
    profile: { display_name: string; avatar_url: string | null; bio: string | null; year_of_study: number | null; faculty: string | null } | null;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  textbook: "Textbook", accommodation: "Accommodation", tutoring: "Tutoring",
  electronics: "Electronics", other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like New", good: "Good", fair: "Fair", poor: "Poor",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sold: "bg-like/10 text-like border-like/20",
  reserved: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  expired: "bg-text-muted/10 text-text-muted border-border",
};

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<string | null>(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingReview, setRatingReview] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const isOwner = user && listing && user.id === listing.seller.id;

  useEffect(() => {
    if (!params.id || !user) return;
    const fetch = async () => {
      try {
        const response = await apiClient.get(`/marketplace/listings/${params.id}`);
        setListing(response.data);
        setIsSaved(response.data.is_saved);
      } catch (err) {
        if (getApiErrorStatus(err) === 404) {
          setError("Listing not found.");
        } else {
          setError("Failed to load listing.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [params.id, user]);

  const handleSaveToggle = async () => {
    try {
      if (isSaved) {
        await apiClient.delete(`/marketplace/listings/${params.id}/save`);
      } else {
        await apiClient.post(`/marketplace/listings/${params.id}/save`);
      }
      setIsSaved(!isSaved);
    } catch (err) {
      console.error("Failed to toggle save", err);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/marketplace/listings/${params.id}`);
      router.push("/marketplace");
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await apiClient.patch(`/marketplace/listings/${params.id}`, {
        status: newStatus,
      });
      setListing((prev) => prev ? { ...prev, status: newStatus } : prev);
      setShowStatusConfirm(null);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleDMSeller = async () => {
    if (!listing) return;
    setDmLoading(true);
    try {
      await apiClient.post("/messaging/conversations", {
        type: "direct",
        member_ids: [listing.seller.id],
      });
      router.push(`/messages`);
    } catch (err) {
      console.error("Failed to create DM", err);
    } finally {
      setDmLoading(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRating(true);
    setRatingError("");
    try {
      await apiClient.post(`/marketplace/listings/${params.id}/ratings`, {
        rating: ratingValue,
        review: ratingReview.trim() || undefined,
      });
      setListing((prev) => {
        if (!prev) return prev;
        const newCount = prev.rating_count + 1;
        const newAvg = ((prev.avg_rating * prev.rating_count) + ratingValue) / newCount;
        return { ...prev, avg_rating: Math.round(newAvg * 10) / 10, rating_count: newCount };
      });
      setShowRatingForm(false);
      setRatingValue(5);
      setRatingReview("");
    } catch (err) {
      setRatingError(getApiErrorMessage(err, "Failed to submit rating."));
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleEditCreated = (updated: any) => {
    setListing((prev) => prev ? { ...prev, ...updated } : prev);
    setShowEdit(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex-1 bg-background">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex-1 min-h-screen bg-background text-text-primary flex flex-col items-center justify-center">
        <ErrorState
          title={error || "Listing not found"}
          message="This listing may have been sold or removed."
          onRetry={() => window.location.reload()}
        />
        <Link href="/marketplace" className="mt-2 text-accent text-sm font-semibold hover:underline">Back to Marketplace</Link>
      </div>
    );
  }

  const sellerName = listing.seller?.profile?.display_name || listing.seller?.email?.split("@")[0] || "Unknown";
  const sellerYear = listing.seller?.profile?.year_of_study;
  const sellerFaculty = listing.seller?.profile?.faculty;
  const stars = listing.avg_rating > 0
    ? "★".repeat(Math.round(listing.avg_rating)) + "☆".repeat(5 - Math.round(listing.avg_rating))
    : "";

  return (
    <div className="flex-1 min-h-screen bg-bg text-text-primary flex flex-col relative">
      <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[800px] h-[800px] rounded-full bg-accent/5 blur-[160px] pointer-events-none" />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 relative z-10">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors mb-6">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
              {listing.images?.[selectedImage]?.url ? (
                <img src={listing.images[selectedImage].url} alt={listing.title} className="w-full h-[400px] object-cover" />
              ) : (
                <div className="w-full h-[400px] flex items-center justify-center bg-bg-surface">
                  <XCircle className="h-16 w-16 text-text-muted" strokeWidth={1} />
                </div>
              )}
            </div>

            {listing.images && listing.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {listing.images.map((img, idx) => (
                  <button
                    key={img.id || idx} onClick={() => setSelectedImage(idx)}
                    className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      idx === selectedImage ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="bg-bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-sm font-bold text-text-primary mb-3">Description</h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {listing.description || "No description provided."}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className="bg-bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h1 className="text-xl font-black tracking-tight leading-tight text-text-primary">{listing.title}</h1>
                <span className="text-2xl font-black text-success shrink-0">₹{listing.price.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {CATEGORY_LABELS[listing.category] || listing.category}
                </span>
                {listing.condition && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-bg-surface text-text-muted border border-border">
                    {CONDITION_LABELS[listing.condition] || listing.condition}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border capitalize ${STATUS_STYLES[listing.status] || STATUS_STYLES.active}`}>
                  {listing.status}
                </span>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveToggle} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  isSaved
                    ? "bg-like/20 text-like border border-like/30"
                    : "bg-bg-surface text-text-secondary hover:text-text-primary border border-border hover:bg-surface"
                }`}>
                  <Bookmark
                    className="h-4 w-4"
                    fill={isSaved ? "currentColor" : "none"}
                    strokeWidth={2.5}
                  />
                  {isSaved ? "Saved" : "Save"}
                </button>

                <button onClick={handleDMSeller} disabled={dmLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-all disabled:opacity-40">
                  <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
                  {dmLoading ? "Opening..." : "DM Seller"}
                </button>
              </div>

              {!isOwner && (
                <button
                  onClick={() => setShowReport(true)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-text-secondary hover:text-like transition-colors"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Report Listing
                </button>
              )}

              {isOwner && (
                <div className="mt-4 space-y-2">
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => setShowEdit(true)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit Listing
                  </Button>

                  <div className="flex gap-2">
                    {listing.status === "active" && (
                      <>
                        <Button
                          variant="secondary"
                          className="flex-1 gap-1 text-[11px]"
                          onClick={() => setShowStatusConfirm("sold")}
                        >
                          <Tag className="h-3 w-3" />
                          Mark Sold
                        </Button>
                        <Button
                          variant="secondary"
                          className="flex-1 gap-1 text-[11px]"
                          onClick={() => setShowStatusConfirm("reserved")}
                        >
                          <Eye className="h-3 w-3" />
                          Mark Reserved
                        </Button>
                      </>
                    )}
                    {(listing.status === "sold" || listing.status === "reserved") && (
                      <Button
                        variant="secondary"
                        className="flex-1 gap-1 text-[11px]"
                        onClick={() => setShowStatusConfirm("active")}
                      >
                        <Tag className="h-3 w-3" />
                        Mark Available
                      </Button>
                    )}
                  </div>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2.5 text-sm font-bold rounded-xl bg-like/10 text-like border border-like/20 hover:bg-like/20 transition-all"
                  >
                    Delete Listing
                  </button>
                </div>
              )}
            </div>

            <div className="bg-bg-surface border border-border rounded-2xl p-5">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Seller</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shadow-md shrink-0">
                  <span className="text-lg font-bold text-text-inverse select-none">{getInitials(sellerName)}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{sellerName}</p>
                  {sellerFaculty && (
                    <p className="text-[11px] text-text-secondary font-medium">{sellerFaculty}{sellerYear ? ` · Year ${sellerYear}` : ""}</p>
                  )}
                </div>
              </div>

              {stars && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-amber-400 text-sm tracking-wider">{stars}</span>
                  <span className="text-xs text-text-muted">({listing.rating_count})</span>
                </div>
              )}

              {!isOwner && (
                <button onClick={() => setShowRatingForm(!showRatingForm)} className="w-full py-2 text-xs font-bold rounded-xl bg-bg-surface text-text-secondary hover:text-text-primary border border-border hover:bg-surface transition-all">
                  {showRatingForm ? "Cancel" : "Rate Seller"}
                </button>
              )}

              {showRatingForm && (
                <form onSubmit={handleSubmitRating} className="mt-4 space-y-3 p-4 rounded-xl bg-bg-surface/50 border border-border">
                  {ratingError && (
                    <div className="p-2 rounded-lg bg-like/10 border border-like/20 text-xs text-like">{ratingError}</div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-text-secondary block mb-2">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setRatingValue(star)} className={`text-xl transition-all ${star <= ratingValue ? "text-amber-400" : "text-text-muted hover:text-text-secondary"}`}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Write a review (optional)" value={ratingReview}
                    onChange={(e) => setRatingReview(e.target.value)}
                    className="w-full min-h-[60px] p-3 rounded-xl bg-bg-surface border border-border text-text-primary text-xs font-medium placeholder:text-text-muted resize-none outline-none focus:border-accent/50"
                  />
                  <Button type="submit" isLoading={isSubmittingRating} disabled={false} className="w-full text-xs">Submit Rating</Button>
                </form>
              )}
            </div>

            <div className="bg-bg-surface border border-border rounded-2xl p-5">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Details</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-text-secondary">Listed</span><span className="text-text-primary font-medium">{getRelativeTime(listing.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Views</span><span className="text-text-primary font-medium">{listing.view_count.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Status</span><span className="text-text-primary font-medium capitalize">{listing.status}</span></div>
                {listing.location && (
                  <div className="flex justify-between gap-3">
                    <span className="text-text-secondary shrink-0">Location</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent font-medium hover:underline text-right min-w-0"
                    >
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{listing.location}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-bg-surface border border-border rounded-3xl p-6 animate-pop-in text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Delete Listing?</h3>
            <p className="text-xs text-text-secondary mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {showStatusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-bg-surface border border-border rounded-3xl p-6 animate-pop-in text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2 capitalize">
              Mark as {showStatusConfirm}?
            </h3>
            <p className="text-xs text-text-secondary mb-6">
              {showStatusConfirm === "sold"
                ? "This listing will be marked as sold and hidden from search."
                : showStatusConfirm === "reserved"
                ? "This listing will be marked as reserved."
                : "This listing will be marked as available again."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setShowStatusConfirm(null)}>Cancel</Button>
              <Button onClick={() => handleStatusChange(showStatusConfirm)}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateListing
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onListingCreated={handleEditCreated}
        editListing={listing}
      />

      {showReport && (
        <ReportModal
          targetType="listing"
          targetId={listing.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
