"use client";

import { useState } from "react";
import { Meal } from "./NutritionView";

interface FeedbackDrawerProps {
  isOpen: boolean;
  meal: Meal | null;
  planId: string;
  token: string;
  primaryColor: string; // kept for backwards compatibility — not used for main styling
  onClose: () => void;
  onSuccess: () => void;
}

type FeedbackType = "substitution" | "dislike" | "allergy" | "portion" | "schedule" | "other";
type FeedbackScope = "this_meal" | "going_forward" | "all_occurrences";
type ForwardPreference = "yes" | "no" | "ask_me" | "";

type Status = "idle" | "submitting" | "success" | "error";

// --- Style tokens matching the HTML spec ---
const TEXT = "#eef0ff";
const MUTED = "rgba(238,240,255,0.70)";
const MUTED2 = "rgba(238,240,255,0.55)";
const BORDER_INPUT = "rgba(255,255,255,0.12)";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${BORDER_INPUT}`,
  background: "rgba(255,255,255,0.04)",
  color: TEXT,
  borderRadius: 14,
  padding: "10px 12px",
  outline: "none",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  fontSize: 13,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: MUTED,
  fontSize: 12,
  marginBottom: 6,
};

export default function FeedbackDrawer({
  isOpen,
  meal,
  planId,
  token,
  primaryColor: _primaryColor,
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
        meal_id: meal?.id || undefined,
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

  const mealLabel =
    meal && meal.meal_type && meal.meal_type !== "general"
      ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
      : null;

  const mealSubtitle = mealLabel
    ? `Feedback for ${mealLabel}${meal?.title ? ` — ${meal.title}` : ""}`
    : "Send one request at a time. Your coach will review and publish updates.";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 30,
        }}
      />

      {/* Right slide-in drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meal plan feedback"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(460px, 92vw)",
          background: "linear-gradient(180deg, rgba(15,18,48,.98), rgba(11,13,36,.98))",
          borderLeft: "1px solid rgba(255,255,255,.10)",
          boxShadow: "-30px 0 80px rgba(0,0,0,.55)",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: TEXT,
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(255,255,255,.10)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
              Meal plan feedback
            </h3>
            <div style={{ marginTop: 4, color: MUTED2, fontSize: 12, lineHeight: 1.45 }}>
              {mealSubtitle}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.04)",
              color: TEXT,
              borderRadius: 12,
              padding: "8px 10px",
              cursor: "pointer",
              fontSize: 13,
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {status === "success" ? (
          /* Success state — fills remaining space */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(74,222,128,0.15)",
                border: "1px solid rgba(74,222,128,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="rgba(74,222,128,0.9)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, color: TEXT, margin: "0 0 6px" }}>Thank you!</p>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Your coach has been notified.</p>
            <button
              onClick={handleSuccessClose}
              style={{
                marginTop: 24,
                padding: "10px 24px",
                borderRadius: 14,
                border: "1px solid rgba(255,179,74,.35)",
                background: "linear-gradient(180deg, rgba(255,179,74,.22), rgba(255,179,74,.10))",
                color: TEXT,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Close
            </button>
          </div>
        ) : (
          /* Form — flex column so footer stays at bottom */
          <form
            onSubmit={handleSubmit}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            {/* Scrollable form body */}
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              {/* Type + Applies to — two columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                    style={inputStyle}
                    required
                  >
                    <option value="substitution">Substitution</option>
                    <option value="dislike">Don&apos;t like</option>
                    <option value="allergy">Allergy / intolerance</option>
                    <option value="portion">Portion</option>
                    <option value="schedule">Schedule</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Applies to</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as FeedbackScope)}
                    style={inputStyle}
                    required
                  >
                    <option value="this_meal">This meal only</option>
                    <option value="going_forward">Going forward</option>
                    <option value="all_occurrences">All occurrences</option>
                  </select>
                </div>
              </div>

              {/* Comment */}
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Describe what you want changed. Be specific."
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                />
              </div>

              {/* Going forward */}
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Going forward</label>
                <select
                  value={forward}
                  onChange={(e) => setForward(e.target.value as ForwardPreference)}
                  style={inputStyle}
                >
                  <option value="">— Select —</option>
                  <option value="yes">Apply going forward</option>
                  <option value="no">This week only</option>
                  <option value="ask_me">Ask me</option>
                </select>
              </div>

              {/* Divider + info */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "12px 0" }} />
              <div style={{ color: MUTED2, fontSize: 12, lineHeight: 1.45 }}>
                <strong style={{ color: TEXT }}>What happens next:</strong> CoachOS will create a feedback ticket. AI may draft a proposed change. Your coach confirms before publishing.
              </div>

              {/* Error message */}
              {status === "error" && (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(251,113,133,0.35)",
                    background: "rgba(251,113,133,0.10)",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "#fb7185",
                  }}
                >
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Footer — submit + cancel */}
            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(255,255,255,.10)",
                display: "flex",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                style={{
                  flex: 1,
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.05)",
                  color: TEXT,
                  padding: "10px 12px",
                  borderRadius: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                style={{
                  flex: 1,
                  border: "1px solid rgba(255,179,74,.35)",
                  background: "linear-gradient(180deg, rgba(255,179,74,.22), rgba(255,179,74,.10))",
                  color: TEXT,
                  padding: "10px 12px",
                  borderRadius: 14,
                  fontWeight: 800,
                  cursor: status === "submitting" ? "not-allowed" : "pointer",
                  fontSize: 13,
                  opacity: status === "submitting" ? 0.6 : 1,
                }}
              >
                {status === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
