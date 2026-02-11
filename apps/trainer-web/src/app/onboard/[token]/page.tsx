"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

const goalOptions = [
  "Lose weight",
  "Build muscle",
  "Improve body composition",
  "Increase strength",
  "Improve endurance",
  "Improve flexibility",
  "Better energy levels",
  "Improve sleep",
  "Reduce stress",
  "Build healthy habits",
  "Sports performance",
];

const healthConditions = [
  "Diabetes (Type 1)",
  "Diabetes (Type 2)",
  "High blood pressure",
  "Heart condition",
  "Asthma",
  "Arthritis",
  "Back pain",
  "Joint issues",
  "Pregnancy",
  "Postpartum",
  "Thyroid condition",
  "None",
];

const auStates = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

export default function OnboardingPage() {
  const params = useParams();
  const token = params.token as string;

  const [client, setClient] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [waiverContent, setWaiverContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");

  // Physical
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");

  // Goals & Health
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [injuries, setInjuries] = useState("");
  const [medications, setMedications] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Waiver
  const [agreed, setAgreed] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadOnboarding();
  }, [token]);

  async function loadOnboarding() {
    // Find client by onboarding token
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("onboarding_token", token)
      .single();

    if (clientError || !clientData) {
      // Check if this token was already used (completed onboarding)
      setError("This onboarding link is no longer valid. It may have already been completed, or you can contact your trainer for a new link.");
      setLoading(false);
      return;
    }

    if (clientData.onboarding_completed_at) {
      setCompleted(true);
      setClient(clientData);
      setLoading(false);
      return;
    }

    setClient(clientData);
    setFullName(clientData.full_name || "");
    setEmail(clientData.email || "");

    // Load org + waiver template
    const { data: orgData } = await supabase
      .from("orgs")
      .select("name, waiver_template")
      .eq("id", clientData.org_id)
      .single();

    if (orgData) {
      setOrg(orgData);
      buildWaiverContent(orgData, clientData);
    }

    setLoading(false);
  }

  function buildWaiverContent(orgData: any, clientData: any) {
    let content = orgData.waiver_template || "";
    content = content.replace(/\{client_name\}/g, clientData?.full_name || "");
    content = content.replace(/\{client_dob\}/g, "");
    content = content.replace(/\{client_address\}/g, "");
    content = content.replace(/\{business_name\}/g, orgData.name || "");
    content = content.replace(/\{date\}/g, new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }));
    content = content.replace(/\[Trainer \/ Business Name\]/g, orgData.name || "");
    content = content.replace(/\[Full Name\]/g, clientData?.full_name || "");
    content = content.replace(/\[DOB\]/g, "");
    content = content.replace(/\[Address\]/g, "");
    content = content.replace(/\[Business address\]/g, "");
    setWaiverContent(content);
  }

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  function toggleCondition(condition: string) {
    setSelectedConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;
    if (!emergencyName || !emergencyPhone) {
      alert("Please fill in emergency contact details.");
      return;
    }

    setSubmitting(true);

    // Update client record with all form data + clear token
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        full_name: fullName,
        email: email || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postcode: postcode || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        target_weight_kg: targetWeightKg ? parseFloat(targetWeightKg) : null,
        goals: selectedGoals.length > 0 ? selectedGoals : null,
        health_conditions: selectedConditions.length > 0 ? selectedConditions : null,
        injuries: injuries ? injuries.split(",").map((s) => s.trim()).filter(Boolean) : null,
        medications: medications ? medications.split(",").map((s) => s.trim()).filter(Boolean) : null,
        dietary_restrictions: dietaryRestrictions ? dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean) : null,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_token: null,
      })
      .eq("onboarding_token", token);

    if (updateError) {
      alert("Failed to submit form. Please try again.");
      setSubmitting(false);
      return;
    }

    // Create signed waiver record
    const { error: waiverError } = await supabase
      .from("client_waivers")
      .insert({
        org_id: client.org_id,
        client_id: client.id,
        name: "Onboarding Waiver",
        status: "signed",
        source: "onboarding",
        sent_at: new Date().toISOString(),
        signed_at: new Date().toISOString(),
      });

    if (waiverError) {
      console.error("Waiver record creation failed:", waiverError);
      // Don't block - the client data was already saved
    }

    setCompleted(true);
    setSubmitting(false);
  }

  // Render waiver content as formatted text (matches sign-waiver page)
  function renderWaiverContent() {
    if (!waiverContent) return <p className="text-gray-400">No waiver template configured.</p>;

    return waiverContent.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-6 mb-2">{trimmed.slice(2)}</h1>;
      if (trimmed.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-5 mb-2">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("---")) return <hr key={i} className="my-4" />;
      if (trimmed.startsWith("- ")) return <li key={i} className="ml-6 list-disc">{renderInline(trimmed.slice(2))}</li>;
      return <p key={i} className="mb-1">{renderInline(trimmed)}</p>;
    });
  }

  function renderInline(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Onboarding Complete</h1>
          <p className="text-gray-500">
            Thank you for completing your onboarding form. Your trainer has been notified.
          </p>
          {org && <p className="text-sm text-gray-400 mt-4">{org.name}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {org && <p className="text-sm text-gray-500 mb-1">{org.name}</p>}
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-gray-600 mt-1">Please complete your details below to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personal Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Address</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Apt, unit, etc. (optional)"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {auStates.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Physical */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Physical (Optional)</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="170"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="75"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target (kg)</label>
                <input
                  type="number"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="70"
                />
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Goals</h2>
            <p className="text-sm text-gray-500">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {goalOptions.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedGoals.includes(goal)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          {/* Health */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Health Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Health Conditions</label>
              <div className="flex flex-wrap gap-2">
                {healthConditions.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedConditions.includes(condition)
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Injuries (past or current)</label>
              <input
                type="text"
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., ACL tear 2020, shoulder impingement"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple with commas</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
              <input
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Metformin, Ventolin"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple with commas</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions / Allergies</label>
              <input
                type="text"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple with commas</p>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Emergency Contact *</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone *</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Waiver */}
          {waiverContent && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Waiver Agreement</h2>

              <div className="bg-gray-50 rounded-lg p-6 text-gray-700 text-sm leading-relaxed max-h-[40vh] overflow-y-auto border border-gray-100">
                {renderWaiverContent()}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I, <strong>{fullName}</strong>, confirm that I have read, understood, and agree to all terms in this waiver. I sign this freely and voluntarily.
                </span>
              </label>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!fullName || !emergencyName || !emergencyPhone || (!waiverContent ? false : !agreed) || submitting}
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting..." : "Complete Onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}
