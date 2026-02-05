"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

type Client = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

const defaultTemplates: EmailTemplate[] = [
  {
    id: "newsletter",
    name: "Newsletter",
    subject: "Your Monthly Fitness Update",
    body: `Hi {first_name},

Here's your monthly fitness update with tips, news, and motivation to keep you on track!

[Your content here]

Keep pushing towards your goals!

Best regards,
{trainer_name}`,
  },
  {
    id: "tips",
    name: "Helpful Tips",
    subject: "Quick Fitness Tips for You",
    body: `Hi {first_name},

I wanted to share some quick tips that can help you get better results:

1. [Tip 1]
2. [Tip 2]
3. [Tip 3]

Try incorporating these into your routine this week!

Cheers,
{trainer_name}`,
  },
  {
    id: "offer",
    name: "Special Offer",
    subject: "Exclusive Offer Just for You!",
    body: `Hi {first_name},

I've got something special for you!

[Describe your offer]

This offer is available until [date]. Don't miss out!

Reply to this email or book your spot at [link].

See you soon,
{trainer_name}`,
  },
  {
    id: "custom",
    name: "Custom Email",
    subject: "",
    body: "",
  },
];

export default function EmailPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<string>("newsletter");
  const [subject, setSubject] = useState(defaultTemplates[0].subject);
  const [body, setBody] = useState(defaultTemplates[0].body);
  const [trainerName, setTrainerName] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get trainer profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (profile?.full_name) {
      setTrainerName(profile.full_name);
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Get clients with email addresses
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, full_name, email, status")
      .eq("org_id", membership.org_id)
      .eq("status", "active")
      .not("email", "is", null)
      .order("full_name");

    if (clientsData) {
      setClients(clientsData.filter(c => c.email)); // Only clients with email
    }

    setLoading(false);
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplate(templateId);
    const template = defaultTemplates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }

  function toggleClient(clientId: string) {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  }

  function handleSelectAll() {
    if (selectAll) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
    setSelectAll(!selectAll);
  }

  function getPreviewBody(client?: Client) {
    let preview = body;
    const firstName = client?.full_name?.split(" ")[0] || "[Name]";
    preview = preview.replace(/{first_name}/g, firstName);
    preview = preview.replace(/{trainer_name}/g, trainerName || "[Your Name]");
    return preview;
  }

  async function sendEmails() {
    if (selectedClients.length === 0) {
      alert("Please select at least one client");
      return;
    }

    if (!subject.trim() || !body.trim()) {
      alert("Please enter a subject and message");
      return;
    }

    setSending(true);

    try {
      // Send emails via API
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_ids: selectedClients,
          subject,
          body,
          trainer_name: trainerName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSent(true);
        alert(`Emails sent successfully to ${data.sent_count} client(s)!`);
        setSelectedClients([]);
        setSelectAll(false);
      } else {
        const error = await response.json();
        alert("Email service not configured yet.\n\nPreview:\n\nTo: " + selectedClients.length + " clients\nSubject: " + subject);
      }
    } catch (err) {
      // API not configured - show preview
      alert(
        `Email service not configured yet.\n\n` +
        `This would send to ${selectedClients.length} client(s):\n\n` +
        `Subject: ${subject}\n\n` +
        `Preview:\n${getPreviewBody(clients.find(c => c.id === selectedClients[0]))}`
      );
    }

    setSending(false);
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Email Distribution</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recipients */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Recipients</h2>

          {clients.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No clients with email addresses found.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded text-brand-600"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  Select All ({clients.length})
                </span>
              </label>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {clients.map((client) => (
                  <label
                    key={client.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => toggleClient(client.id)}
                      className="w-4 h-4 rounded text-brand-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {client.full_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {client.email}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{selectedClients.length}</span> selected
                </p>
              </div>
            </>
          )}
        </div>

        {/* Compose */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Template</h2>
            <div className="flex flex-wrap gap-2">
              {defaultTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateChange(template.id)}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedTemplate === template.id
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                  )}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Email Content */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Compose Email</h2>

            <div>
              <label className="label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Email subject..."
              />
            </div>

            <div>
              <label className="label">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input font-mono text-sm"
                rows={12}
                placeholder="Your email message..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use {"{first_name}"} for client's first name, {"{trainer_name}"} for your name
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Sending as: <span className="font-medium">{trainerName || "Unknown"}</span>
              </div>
              <button
                onClick={sendEmails}
                disabled={sending || selectedClients.length === 0}
                className="btn-primary"
              >
                {sending ? "Sending..." : `Send to ${selectedClients.length} Client${selectedClients.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {/* Preview */}
          {selectedClients.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Preview</h2>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span className="font-medium">Subject:</span> {subject}
                </p>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                    {getPreviewBody(clients.find(c => c.id === selectedClients[0]))}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
