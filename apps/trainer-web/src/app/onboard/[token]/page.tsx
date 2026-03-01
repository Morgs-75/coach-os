"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { clsx } from "clsx";

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

type Step = "personal" | "address" | "health" | "goals" | "waiver";
const STEPS: Step[] = ["personal", "address", "health", "goals", "waiver"];
const STEP_LABELS: Record<Step, string> = {
  personal: "Personal",
  address: "Address",
  health: "Health",
  goals: "Goals",
  waiver: "Waiver",
};

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  selectedGoals: string[];
  selectedConditions: string[];
  injuries: string;
  medications: string;
  dietaryRestrictions: string;
  emergencyName: string;
  emergencyPhone: string;
}

const DRAFT_KEY_PREFIX = "onboarding_draft_";

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
  const [step, setStep] = useState<Step>("personal");
  const [agreed, setAgreed] = useState(false);

  // Form state
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    selectedGoals: [],
    selectedConditions: [],
    injuries: "",
    medications: "",
    dietaryRestrictions: "",
    emergencyName: "",
    emergencyPhone: "",
  });

  const supabase = createClient();
  const draftKey = DRAFT_KEY_PREFIX + token;

  const updateForm = useCallback((updates: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  // Save draft to localStorage on form/step changes
  useEffect(() => {
    if (loading || completed || error) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ step, form, agreed }));
    } catch {}
  }, [form, step, agreed, loading, completed, error, draftKey]);

  useEffect(() => {
    loadOnboarding();
  }, [token]);

  async function loadOnboarding() {
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("onboarding_token", token)
      .single();

    if (clientError || !clientData) {
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

    // Pre-populate from existing client record
    const prefilled: Partial<FormData> = {};
    if (clientData.full_name) prefilled.fullName = clientData.full_name;
    if (clientData.email) prefilled.email = clientData.email;
    if (clientData.phone) prefilled.phone = clientData.phone;
    if (clientData.date_of_birth) prefilled.dateOfBirth = clientData.date_of_birth;
    if (clientData.gender) prefilled.gender = clientData.gender;
    if (clientData.address_line1) prefilled.addressLine1 = clientData.address_line1;
    if (clientData.address_line2) prefilled.addressLine2 = clientData.address_line2;
    if (clientData.city) prefilled.city = clientData.city;
    if (clientData.state) prefilled.state = clientData.state;
    if (clientData.postcode) prefilled.postcode = clientData.postcode;
    if (clientData.height_cm) prefilled.heightCm = String(clientData.height_cm);
    if (clientData.weight_kg) prefilled.weightKg = String(clientData.weight_kg);
    if (clientData.target_weight_kg) prefilled.targetWeightKg = String(clientData.target_weight_kg);
    if (clientData.goals?.length) prefilled.selectedGoals = clientData.goals;
    if (clientData.health_conditions?.length) prefilled.selectedConditions = clientData.health_conditions;
    if (clientData.emergency_contact_name) prefilled.emergencyName = clientData.emergency_contact_name;
    if (clientData.emergency_contact_phone) prefilled.emergencyPhone = clientData.emergency_contact_phone;

    // Try to restore draft from localStorage (overrides pre-fill)
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.form) {
          setForm({ ...form, ...prefilled, ...draft.form });
          if (draft.step && STEPS.includes(draft.step)) setStep(draft.step);
          if (typeof draft.agreed === "boolean") setAgreed(draft.agreed);
          setLoading(false);
          loadOrgData(clientData);
          return;
        }
      }
    } catch {}

    setForm(prev => ({ ...prev, ...prefilled }));

    loadOrgData(clientData);
    setLoading(false);
  }

  async function loadOrgData(clientData: any) {
    const { data: orgData } = await supabase
      .from("orgs")
      .select("name, waiver_template")
      .eq("id", clientData.org_id)
      .single();

    if (orgData) {
      setOrg(orgData);
      buildWaiverContent(orgData, clientData);
    }
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
    updateForm({
      selectedGoals: form.selectedGoals.includes(goal)
        ? form.selectedGoals.filter(g => g !== goal)
        : [...form.selectedGoals, goal],
    });
  }

  function toggleCondition(condition: string) {
    updateForm({
      selectedConditions: form.selectedConditions.includes(condition)
        ? form.selectedConditions.filter(c => c !== condition)
        : [...form.selectedConditions, condition],
    });
  }

  // Step validation
  function canProceed(): boolean {
    switch (step) {
      case "personal":
        return !!form.fullName.trim();
      case "address":
        return true; // Address is optional
      case "health":
        return true; // Health is optional
      case "goals":
        return !!form.emergencyName.trim() && !!form.emergencyPhone.trim();
      case "waiver":
        return !waiverContent || agreed;
      default:
        return true;
    }
  }

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function handleSubmit() {
    if (!canProceed()) return;
    setSubmitting(true);

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        full_name: form.fullName,
        email: form.email || null,
        phone: form.phone || null,
        date_of_birth: form.dateOfBirth || null,
        gender: form.gender || null,
        address_line1: form.addressLine1 || null,
        address_line2: form.addressLine2 || null,
        city: form.city || null,
        state: form.state || null,
        postcode: form.postcode || null,
        height_cm: form.heightCm ? parseFloat(form.heightCm) : null,
        weight_kg: form.weightKg ? parseFloat(form.weightKg) : null,
        target_weight_kg: form.targetWeightKg ? parseFloat(form.targetWeightKg) : null,
        goals: form.selectedGoals.length > 0 ? form.selectedGoals : null,
        health_conditions: form.selectedConditions.length > 0 ? form.selectedConditions : null,
        injuries: form.injuries ? form.injuries.split(",").map(s => s.trim()).filter(Boolean) : null,
        medications: form.medications ? form.medications.split(",").map(s => s.trim()).filter(Boolean) : null,
        dietary_restrictions: form.dietaryRestrictions ? form.dietaryRestrictions.split(",").map(s => s.trim()).filter(Boolean) : null,
        emergency_contact_name: form.emergencyName,
        emergency_contact_phone: form.emergencyPhone,
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
    await supabase.from("client_waivers").insert({
      org_id: client.org_id,
      client_id: client.id,
      name: "Onboarding Waiver",
      status: "signed",
      source: "onboarding",
      sent_at: new Date().toISOString(),
      signed_at: new Date().toISOString(),
    });

    // Notify coach via API
    try {
      await fetch("/api/onboard/notify-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, org_id: client.org_id }),
      });
    } catch {}

    // Clear draft
    try { localStorage.removeItem(draftKey); } catch {}

    setCompleted(true);
    setSubmitting(false);
  }

  // Render waiver content as formatted text
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

  const stepIndex = STEPS.indexOf(step);
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {org && <p className="text-sm text-gray-500 mb-1">{org.name}</p>}
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i <= stepIndex && setStep(s)}
                className={clsx(
                  "text-xs font-medium transition-colors",
                  i <= stepIndex ? "text-blue-600" : "text-gray-400",
                  i < stepIndex && "cursor-pointer hover:text-blue-800"
                )}
              >
                {STEP_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">

          {/* Step 1: Personal */}
          {step === "personal" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personal Details</h2>

              <div>
                <label className={labelCls}>Full Name *</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateForm({ fullName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.target.value })}
                  className={inputCls}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm({ phone: e.target.value })}
                  className={inputCls}
                  placeholder="04xx xxx xxx"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => updateForm({ dateOfBirth: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateForm({ gender: e.target.value })}
                    className={inputCls}
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
          )}

          {/* Step 2: Address */}
          {step === "address" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Address</h2>

              <div>
                <label className={labelCls}>Street Address</label>
                <input
                  type="text"
                  value={form.addressLine1}
                  onChange={(e) => updateForm({ addressLine1: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Address Line 2</label>
                <input
                  type="text"
                  value={form.addressLine2}
                  onChange={(e) => updateForm({ addressLine2: e.target.value })}
                  className={inputCls}
                  placeholder="Apt, unit, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateForm({ city: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select
                    value={form.state}
                    onChange={(e) => updateForm({ state: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">...</option>
                    {auStates.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Postcode</label>
                  <input
                    type="text"
                    value={form.postcode}
                    onChange={(e) => updateForm({ postcode: e.target.value })}
                    className={inputCls}
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Health */}
          {step === "health" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Health & Physical</h2>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Height (cm)</label>
                  <input
                    type="number"
                    value={form.heightCm}
                    onChange={(e) => updateForm({ heightCm: e.target.value })}
                    className={inputCls}
                    placeholder="170"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className={labelCls}>Weight (kg)</label>
                  <input
                    type="number"
                    value={form.weightKg}
                    onChange={(e) => updateForm({ weightKg: e.target.value })}
                    className={inputCls}
                    placeholder="75"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className={labelCls}>Target (kg)</label>
                  <input
                    type="number"
                    value={form.targetWeightKg}
                    onChange={(e) => updateForm({ targetWeightKg: e.target.value })}
                    className={inputCls}
                    placeholder="70"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Conditions</label>
                <div className="flex flex-wrap gap-2">
                  {healthConditions.map(condition => (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => toggleCondition(condition)}
                      className={clsx(
                        "px-3 py-2 rounded-full text-sm transition-colors",
                        form.selectedConditions.includes(condition)
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {condition}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Injuries (past or current)</label>
                <input
                  type="text"
                  value={form.injuries}
                  onChange={(e) => updateForm({ injuries: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., ACL tear 2020, shoulder impingement"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple with commas</p>
              </div>

              <div>
                <label className={labelCls}>Current Medications</label>
                <input
                  type="text"
                  value={form.medications}
                  onChange={(e) => updateForm({ medications: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., Metformin, Ventolin"
                />
              </div>

              <div>
                <label className={labelCls}>Dietary Restrictions / Allergies</label>
                <input
                  type="text"
                  value={form.dietaryRestrictions}
                  onChange={(e) => updateForm({ dietaryRestrictions: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., Vegetarian, Gluten-free"
                />
              </div>
            </div>
          )}

          {/* Step 4: Goals & Emergency Contact */}
          {step === "goals" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Goals</h2>
              <p className="text-sm text-gray-500">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {goalOptions.map(goal => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    className={clsx(
                      "px-3 py-2 rounded-full text-sm transition-colors",
                      form.selectedGoals.includes(goal)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {goal}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Emergency Contact *</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Contact Name *</label>
                    <input
                      type="text"
                      value={form.emergencyName}
                      onChange={(e) => updateForm({ emergencyName: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contact Phone *</label>
                    <input
                      type="tel"
                      value={form.emergencyPhone}
                      onChange={(e) => updateForm({ emergencyPhone: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Waiver */}
          {step === "waiver" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Waiver Agreement</h2>

              {waiverContent ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-700 text-sm leading-relaxed max-h-[40vh] overflow-y-auto border border-gray-100">
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
                      I, <strong>{form.fullName}</strong>, confirm that I have read, understood, and agree to all terms in this waiver.
                    </span>
                  </label>
                </>
              ) : (
                <p className="text-sm text-gray-500">No waiver required. You can proceed to complete your onboarding.</p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {stepIndex > 0 ? (
            <button
              onClick={goBack}
              className="text-sm text-gray-500 hover:text-gray-700 py-3 px-4"
            >
              &larr; Back
            </button>
          ) : (
            <div />
          )}

          {step === "waiver" ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="py-3 px-6 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors text-base"
            >
              {submitting ? "Submitting..." : "Complete Onboarding"}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="py-3 px-6 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors text-base"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
