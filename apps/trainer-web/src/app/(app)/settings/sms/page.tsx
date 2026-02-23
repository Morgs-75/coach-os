"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_REMINDER_BODY =
  "Hi {{client_name}}, just a reminder your session is coming up at {{session_datetime}}. See you then!";
const DEFAULT_FOLLOWUP_BODY =
  "Hi {{client_name}}, great session today! Looking forward to seeing you next time.";

export default function SmsSettingsPage() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);

  // Card 1 — SMS Enabled
  const [enabled, setEnabled] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [enabledMessage, setEnabledMessage] = useState("");

  // Card 2 — Session Reminders
  const [sendSessionReminders, setSendSessionReminders] = useState(true);
  const [reminderMinsBefore, setReminderMinsBefore] = useState(60);
  const [reminderBody, setReminderBody] = useState(DEFAULT_REMINDER_BODY);
  const [reminderTemplateId, setReminderTemplateId] = useState<string | null>(null);
  const [savingReminders, setSavingReminders] = useState(false);
  const [remindersMessage, setRemindersMessage] = useState("");

  // Card 3 — Follow-up Messages
  const [sendFeedbackRequests, setSendFeedbackRequests] = useState(true);
  const [feedbackMinsAfter, setFeedbackMinsAfter] = useState(90);
  const [followupBody, setFollowupBody] = useState(DEFAULT_FOLLOWUP_BODY);
  const [followupTemplateId, setFollowupTemplateId] = useState<string | null>(null);
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [followupMessage, setFollowupMessage] = useState("");

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
      .select("*")
      .eq("org_id", membership.org_id)
      .maybeSingle();

    if (smsSettings) {
      setEnabled(smsSettings.enabled ?? false);
      setSendSessionReminders(smsSettings.send_session_reminders ?? true);
      setReminderMinsBefore(smsSettings.reminder_mins_before ?? 60);
      setSendFeedbackRequests(smsSettings.send_feedback_requests ?? true);
      setFeedbackMinsAfter(smsSettings.feedback_mins_after ?? 90);
    }

    const { data: templates } = await supabase
      .from("sms_templates")
      .select("id, template_key, body")
      .eq("org_id", membership.org_id)
      .in("template_key", ["session_reminder", "feedback_request"]);

    if (templates) {
      const reminder = templates.find((t) => t.template_key === "session_reminder");
      const followup = templates.find((t) => t.template_key === "feedback_request");
      if (reminder) {
        setReminderBody(reminder.body);
        setReminderTemplateId(reminder.id);
      }
      if (followup) {
        setFollowupBody(followup.body);
        setFollowupTemplateId(followup.id);
      }
    }

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

  async function saveReminders() {
    setSavingReminders(true);
    setRemindersMessage("");

    const settingsError = (await supabase
      .from("sms_settings")
      .upsert(
        { org_id: orgId, send_session_reminders: sendSessionReminders, reminder_mins_before: reminderMinsBefore },
        { onConflict: "org_id" }
      )).error;

    let bodyError = null;
    if (reminderTemplateId) {
      bodyError = (await supabase
        .from("sms_templates")
        .update({ body: reminderBody, updated_at: new Date().toISOString() })
        .eq("id", reminderTemplateId)).error;
    }

    const error = settingsError || bodyError;
    setRemindersMessage(error ? "Failed to save" : "Saved!");
    setSavingReminders(false);
    if (!error) setTimeout(() => setRemindersMessage(""), 3000);
  }

  async function saveFollowup() {
    setSavingFollowup(true);
    setFollowupMessage("");

    const settingsError = (await supabase
      .from("sms_settings")
      .upsert(
        { org_id: orgId, send_feedback_requests: sendFeedbackRequests, feedback_mins_after: feedbackMinsAfter },
        { onConflict: "org_id" }
      )).error;

    let bodyError = null;
    if (followupTemplateId) {
      bodyError = (await supabase
        .from("sms_templates")
        .update({ body: followupBody, updated_at: new Date().toISOString() })
        .eq("id", followupTemplateId)).error;
    }

    const error = settingsError || bodyError;
    setFollowupMessage(error ? "Failed to save" : "Saved!");
    setSavingFollowup(false);
    if (!error) setTimeout(() => setFollowupMessage(""), 3000);
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">SMS &amp; Reminders</h1>

      {/* Card 1 — SMS Enabled */}
      <div className="card p-6 mb-6">
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
            All automated SMS (reminders and follow-ups) is currently paused.
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

      {/* Card 2 — Session Reminders */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Session Reminders</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendSessionReminders}
              onChange={(e) => setSendSessionReminders(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Send pre-session reminders</span>
          </label>

          {sendSessionReminders && (
            <div>
              <label className="label">Minutes before session</label>
              <input
                type="number"
                min={15}
                max={1440}
                value={reminderMinsBefore}
                onChange={(e) => setReminderMinsBefore(Number(e.target.value))}
                className="input w-32"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Message</label>
              {reminderBody !== DEFAULT_REMINDER_BODY && (
                <button
                  onClick={() => setReminderBody(DEFAULT_REMINDER_BODY)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Revert to default
                </button>
              )}
            </div>
            <textarea
              value={reminderBody}
              onChange={(e) => setReminderBody(e.target.value)}
              rows={3}
              className="input font-mono text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Variables: <code>{"{{client_name}}"}</code>, <code>{"{{session_datetime}}"}</code>, <code>{"{{location}}"}</code>, <code>{"{{coach_name}}"}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button onClick={saveReminders} disabled={savingReminders} className="btn-primary">
            {savingReminders ? "Saving..." : "Save"}
          </button>
          {remindersMessage && (
            <span className={remindersMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {remindersMessage}
            </span>
          )}
        </div>
      </div>

      {/* Card 3 — Follow-up Messages */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Follow-up Messages</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendFeedbackRequests}
              onChange={(e) => setSendFeedbackRequests(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Send follow-up messages after sessions</span>
          </label>

          {sendFeedbackRequests && (
            <div>
              <label className="label">Minutes after session ends</label>
              <input
                type="number"
                min={15}
                max={1440}
                value={feedbackMinsAfter}
                onChange={(e) => setFeedbackMinsAfter(Number(e.target.value))}
                className="input w-32"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Message</label>
              {followupBody !== DEFAULT_FOLLOWUP_BODY && (
                <button
                  onClick={() => setFollowupBody(DEFAULT_FOLLOWUP_BODY)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Revert to default
                </button>
              )}
            </div>
            <textarea
              value={followupBody}
              onChange={(e) => setFollowupBody(e.target.value)}
              rows={3}
              className="input font-mono text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Variables: <code>{"{{client_name}}"}</code>, <code>{"{{coach_name}}"}</code>, <code>{"{{feedback_link}}"}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button onClick={saveFollowup} disabled={savingFollowup} className="btn-primary">
            {savingFollowup ? "Saving..." : "Save"}
          </button>
          {followupMessage && (
            <span className={followupMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {followupMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
