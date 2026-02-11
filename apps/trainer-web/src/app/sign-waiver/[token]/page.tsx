"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

export default function SignWaiverPage() {
  const params = useParams();
  const token = params.token as string;

  const [waiver, setWaiver] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [waiverContent, setWaiverContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadWaiver();
  }, [token]);

  async function loadWaiver() {
    // Find waiver by token
    const { data: waiverData, error: waiverError } = await supabase
      .from("client_waivers")
      .select("*")
      .eq("token", token)
      .single();

    if (waiverError || !waiverData) {
      setError("Waiver not found or link has expired.");
      setLoading(false);
      return;
    }

    if (waiverData.status === "signed") {
      setSigned(true);
      setWaiver(waiverData);

      // Load client details for confirmation screen
      const { data: signedClientData } = await supabase
        .from("clients")
        .select("full_name, email, phone")
        .eq("id", waiverData.client_id)
        .single();
      if (signedClientData) setClient(signedClientData);

      // Load org name
      const { data: signedOrgData } = await supabase
        .from("orgs")
        .select("name")
        .eq("id", waiverData.org_id)
        .single();
      if (signedOrgData) setOrg(signedOrgData);

      setLoading(false);
      return;
    }

    if (waiverData.expires_at && new Date(waiverData.expires_at) < new Date()) {
      setError("This waiver link has expired. Please contact your trainer for a new link.");
      setLoading(false);
      return;
    }

    setWaiver(waiverData);

    // Load client details
    const { data: clientData } = await supabase
      .from("clients")
      .select("full_name, email, phone, date_of_birth, address_line1, address_line2, city, state, postcode")
      .eq("id", waiverData.client_id)
      .single();

    if (clientData) setClient(clientData);

    // Load org + waiver template
    const { data: orgData } = await supabase
      .from("orgs")
      .select("name, waiver_template")
      .eq("id", waiverData.org_id)
      .single();

    if (orgData) {
      setOrg(orgData);

      // Fill in template placeholders
      const clientAddress = [
        clientData?.address_line1,
        clientData?.address_line2,
        clientData?.city,
        clientData?.state,
        clientData?.postcode,
      ].filter(Boolean).join(", ");

      const clientDob = clientData?.date_of_birth
        ? new Date(clientData.date_of_birth).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
        : "";

      let content = orgData.waiver_template || "";
      content = content.replace(/\{client_name\}/g, clientData?.full_name || "");
      content = content.replace(/\{client_dob\}/g, clientDob);
      content = content.replace(/\{client_address\}/g, clientAddress);
      content = content.replace(/\{business_name\}/g, orgData.name || "");
      content = content.replace(/\{date\}/g, new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }));
      // Also replace square-bracket style placeholders from the original template
      content = content.replace(/\[Trainer \/ Business Name\]/g, orgData.name || "");
      content = content.replace(/\[Full Name\]/g, clientData?.full_name || "");
      content = content.replace(/\[DOB\]/g, clientDob);
      content = content.replace(/\[Address\]/g, clientAddress);
      content = content.replace(/\[Business address\]/g, "");

      setWaiverContent(content);
    }

    setLoading(false);
  }

  async function handleSign() {
    if (!agreed) return;
    setSigning(true);

    const { error } = await supabase
      .from("client_waivers")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
      })
      .eq("token", token);

    if (error) {
      alert("Failed to sign waiver. Please try again.");
    } else {
      setSigned(true);
    }
    setSigning(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading waiver...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Waiver Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Waiver Signed</h1>
          <p className="text-gray-500">
            {waiver?.signed_at
              ? `Signed on ${new Date(waiver.signed_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} at ${new Date(waiver.signed_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`
              : "Your waiver has been recorded. Thank you!"}
          </p>
          {client && (
            <p className="text-sm text-gray-400 mt-2">
              Sent to: {client.phone || client.email || "—"}
            </p>
          )}
          {org && <p className="text-sm text-gray-400 mt-2">{org.name}</p>}
        </div>
      </div>
    );
  }

  // Render waiver content as simple formatted text
  const renderContent = () => {
    if (!waiverContent) return <p className="text-gray-400">No waiver template configured.</p>;

    return waiverContent.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-6 mb-2">{trimmed.slice(2)}</h1>;
      if (trimmed.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-5 mb-2">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("---")) return <hr key={i} className="my-4" />;
      if (trimmed.startsWith("- ")) return <li key={i} className="ml-6 list-disc">{renderInline(trimmed.slice(2))}</li>;
      if (trimmed.startsWith("**(")) return <p key={i} className="text-sm text-center italic">{renderInline(trimmed)}</p>;
      return <p key={i} className="mb-1">{renderInline(trimmed)}</p>;
    });
  };

  function renderInline(text: string) {
    // Simple bold handling
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {org && <p className="text-sm text-gray-500 mb-1">{org.name}</p>}
          <h1 className="text-2xl font-bold text-gray-900">Waiver Agreement</h1>
          {client && <p className="text-gray-600 mt-1">For: {client.full_name}</p>}
        </div>

        {/* Waiver Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6 text-gray-700 text-sm leading-relaxed max-h-[60vh] overflow-y-auto">
          {renderContent()}
        </div>

        {/* Agreement */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I, <strong>{client?.full_name}</strong>, confirm that I have read, understood, and agree to all terms in this waiver. I sign this freely and voluntarily.
            </span>
          </label>

          <button
            onClick={handleSign}
            disabled={!agreed || signing}
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {signing ? "Signing..." : "I Agree & Sign Waiver"}
          </button>
        </div>
      </div>
    </div>
  );
}
