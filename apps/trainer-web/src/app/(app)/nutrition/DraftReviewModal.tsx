"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FeedbackItem } from "./FeedbackInbox";

interface FoodSearchResult {
  id: string;
  food_name: string;
  food_group: string | null;
}

interface DraftData {
  food_item_id: string;
  food_item_name: string;
  qty_g: number;
  reasoning: string;
  component_id: string;
}

interface OriginalComponent {
  food_name: string;
  qty_g: number;
}

type ModalState =
  | "idle"
  | "drafting"
  | "draft_ready"
  | "approving"
  | "approved"
  | "rejected"
  | "error";

interface Props {
  item: FeedbackItem | null;
  open: boolean;
  onClose: () => void;
  onApproved: () => void;
}

export default function DraftReviewModal({ item, open, onClose, onApproved }: Props) {
  const [state, setState] = useState<ModalState>("idle");
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [originalComponent, setOriginalComponent] = useState<OriginalComponent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  // Edit overrides
  const [overrideQtyG, setOverrideQtyG] = useState<number | null>(null);
  const [overrideFoodItemId, setOverrideFoodItemId] = useState<string | null>(null);
  const [overrideFoodItemName, setOverrideFoodItemName] = useState<string | null>(null);

  // Food search
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [foodSearchResults, setFoodSearchResults] = useState<FoodSearchResult[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when item changes or modal opens
  useEffect(() => {
    if (!open || !item) {
      // Reset all state when modal closes
      setState("idle");
      setDraft(null);
      setOriginalComponent(null);
      setErrorMsg(null);
      setPublishedVersion(null);
      setOverrideQtyG(null);
      setOverrideFoodItemId(null);
      setOverrideFoodItemName(null);
      setFoodSearchQuery("");
      setFoodSearchResults([]);
      setEditOpen(false);
      return;
    }

    // If the item already has a draft, go to draft_ready and fetch details
    if (item.ai_draft_food_item_id) {
      setState("draft_ready");
      fetchFeedbackDetails(item.id);
    } else {
      setState("idle");
      setDraft(null);
      setOriginalComponent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const fetchFeedbackDetails = useCallback(async (feedbackId: string) => {
    try {
      const res = await fetch(`/api/nutrition/feedback/${feedbackId}`);
      if (!res.ok) return;
      const data = await res.json();
      const fb = data.feedback;
      if (!fb) return;

      // Set original component from first component of the meal
      const components: any[] = fb.meal?.components ?? [];
      const sorted = [...components].sort(
        (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const targetComp = sorted[0];
      if (targetComp) {
        setOriginalComponent({
          food_name: targetComp.food_item?.food_name ?? targetComp.custom_name ?? "Unknown",
          qty_g: targetComp.qty_g ?? 0,
        });
        // Build draft from ai_draft_* fields on the feedback row
        if (fb.ai_draft_food_item_id && fb.draft_food_item) {
          setDraft({
            food_item_id: fb.ai_draft_food_item_id,
            food_item_name: fb.draft_food_item.food_name,
            qty_g: fb.ai_draft_qty_g ?? 0,
            reasoning: fb.ai_draft_reasoning ?? "",
            component_id: targetComp.id,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch feedback details:", err);
    }
  }, []);

  // Food search with debounce
  useEffect(() => {
    if (!foodSearchQuery || foodSearchQuery.length < 2) {
      setFoodSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFoodSearchLoading(true);
      try {
        const res = await fetch(
          `/api/nutrition/foods?q=${encodeURIComponent(foodSearchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setFoodSearchResults(data.foods ?? []);
        }
      } catch {
        // silent
      } finally {
        setFoodSearchLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [foodSearchQuery]);

  async function handleGetDraft() {
    if (!item) return;
    setState("drafting");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/nutrition/feedback/${item.id}/draft`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Failed to generate AI draft");
        return;
      }
      const draftResult: DraftData = data.draft;
      setDraft(draftResult);

      // Fetch original component details
      await fetchFeedbackDetails(item.id);
      setState("draft_ready");
    } catch (err) {
      setState("error");
      setErrorMsg("Failed to connect to AI service");
    }
  }

  async function handleApprove() {
    if (!item || !draft) return;
    setState("approving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/nutrition/plans/${item.plan_id}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: draft.component_id,
          new_food_item_id: overrideFoodItemId ?? draft.food_item_id,
          new_qty_g: overrideQtyG ?? draft.qty_g,
          feedback_id: item.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Failed to publish new version");
        return;
      }
      setPublishedVersion(data.plan?.version ?? null);
      setState("approved");
    } catch {
      setState("error");
      setErrorMsg("Failed to publish new version");
    }
  }

  async function handleReject() {
    if (!item) return;
    try {
      await fetch(`/api/nutrition/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });
      setState("rejected");
    } catch {
      setState("error");
      setErrorMsg("Failed to mark as reviewed");
    }
  }

  function handleFoodSelect(result: FoodSearchResult) {
    setOverrideFoodItemId(result.id);
    setOverrideFoodItemName(result.food_name);
    setFoodSearchResults([]);
    setFoodSearchQuery("");
  }

  function clearFoodOverride() {
    setOverrideFoodItemId(null);
    setOverrideFoodItemName(null);
    setFoodSearchQuery("");
    setFoodSearchResults([]);
  }

  if (!open || !item) return null;

  const displayFoodName = overrideFoodItemName ?? draft?.food_item_name ?? "—";
  const displayQty = overrideQtyG ?? draft?.qty_g ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {state === "approved"
              ? "Version Published"
              : state === "rejected"
              ? "Feedback Reviewed"
              : "Review Feedback"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* ── IDLE STATE ── */}
        {state === "idle" && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 w-20 shrink-0">Type:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {item.type}
                </span>
              </div>
              {item.meal && (
                <div className="flex gap-2">
                  <span className="text-gray-500 dark:text-gray-400 w-20 shrink-0">Meal:</span>
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {item.meal.title
                      ? `${item.meal.meal_type} — ${item.meal.title}`
                      : item.meal.meal_type}
                  </span>
                </div>
              )}
              {item.comment && (
                <div className="flex gap-2">
                  <span className="text-gray-500 dark:text-gray-400 w-20 shrink-0">Comment:</span>
                  <span className="text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{item.comment}&rdquo;
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click below to ask Claude to suggest a food swap based on the client&rsquo;s feedback.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGetDraft}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Get AI Draft
              </button>
            </div>
          </div>
        )}

        {/* ── DRAFTING STATE ── */}
        {state === "drafting" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Claude is generating a suggestion&hellip;
            </p>
          </div>
        )}

        {/* ── DRAFT READY STATE ── */}
        {state === "draft_ready" && draft && (
          <div className="space-y-4">
            {/* Comparison table */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24" />
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Original
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      AI Suggestion
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Food</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {originalComponent?.food_name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {displayFoodName}
                      {overrideFoodItemName && (
                        <span className="ml-1.5 text-xs text-brand-600 dark:text-brand-400">
                          (edited)
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Qty</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {originalComponent?.qty_g ?? 0}g
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                      {displayQty}g
                      {overrideQtyG !== null && (
                        <span className="ml-1.5 text-xs text-brand-600 dark:text-brand-400">
                          (edited)
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reasoning */}
            {draft.reasoning && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-brand-400">
                {draft.reasoning}
              </div>
            )}

            {/* Edit override section — collapsible */}
            <div>
              <button
                onClick={() => setEditOpen((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <span
                  className={`inline-block transition-transform text-xs ${editOpen ? "rotate-90" : ""}`}
                >
                  &#9654;
                </span>
                Edit AI suggestion
              </button>

              {editOpen && (
                <div className="mt-3 space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {/* Qty override */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Override quantity (g)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      step={1}
                      placeholder={String(draft.qty_g)}
                      value={overrideQtyG ?? ""}
                      onChange={(e) =>
                        setOverrideQtyG(
                          e.target.value === "" ? null : Number(e.target.value) || null
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  {/* Food override */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Override food (search AFCD)
                    </label>

                    {/* Current override chip */}
                    {overrideFoodItemName && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs rounded-full flex items-center gap-1.5">
                          {overrideFoodItemName}
                          <button
                            onClick={clearFoodOverride}
                            className="hover:text-brand-900 dark:hover:text-brand-100 font-bold"
                            aria-label="Clear food override"
                          >
                            &#x2715;
                          </button>
                        </span>
                      </div>
                    )}

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search food name..."
                        value={foodSearchQuery}
                        onChange={(e) => setFoodSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                      {foodSearchLoading && (
                        <div className="absolute right-3 top-2.5">
                          <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}

                      {/* Dropdown results */}
                      {foodSearchResults.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {foodSearchResults.map((result) => (
                            <button
                              key={result.id}
                              onMouseDown={() => handleFoodSelect(result)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex flex-col"
                            >
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {result.food_name}
                              </span>
                              {result.food_group && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {result.food_group}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Approve &amp; Publish New Version
              </button>
            </div>
          </div>
        )}

        {/* ── APPROVING STATE ── */}
        {state === "approving" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Publishing new version&hellip;
            </p>
          </div>
        )}

        {/* ── APPROVED STATE ── */}
        {state === "approved" && (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">&#x2705;</div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              New version published!
            </p>
            {publishedVersion !== null && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version v{publishedVersion} is now live in the client portal.
              </p>
            )}
            <div className="pt-4">
              <button
                onClick={() => {
                  onApproved();
                  onClose();
                }}
                className="bg-brand-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── REJECTED STATE ── */}
        {state === "rejected" && (
          <div className="text-center py-6 space-y-3">
            <p className="text-gray-600 dark:text-gray-400">
              Feedback marked as reviewed.
            </p>
            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {state === "error" && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                {errorMsg ?? "An unexpected error occurred."}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setState(draft ? "draft_ready" : "idle")}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
