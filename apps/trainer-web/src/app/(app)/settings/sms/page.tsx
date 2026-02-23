"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_PRE_BODY =
  "Hi {{client_name}}, just a reminder your session is coming up at {{session_datetime}}. See you then!";
const DEFAULT_POST_BODY =
  "Hi {{client_name}}, great session today! You currently have {{sessions_remaining}} sessions remaining on your package, with {{sessions_booked}} sessions booked. Please let me know if there is anything you would like to adjust or work on specifically. Have a great day! {{coach_name}}";

interface Schedule {
  id: string;
  type: "pre_session" | "post_session";
  label: string;
  mins_offset: number;
  body: string;
  enabled: boolean;
}

function ScheduleCard({
  schedule,
  defaultBody,
  minsLabel,
  variableHint,
  saving,
  message,
  onChange,
  onSave,
  onDelete,
}: {
  schedule: Schedule;
  defaultBody: string;
  minsLabel: string;
  variableHint: string;
  saving: boolean;
  message: string;
  onChange: (updates: Partial<Schedule>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">On</span>
        </label>
        <input
          type="text"
          value={schedule.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label (e.g. 60 min reminder)"
          className="input flex-1 min-w-0 text-sm"
        />
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            min={1}
            max={10080}
            value={schedule.mins_offset}
            onChange={(e) => onChange({ mins_offset: Number(e.target.value) })}
            className="input w-20 text-sm text-center"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {minsLabel}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Message</label>
          {schedule.body !== defaultBody && (
            <button
              onClick={() => onChange({ body: defaultBody })}
              className="text-xs text-brand-600 hover:underline"
            >
              Revert to default
            </button>
          )}
        </div>
        <textarea
          value={schedule.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={3}
          className="input font-mono text-sm"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Variables: <code>{variableHint}</code>
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4">
        <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
          {saving ? "Saving..." : "Save"}
        </button>
        {message && (
          <span className={`text-sm ${message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SmsSettingsPage() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);

  // Master toggle
  const [enabled, setEnabled] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [enabledMessage, setEnabledMessage] = useState("");

  // Schedules
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const [addingType, setAddingType] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const { data: smsSettings } = await supabase
      .from("sms_settings")
      .select("enabled")
      .eq("org_id", membership.org_id)
      .maybeSingle();

    if (smsSettings) setEnabled(smsSettings.enabled ?? false);

    const { data: schedulesData } = await supabase
      .from("sms_schedules")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("type")
      .order("sort_order");

    if (schedulesData) setSchedules(schedulesData);

    setLoading(false);
  }

  async function saveEnabled() {
    setSavingEnabled(true);
    setEnabledMessage("");
    const { error } = await supabase
      .from("sms_settings")
      .upsert({ org_id: orgId, enabled }, { onConflict: "org_id" });
    setEnabledMessage(error ? "Failed to save" : "Saved!");
    setSavingEnabled(false);
    if (!error) setTimeout(() => setEnabledMessage(""), 3000);
  }

  function updateSchedule(id: string, updates: Partial<Schedule>) {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }

  async function saveSchedule(id: string) {
    const schedule = schedules.find((s) => s.id === id);
    if (!schedule) return;

    setSavingId(id);
    setMessageById((prev) => ({ ...prev, [id]: "" }));

    const { error } = await supabase
      .from("sms_schedules")
      .update({
        label: schedule.label,
        mins_offset: schedule.mins_offset,
        body: schedule.body,
        enabled: schedule.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setMessageById((prev) => ({ ...prev, [id]: error ? "Failed to save" : "Saved!" }));
    setSavingId(null);
    if (!error) setTimeout(() => setMessageById((prev) => ({ ...prev, [id]: "" })), 3000);
  }

  async function addSchedule(type: "pre_session" | "post_session") {
    setAddingType(type);
    const isPost = type === "post_session";
    const sortOrder = schedules.filter((s) => s.type === type).length;

    const { data, error } = await supabase
      .from("sms_schedules")
      .insert({
        org_id: orgId,
        type,
        label: isPost ? "90 min follow-up" : "60 min reminder",
        mins_offset: isPost ? 90 : 60,
        body: isPost ? DEFAULT_POST_BODY : DEFAULT_PRE_BODY,
        enabled: true,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (!error && data) setSchedules((prev) => [...prev, data]);
    setAddingType(null);
  }

  async function deleteSchedule(id: string) {
    await supabase.from("sms_schedules").delete().eq("id", id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;

  const preSchedules = schedules.filter((s) => s.type === "pre_session");
  const postSchedules = schedules.filter((s) => s.type === "post_session");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">SMS &amp; Reminders</h1>

      {/* SMS Enabled */}
      <div className="card p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">SMS Messaging</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-gray-700 dark:text-gray-300">Enable SMS messaging</span>
        </label>
        {!enabled && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            All automated SMS is currently paused.
          </p>
        )}
        <div className="flex items-center gap-4 mt-4">
          <button onClick={saveEnabled} disabled={savingEnabled} className="btn-primary">
            {savingEnabled ? "Saving..." : "Save"}
          </button>
          {enabledMessage && (
            <span className={enabledMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {enabledMessage}
            </span>
          )}
        </div>
      </div>

      {/* Session Reminders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session Reminders</h2>
          <button
            onClick={() => addSchedule("pre_session")}
            disabled={addingType === "pre_session"}
            className="btn-secondary text-sm"
          >
            {addingType === "pre_session" ? "Adding..." : "+ Add Reminder"}
          </button>
        </div>
        {preSchedules.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No reminders configured. Click &quot;+ Add Reminder&quot; to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {preSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                defaultBody={DEFAULT_PRE_BODY}
                minsLabel="min before"
                variableHint="{{client_name}}, {{session_datetime}}, {{location}}, {{coach_name}}"
                saving={savingId === schedule.id}
                message={messageById[schedule.id] || ""}
                onChange={(updates) => updateSchedule(schedule.id, updates)}
                onSave={() => saveSchedule(schedule.id)}
                onDelete={() => deleteSchedule(schedule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Follow-up Messages */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Follow-up Messages</h2>
          <button
            onClick={() => addSchedule("post_session")}
            disabled={addingType === "post_session"}
            className="btn-secondary text-sm"
          >
            {addingType === "post_session" ? "Adding..." : "+ Add Follow-up"}
          </button>
        </div>
        {postSchedules.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            No follow-ups configured. Click &quot;+ Add Follow-up&quot; to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {postSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                defaultBody={DEFAULT_POST_BODY}
                minsLabel="min after"
                variableHint="{{client_name}}, {{coach_name}}, {{feedback_link}}, {{sessions_remaining}}, {{sessions_booked}}"
                saving={savingId === schedule.id}
                message={messageById[schedule.id] || ""}
                onChange={(updates) => updateSchedule(schedule.id, updates)}
                onSave={() => saveSchedule(schedule.id)}
                onDelete={() => deleteSchedule(schedule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
