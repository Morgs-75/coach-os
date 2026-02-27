"use client";

import { useState, useEffect } from "react";
import DraftReviewModal from "./DraftReviewModal";

export interface FeedbackItem {
  id: string;
  plan_id: string;
  meal_id: string | null;
  client_id: string;
  type: string;
  scope: string;
  comment: string | null;
  status: "pending" | "reviewed";
  ai_draft_food_item_id: string | null;
  ai_draft_qty_g: number | null;
  ai_draft_reasoning: string | null;
  created_at: string;
  plan: {
    id: string;
    name: string;
    version: number;
    client: {
      id: string;
      full_name: string | null;
    } | null;
  };
  meal: { id: string; meal_type: string; title: string | null } | null;
}

interface Props {
  orgId: string;
}

function clientDisplayName(
  client: { full_name: string | null } | null
): string {
  if (!client) return "Unknown";
  return client.full_name || "Unknown";
}

function formatScope(scope: string): string {
  switch (scope) {
    case "this_meal":
      return "This meal only";
    case "going_forward":
      return "Going forward";
    case "all_occurrences":
      return "All occurrences";
    default:
      return scope;
  }
}

function formatMealType(mealType: string): string {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1).replace(/_/g, " ");
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    substitution: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dislike: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    allergy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    other: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };
  const cls = styles[type] ?? styles.other;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {type}
    </span>
  );
}

export default function FeedbackInbox({ orgId }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function loadFeedback() {
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/feedback");
      if (res.ok) {
        const data = await res.json();
        setItems(data.feedback ?? []);
      } else {
        console.error("Failed to load feedback:", res.status);
      }
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback();
    // orgId is used by the parent to conditionally mount this component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function handleOpenModal(item: FeedbackItem) {
    setSelectedItem(item);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setSelectedItem(null);
  }

  function handleApproved() {
    setModalOpen(false);
    setSelectedItem(null);
    loadFeedback();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        <p className="text-3xl mb-3">📬</p>
        <p className="text-gray-500 dark:text-gray-400 font-medium">No pending feedback</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Client feedback from the nutrition portal will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Client
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plan
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Meal
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Scope
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Comment
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => {
              const hasDraft = !!item.ai_draft_food_item_id;
              const canDraft = !!item.meal_id;
              return (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Client */}
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {clientDisplayName(item.plan?.client ?? null)}
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <span>{item.plan?.name ?? "Unknown plan"}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                      v{item.plan?.version ?? 1}
                    </span>
                  </td>

                  {/* Meal */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {item.meal
                      ? formatMealType(item.meal.meal_type)
                      : "Plan-level"}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <TypeBadge type={item.type} />
                  </td>

                  {/* Scope */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {formatScope(item.scope)}
                  </td>

                  {/* Comment */}
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px]">
                    {item.comment ? (
                      <span
                        title={item.comment}
                        className="truncate block"
                      >
                        {item.comment.length > 60
                          ? `${item.comment.slice(0, 60)}…`
                          : item.comment}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600 italic text-xs">
                        No comment
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString("en-AU")}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {hasDraft ? (
                      <button
                        onClick={() => handleOpenModal(item)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-600 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                      >
                        Review Draft
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenModal(item)}
                        disabled={!canDraft}
                        title={
                          !canDraft
                            ? "AI draft requires meal-level feedback (no meal attached)"
                            : undefined
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Get AI Draft
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DraftReviewModal
        item={selectedItem}
        open={modalOpen}
        onClose={handleModalClose}
        onApproved={handleApproved}
      />
    </>
  );
}
