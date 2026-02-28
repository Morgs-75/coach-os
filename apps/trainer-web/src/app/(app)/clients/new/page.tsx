"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toE164 } from "@/lib/utils";

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

const experienceLevels = [
  { value: "beginner", label: "Beginner (0-1 years)" },
  { value: "intermediate", label: "Intermediate (1-3 years)" },
  { value: "advanced", label: "Advanced (3+ years)" },
];

const trainingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function NewClientPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Basic Info (required)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Optional Info
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

  // Training
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [timeWindows, setTimeWindows] = useState<{ day: string; start: string; end: string }[]>([]);
  const [newTimeWindow, setNewTimeWindow] = useState({ day: "monday", start: "06:00", end: "09:00" });

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

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

  function toggleDay(day: string) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function addTimeWindow() {
    if (newTimeWindow.day && newTimeWindow.start && newTimeWindow.end) {
      setTimeWindows([...timeWindows, { ...newTimeWindow }]);
      setNewTimeWindow({ day: "monday", start: "06:00", end: "09:00" });
    }
  }

  function removeTimeWindow(index: number) {
    setTimeWindows(timeWindows.filter((_, i) => i !== index));
  }

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

    const { data: client, error: insertError } = await supabase
      .from("clients")
      .insert({
        org_id: membership.org_id,
        full_name: fullName,
        email: email || null,
        phone: toE164(phone),
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
        injuries: injuries ? injuries.split(",").map((s) => s.trim()) : null,
        medications: medications ? medications.split(",").map((s) => s.trim()) : null,
        dietary_restrictions: dietaryRestrictions ? dietaryRestrictions.split(",").map((s) => s.trim()) : null,
        experience_level: experienceLevel,
        preferred_training_days: preferredDays.length > 0 ? preferredDays : null,
        preferred_time_windows: timeWindows.length > 0 ? timeWindows : null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        notes: notes || null,
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/clients/${client.id}`);
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <Link href="/clients" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 mb-4 inline-block">
        ← Back to Clients
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Add Client</h1>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Quick Add - Essential Fields */}
        <div className="card p-6 space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="John Smith"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Phone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="0412 345 678"
              required
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="john@example.com"
            />
          </div>

          {/* Quick Save Button */}
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!fullName || !phone || loading}
          >
            {loading ? "Creating..." : "Add Client"}
          </button>

          {/* Toggle for more options */}
          <button
            type="button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1"
          >
            {showMoreOptions ? "Hide" : "Show"} additional details
            <svg
              className={`w-4 h-4 transition-transform ${showMoreOptions ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Additional Details (collapsible) */}
        {showMoreOptions && (
          <div className="mt-4 space-y-4">
            {/* Personal Details */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Personal Details</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="input"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Address</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="input mb-2"
                  placeholder="Street address"
                />
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="input"
                  placeholder="Apt, unit, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="input"
                  >
                    <option value="">Select...</option>
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="WA">WA</option>
                    <option value="SA">SA</option>
                    <option value="TAS">TAS</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">NT</option>
                  </select>
                </div>
                <div>
                  <label className="label">Postcode</label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Physical & Training */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Physical & Training</h2>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Height (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="input"
                    placeholder="170"
                  />
                </div>
                <div>
                  <label className="label">Current Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="input"
                    placeholder="75"
                  />
                </div>
                <div>
                  <label className="label">Target Weight (kg)</label>
                  <input
                    type="number"
                    value={targetWeightKg}
                    onChange={(e) => setTargetWeightKg(e.target.value)}
                    className="input"
                    placeholder="70"
                  />
                </div>
              </div>

              <div>
                <label className="label">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="input"
                >
                  {experienceLevels.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Goals</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {goalOptions.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => toggleGoal(goal)}
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        selectedGoals.includes(goal)
                          ? "bg-brand-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Preferred Training Days</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {trainingDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        preferredDays.includes(day)
                          ? "bg-brand-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Preferred Time Windows</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Add specific times the client prefers to train</p>

                {/* Existing time windows */}
                {timeWindows.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {timeWindows.map((tw, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <span className="capitalize font-medium text-sm text-gray-700 dark:text-gray-300 w-20">{tw.day}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{tw.start} - {tw.end}</span>
                        <button
                          type="button"
                          onClick={() => removeTimeWindow(i)}
                          className="ml-auto text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new time window */}
                <div className="flex items-end gap-2">
                  <div>
                    <select
                      value={newTimeWindow.day}
                      onChange={(e) => setNewTimeWindow({ ...newTimeWindow, day: e.target.value })}
                      className="input text-sm py-1.5"
                    >
                      {trainingDays.map((day) => (
                        <option key={day} value={day.toLowerCase()}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="time"
                      value={newTimeWindow.start}
                      onChange={(e) => setNewTimeWindow({ ...newTimeWindow, start: e.target.value })}
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 pb-2">to</span>
                  <div>
                    <input
                      type="time"
                      value={newTimeWindow.end}
                      onChange={(e) => setNewTimeWindow({ ...newTimeWindow, end: e.target.value })}
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTimeWindow}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Health */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Health Information</h2>

              <div>
                <label className="label">Health Conditions</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {healthConditions.map((condition) => (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => toggleCondition(condition)}
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        selectedConditions.includes(condition)
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {condition}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Injuries (past or current)</label>
                <input
                  type="text"
                  value={injuries}
                  onChange={(e) => setInjuries(e.target.value)}
                  className="input"
                  placeholder="e.g., ACL tear 2020, shoulder impingement"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Separate multiple with commas</p>
              </div>

              <div>
                <label className="label">Current Medications</label>
                <input
                  type="text"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  className="input"
                  placeholder="e.g., Metformin, Ventolin"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Separate multiple with commas</p>
              </div>

              <div>
                <label className="label">Dietary Restrictions / Allergies</label>
                <input
                  type="text"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  className="input"
                  placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Separate multiple with commas</p>
              </div>
            </div>

            {/* Emergency & Notes */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Emergency Contact & Notes</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Any additional information about this client..."
                />
              </div>
            </div>

            {/* Save Button (at bottom of expanded section) */}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={!fullName || !phone || loading}
            >
              {loading ? "Creating..." : "Add Client"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
