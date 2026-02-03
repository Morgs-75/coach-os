"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const triggerTypes = [
  { value: "schedule", label: "Scheduled (runs daily)" },
  { value: "event", label: "Event-based" },
];

const eventTypes = [
  { value: "inactivity", label: "Client inactive for X days" },
  { value: "risk_red", label: "Client reaches red risk tier" },
  { value: "payment_failed", label: "Payment fails" },
];

const actionTypes = [
  { value: "send_message", label: "Send message to client" },
  { value: "send_push", label: "Send push notification" },
  { value: "notify_trainer", label: "Notify trainer" },
];

export default function NewAutomationPage() {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("event");
  const [eventType, setEventType] = useState("inactivity");
  const [inactivityDays, setInactivityDays] = useState("7");
  const [actionType, setActionType] = useState("send_message");
  const [messageBody, setMessageBody] = useState("Hey {{first_name}}, we miss you! Let's get back on track.");
  const [maxPerDay, setMaxPerDay] = useState("1");
  const [quietStart, setQuietStart] = useState("21");
  const [quietEnd, setQuietEnd] = useState("8");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setError("No organization found");
      setLoading(false);
      return;
    }

    const trigger = triggerType === "schedule"
      ? { type: "schedule", schedule: "daily" }
      : { type: "event", event: eventType };

    const conditions = eventType === "inactivity"
      ? [{ field: "days_since_activity", operator: "gte", value: parseInt(inactivityDays) }]
      : eventType === "risk_red"
      ? [{ field: "risk_tier", operator: "eq", value: "red" }]
      : [{ field: "subscription_status", operator: "eq", value: "past_due" }];

    const actions = [
      {
        type: actionType,
        params: actionType === "send_message" || actionType === "send_push"
          ? { body: messageBody, title: "Coach OS" }
          : { body: messageBody },
      },
    ];

    const guardrails = {
      max_per_client_per_day: parseInt(maxPerDay),
      quiet_hours_start: parseInt(quietStart),
      quiet_hours_end: parseInt(quietEnd),
      dedupe_hours: 24,
    };

    const { error: insertError } = await supabase.from("automations").insert({
      org_id: membership.org_id,
      name,
      enabled: true,
      trigger,
      conditions,
      actions,
      guardrails,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/automations");
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <Link href="/automations" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Back to Automations
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create Automation</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="card p-6">
          <label htmlFor="name" className="label">
            Automation Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g., Re-engage inactive clients"
            required
          />
        </div>

        {/* Trigger */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">When to trigger</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Trigger Type</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="input"
              >
                {triggerTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {triggerType === "event" && (
              <div>
                <label className="label">Event</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="input"
                >
                  {eventTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {eventType === "inactivity" && (
              <div>
                <label className="label">Days of inactivity</label>
                <input
                  type="number"
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(e.target.value)}
                  className="input w-24"
                  min="1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What to do</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Action</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="input"
              >
                {actionTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Message</label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="input"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables: {"{{name}}"}, {"{{first_name}}"}, {"{{days_inactive}}"}
              </p>
            </div>
          </div>
        </div>

        {/* Guardrails */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Guardrails</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Max per client per day</label>
              <input
                type="number"
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(e.target.value)}
                className="input"
                min="1"
              />
            </div>

            <div>
              <label className="label">Quiet hours (don't send)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="input w-16"
                  min="0"
                  max="23"
                />
                <span>to</span>
                <input
                  type="number"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="input w-16"
                  min="0"
                  max="23"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Automation"}
          </button>
          <Link href="/automations" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
