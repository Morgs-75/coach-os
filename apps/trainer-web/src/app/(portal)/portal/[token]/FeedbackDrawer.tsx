"use client";

import { useState } from "react";
import { Meal } from "./NutritionView";

interface FeedbackDrawerProps {
  isOpen: boolean;
  meal: Meal | null;
  planId: string;
  token: string;
  primaryColor: string;
  onClose: () => void;
  onSuccess: () => void;
}

type FeedbackType = "substitution" | "dislike" | "allergy" | "portion" | "schedule" | "other";
type FeedbackScope = "this_meal" | "going_forward" | "all_occurrences";
type ForwardPreference = "yes" | "no" | "ask_me" | "";

type Status = "idle" | "submitting" | "success" | "error";

export default function FeedbackDrawer({
  isOpen,
  meal,
  planId,
  token,
  primaryColor,
  onClose,
  onSuccess,
}: FeedbackDrawerProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("other");
  const [scope, setScope] = useState<FeedbackScope>("this_meal");
  const [comment, setComment] = useState("");
  const [forward, setForward] = useState<ForwardPreference>("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleClose() {
    // Reset state on close
    setStatus("idle");
    setErrorMsg("");
    setFeedbackType("other");
    setScope("this_meal");
    setComment("");
    setForward("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const body: Record<string, string | undefined> = {
        token,
        plan_id: planId,
        meal_id: meal?.id,
        type: feedbackType,
        scope,
        comment: comment.trim() || undefined,
        forward: forward || undefined,
      };

      const res = await fetch("/api/portal/nutrition/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to submit feedback. Please try again.");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  function handleSuccessClose() {
    setStatus("idle");
    setFeedbackType("other");
    setScope("this_meal");
    setComment("");
    setForward("");
    onSuccess();
  }

  if (!isOpen) return null;

  const mealLabel = meal?.meal_type
    ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
    : "Meal";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Bottom sheet panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Feedback for ${mealLabel}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 text-base">
            Feedback for {mealLabel}
            {meal?.title && (
              <span className="font-normal text-gray-500"> — {meal.title}</span>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Thank you!</p>
            <p className="text-sm text-gray-500 mt-1">Your coach has been notified.</p>
            <button
              onClick={handleSuccessClose}
              className="mt-5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type of feedback
              </label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
                required
              >
                <option value="substitution">Substitution request</option>
                <option value="dislike">I dislike this</option>
                <option value="allergy">Allergy concern</option>
                <option value="portion">Portion size</option>
                <option value="schedule">Scheduling issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                How does this affect you?
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as FeedbackScope)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-1"
                required
              >
                <option value="this_meal">Just this instance</option>
                <option value="going_forward">Going forward</option>
                <option value="all_occurrences">All occurrences</option>
              </select>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Comment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell your coach more (optional)"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-offset-1"
              />
            </div>

            {/* Forward preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Would you like your coach to act on this?{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={forward}
                onChange={(e) => setForward(e.target.value as ForwardPreference)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <option value="">— Select —</option>
                <option value="yes">Yes please</option>
                <option value="no">Not right now</option>
                <option value="ask_me">Ask me</option>
              </select>
            </div>

            {/* Error message */}
            {status === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              {status === "submitting" ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
