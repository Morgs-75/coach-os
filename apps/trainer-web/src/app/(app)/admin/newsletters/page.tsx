"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";
import {
  CONTENT_THEMES,
  AUDIENCE_TONES,
  type ContentTheme,
  type AudienceLevel,
  type NewsletterFrequency,
} from "@/lib/newsletter-generator";

interface Newsletter {
  id: string;
  subject: string;
  preheader: string;
  theme: ContentTheme;
  audience_level: AudienceLevel;
  frequency: NewsletterFrequency;
  sections: any[];
  call_to_action: { text: string; subtext: string };
  generated_at: string;
  status: "draft" | "approved" | "sent";
  angle_used: string;
}

export default function AdminNewslettersPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "sent">("all");

  // Generation options
  const [genTheme, setGenTheme] = useState<ContentTheme | "auto">("auto");
  const [genAudience, setGenAudience] = useState<AudienceLevel>("all");
  const [genFrequency, setGenFrequency] = useState<NewsletterFrequency>("weekly");

  const supabase = createClient();

  useEffect(() => {
    loadNewsletters();
  }, [filter]);

  async function loadNewsletters() {
    setLoading(true);
    const response = await fetch(
      `/api/newsletter/generate${filter !== "all" ? `?status=${filter}` : ""}`
    );
    if (response.ok) {
      const data = await response.json();
      setNewsletters(data.newsletters || []);
    }
    setLoading(false);
  }

  async function generateNewsletter() {
    setGenerating(true);
    try {
      const response = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: genTheme === "auto" ? undefined : genTheme,
          audienceLevel: genAudience,
          frequency: genFrequency,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedNewsletter(data.newsletter);
        loadNewsletters();
      } else {
        const error = await response.json();
        alert(`Generation failed: ${error.error}`);
      }
    } catch (error) {
      alert("Generation failed");
    }
    setGenerating(false);
  }

  async function updateStatus(id: string, status: "approved" | "sent") {
    await supabase
      .from("generated_newsletters")
      .update({ status })
      .eq("id", id);

    setNewsletters((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status } : n))
    );
    if (selectedNewsletter?.id === id) {
      setSelectedNewsletter({ ...selectedNewsletter, status });
    }
  }

  async function deleteNewsletter(id: string) {
    if (!confirm("Delete this newsletter?")) return;
    await supabase.from("generated_newsletters").delete().eq("id", id);
    setNewsletters((prev) => prev.filter((n) => n.id !== id));
    if (selectedNewsletter?.id === id) {
      setSelectedNewsletter(null);
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColors = {
    draft: "bg-gray-100 text-gray-700",
    approved: "bg-green-100 text-green-700",
    sent: "bg-blue-100 text-blue-700",
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Generator</h1>
          <p className="text-gray-500">AI-generated newsletters for PT business coaching</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Admin
        </Link>
      </div>

      {/* Generation Panel */}
      <div className="bg-gradient-to-br from-brand-50 to-purple-50 rounded-xl border border-brand-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Newsletter</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
            <select
              value={genTheme}
              onChange={(e) => setGenTheme(e.target.value as ContentTheme | "auto")}
              className="input"
            >
              <option value="auto">Auto (rotate themes)</option>
              {Object.entries(CONTENT_THEMES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              value={genAudience}
              onChange={(e) => setGenAudience(e.target.value as AudienceLevel)}
              className="input"
            >
              {Object.entries(AUDIENCE_TONES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={genFrequency}
              onChange={(e) => setGenFrequency(e.target.value as NewsletterFrequency)}
              className="input"
            >
              <option value="daily">Daily Dose (~300 words)</option>
              <option value="weekly">Weekly Wins (~800 words)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={generateNewsletter}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? "Generating..." : "Generate Newsletter"}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Uses Claude Sonnet + approved insights from the repository. Cost: ~$0.02-0.05 per generation.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["all", "draft", "approved", "sent"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Newsletter List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : newsletters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No newsletters yet. Generate your first one above.
            </div>
          ) : (
            newsletters.map((newsletter) => (
              <div
                key={newsletter.id}
                onClick={() => setSelectedNewsletter(newsletter)}
                className={clsx(
                  "bg-white rounded-xl border p-4 cursor-pointer transition-all",
                  selectedNewsletter?.id === newsletter.id
                    ? "border-brand-500 ring-2 ring-brand-100"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", statusColors[newsletter.status])}>
                    {newsletter.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(newsletter.generated_at)}
                  </span>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{newsletter.subject}</h3>
                <p className="text-sm text-gray-500 mb-2">{newsletter.preheader}</p>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded text-xs">
                    {CONTENT_THEMES[newsletter.theme]?.name || newsletter.theme}
                  </span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                    {AUDIENCE_TONES[newsletter.audience_level]?.name || newsletter.audience_level}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {newsletter.frequency}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Preview Panel */}
        {selectedNewsletter && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", statusColors[selectedNewsletter.status])}>
                {selectedNewsletter.status}
              </span>
              <div className="flex gap-2">
                {selectedNewsletter.status === "draft" && (
                  <button
                    onClick={() => updateStatus(selectedNewsletter.id, "approved")}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
                {selectedNewsletter.status === "approved" && (
                  <button
                    onClick={() => updateStatus(selectedNewsletter.id, "sent")}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Mark Sent
                  </button>
                )}
                <button
                  onClick={() => deleteNewsletter(selectedNewsletter.id)}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Email Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Email Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <p className="text-sm">
                  <span className="text-gray-500">Subject:</span>{" "}
                  <span className="font-medium text-gray-900">{selectedNewsletter.subject}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{selectedNewsletter.preheader}</p>
              </div>

              {/* Email Body */}
              <div className="p-6 space-y-6">
                {selectedNewsletter.sections.map((section, idx) => (
                  <div key={idx}>
                    {section.type === "headline" && (
                      <div className="text-xl font-bold text-gray-900">{section.content}</div>
                    )}
                    {section.type === "insight" && (
                      <div>
                        {section.title && (
                          <h3 className="font-semibold text-gray-900 mb-2">{section.title}</h3>
                        )}
                        <p className="text-gray-700 leading-relaxed">{section.content}</p>
                      </div>
                    )}
                    {section.type === "tip" && (
                      <div className="bg-brand-50 border-l-4 border-brand-500 p-4 rounded-r-lg">
                        {section.title && (
                          <p className="font-semibold text-brand-800 mb-1">{section.title}</p>
                        )}
                        <p className="text-brand-700">{section.content}</p>
                      </div>
                    )}
                    {section.type === "quote" && (
                      <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600">
                        {section.content}
                      </blockquote>
                    )}
                    {section.type === "action" && (
                      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                        <p className="font-semibold text-green-800 mb-1">
                          {section.title || "Action Step"}
                        </p>
                        <p className="text-green-700">{section.content}</p>
                      </div>
                    )}
                    {section.type === "story" && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {section.title && (
                          <p className="font-semibold text-gray-900 mb-2">{section.title}</p>
                        )}
                        <p className="text-gray-700">{section.content}</p>
                      </div>
                    )}
                    {section.type === "stat" && (
                      <div className="text-center py-4">
                        <p className="text-3xl font-bold text-brand-600">{section.title}</p>
                        <p className="text-gray-600">{section.content}</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* CTA */}
                {selectedNewsletter.call_to_action && (
                  <div className="text-center pt-6 border-t border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">
                      {selectedNewsletter.call_to_action.text}
                    </p>
                    <p className="text-sm text-gray-500">
                      {selectedNewsletter.call_to_action.subtext}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Meta Info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Theme: {CONTENT_THEMES[selectedNewsletter.theme]?.name} •
                Angle: {selectedNewsletter.angle_used} •
                Audience: {AUDIENCE_TONES[selectedNewsletter.audience_level]?.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
