"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Users, Calendar, ShoppingBag, MessageCircle, ChevronRight, ChevronLeft, Check } from "lucide-react";

const STEPS = [
  {
    icon: BookOpen,
    title: "Academic Feed",
    description: "See posts from your faculty and clubs. Posts are filtered by faculty so you only see relevant content.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Users,
    title: "Clubs & Societies",
    description: "Join clubs, participate in events, and connect with like-minded students.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Calendar,
    title: "Events",
    description: "Discover campus events, RSVP, and never miss what's happening on campus.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy and sell textbooks, electronics, and more with fellow students.",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  {
    icon: MessageCircle,
    title: "Messaging",
    description: "Chat privately with other students. Share posts and collaborate in real-time.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Re-trigger reveal animation on step change
  }, [step]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function handleNext() {
    if (isLast) {
      router.push("/profile/setup");
    } else {
      setStep(step + 1);
    }
  }

  function handleSkip() {
    router.push("/profile/setup");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-14">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step
                  ? "w-8 bg-accent"
                  : i < step
                    ? "w-1.5 bg-accent/50"
                    : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div key={step} className="text-center mb-14 reveal-up">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${current.bg} mb-8`}>
            <current.icon className={`h-10 w-10 ${current.color}`} strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-display font-medium text-text-primary leading-tight mb-4">
            {current.title}
          </h1>
          <p className="font-sans text-body text-text-secondary leading-relaxed max-w-sm mx-auto">
            {current.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {!isFirst && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center justify-center w-12 h-12 rounded-xl border border-border-strong text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={handleNext}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground font-sans font-semibold hover:bg-accent-press transition-colors ${
              isFirst ? "" : ""
            }`}
          >
            {isLast ? (
              <>
                <Check className="h-5 w-5" />
                Set Up Profile
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>

        <button
          onClick={handleSkip}
          className="block w-full mt-5 text-center font-sans text-body-sm text-text-tertiary hover:text-text-secondary transition-colors py-2"
        >
          Skip introduction
        </button>
      </div>
    </div>
  );
}
