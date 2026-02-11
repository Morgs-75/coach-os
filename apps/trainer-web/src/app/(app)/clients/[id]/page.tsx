"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import type { RiskTier, ActivityType } from "@/types";

const activityIcons: Record<ActivityType, string> = {
  weight: "⚖️",
  habit: "✅",
  workout: "💪",
  checkin: "📝",
};

const riskColors: Record<RiskTier, { bg: string; text: string; label: string }> = {
  green: { bg: "bg-green-100", text: "text-green-700", label: "Low Risk" },
  amber: { bg: "bg-amber-100", text: "text-amber-700", label: "At Risk" },
  red: { bg: "bg-red-100", text: "text-red-700", label: "High Risk" },
};

const measurementCategories = [
  { key: "body", label: "Body Composition" },
  { key: "circumference", label: "Circumference" },
  { key: "strength", label: "Strength" },
  { key: "cardio", label: "Cardio" },
  { key: "vitals", label: "Vitals" },
];

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calculateAge(dob: string) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  const [activities, setActivities] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [measurementTypes, setMeasurementTypes] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [clientPurchases, setClientPurchases] = useState<any[]>([]);
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "profile" | "health" | "activity" | "payments" | "packages" | "comms" | "logs" | "waivers" | "marketing">("overview");

  // Package form
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState("");
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);

  // Promo code
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [validatedPromo, setValidatedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState("");
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Edit package
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editPackageForm, setEditPackageForm] = useState({
    sessions_total: 0,
    sessions_used: 0,
    payment_status: "pending" as "pending" | "succeeded" | "failed",
    payment_method: "" as "" | "cash" | "card" | "bank_transfer" | "stripe",
    expires_at: "",
  });
  const [savingPackageEdit, setSavingPackageEdit] = useState(false);

  // Communications form
  const [showCommsForm, setShowCommsForm] = useState(false);
  const [commsForm, setCommsForm] = useState({
    type: "phone" as "phone" | "sms" | "email" | "in_person" | "note",
    subject: "",
    content: "",
    direction: "outbound" as "outbound" | "inbound",
  });
  const [savingComms, setSavingComms] = useState(false);

  // New measurement form
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [newMeasurement, setNewMeasurement] = useState({ type: "", value: "", notes: "" });
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  // Marketing
  const [referralLinks, setReferralLinks] = useState<any[]>([]);
  const [clientReferrals, setClientReferrals] = useState<any[]>([]);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [marketingPrefs, setMarketingPrefs] = useState({ email_opt_in: true, sms_opt_in: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(false);

  // Waivers
  const [waivers, setWaivers] = useState<any[]>([]);
  const [sendingWaiver, setSendingWaiver] = useState(false);
  const [waiverLink, setWaiverLink] = useState("");
  const [sendMethod, setSendMethod] = useState<"link" | "email" | "sms" | null>(null);

  // Onboarding
  const [sendingOnboarding, setSendingOnboarding] = useState(false);
  const [onboardingLink, setOnboardingLink] = useState("");

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [newTimeWindow, setNewTimeWindow] = useState({ day: "monday", start: "06:00", end: "09:00" });

  const supabase = createClient();

  const trainingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const goalOptions = [
    "Lose weight", "Build muscle", "Improve body composition", "Increase strength",
    "Improve endurance", "Improve flexibility", "Better energy levels", "Improve sleep",
    "Reduce stress", "Build healthy habits", "Sports performance",
  ];

  useEffect(() => {
    loadClient();
  }, [clientId]);

  async function loadClient() {
    // Get client details with related data
    const { data: clientData } = await supabase
      .from("clients")
      .select(`
        *,
        subscriptions(status, stripe_customer_id, manage_url, updated_at),
        client_risk(tier, score, reasons, as_of_date)
      `)
      .eq("id", clientId)
      .single();

    if (clientData) {
      setClient(clientData);

      // Get org name for waiver
      const { data: orgData } = await supabase
        .from("orgs")
        .select("name")
        .eq("id", clientData.org_id)
        .single();
      if (orgData) setOrgName(orgData.name);
    }

    // Get recent activity
    const { data: activityData } = await supabase
      .from("activity_events")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (activityData) setActivities(activityData);

    // Get messages
    const { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (thread) {
      const { data: messageData } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (messageData) setMessages(messageData);
    }

    // Get all payment history (including failed)
    const { data: paymentData } = await supabase
      .from("money_events")
      .select("*")
      .eq("client_id", clientId)
      .order("event_date", { ascending: false })
      .limit(50);

    if (paymentData) setPayments(paymentData);

    // Get measurements
    const { data: measurementData } = await supabase
      .from("client_measurements")
      .select("*")
      .eq("client_id", clientId)
      .order("measured_at", { ascending: false })
      .limit(100);

    if (measurementData) setMeasurements(measurementData);

    // Get measurement types
    const { data: typesData } = await supabase
      .from("measurement_types")
      .select("*")
      .order("sort_order");

    if (typesData) setMeasurementTypes(typesData);

    // Get user's org for offers
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (membership) {
        // Get available offers
        const { data: offersData, error: offersError } = await supabase
          .from("offers")
          .select("*")
          .eq("org_id", membership.org_id)
          .eq("is_active", true)
          .order("sort_order");

        if (offersError) {
          console.error("Error loading offers:", offersError);
        }
        if (offersData) {
          console.log("Loaded offers:", offersData);
          setOffers(offersData);
        }
      }
    }

    // Get client's purchases
    const { data: purchasesData } = await supabase
      .from("client_purchases")
      .select("*, offers(name, offer_type, sessions_included, bonus_sessions)")
      .eq("client_id", clientId)
      .order("purchased_at", { ascending: false });

    if (purchasesData) setClientPurchases(purchasesData);

    // Get communications log
    const { data: commsData } = await supabase
      .from("client_communications")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (commsData) setCommunications(commsData);

    // Get waivers
    const { data: waiversData } = await supabase
      .from("client_waivers")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (waiversData) setWaivers(waiversData);

    // Get referral data for this client
    if (clientData) {
      const { data: refLinks } = await supabase
        .from("referral_links")
        .select("*")
        .eq("org_id", clientData.org_id)
        .eq("is_active", true);
      if (refLinks) setReferralLinks(refLinks);

      const { data: refs } = await supabase
        .from("referrals")
        .select("*, referral_links(name, code)")
        .or(`referrer_client_id.eq.${clientId},referred_client_id.eq.${clientId}`)
        .order("created_at", { ascending: false });
      if (refs) setClientReferrals(refs);

      // Get sent newsletters
      const { data: nlData } = await supabase
        .from("generated_newsletters")
        .select("*")
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(10);
      if (nlData) setNewsletters(nlData);
    }

    setLoading(false);
  }

  async function sendWaiverToClient() {
    setSendingWaiver(true);
    setWaiverLink("");

    try {
      const res = await fetch("/api/send-waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert("Failed to send waiver: " + (data.error || "Unknown error"));
      } else {
        setWaiverLink(data.signing_url);
        setSendMethod("link");
        if (data.sms_sent) {
          alert("Waiver sent via SMS to " + (client?.phone || "client"));
        } else {
          alert("Waiver created. SMS could not be sent - you can share the link manually.");
        }
        loadClient();
      }
    } catch {
      alert("Failed to send waiver");
    }

    setSendingWaiver(false);
  }

  async function sendOnboardingForm() {
    setSendingOnboarding(true);
    setOnboardingLink("");

    try {
      const res = await fetch("/api/send-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert("Failed to send onboarding form: " + (data.error || "Unknown error"));
      } else {
        setOnboardingLink(data.onboarding_url);
        if (data.sms_sent) {
          alert("Onboarding form sent via SMS to " + (client?.phone || "client"));
        } else {
          alert("Onboarding link created. SMS could not be sent - you can share the link manually.");
        }
        loadClient();
      }
    } catch {
      alert("Failed to send onboarding form");
    }

    setSendingOnboarding(false);
  }

  async function revokeWaiver(waiverId: string) {
    if (!confirm("Are you sure you want to revoke this waiver? The signing link will no longer work.")) return;

    const { error } = await supabase
      .from("client_waivers")
      .update({ status: "expired" })
      .eq("id", waiverId);

    if (error) {
      alert("Failed to revoke waiver: " + error.message);
    } else {
      loadClient();
    }
  }

  async function revokeOnboarding() {
    if (!confirm("Are you sure you want to revoke this onboarding form? The link will no longer work.")) return;

    const { error } = await supabase
      .from("clients")
      .update({ onboarding_token: null })
      .eq("id", clientId);

    if (error) {
      alert("Failed to revoke onboarding: " + error.message);
    } else {
      setOnboardingLink("");
      loadClient();
    }
  }

  function downloadSignedWaiverPdf(waiver: any) {
    // Build the filled waiver content for PDF
    const clientAddress = [client?.address_line1, client?.address_line2, client?.city, client?.state, client?.postcode].filter(Boolean).join(", ");
    const clientDob = client?.date_of_birth
      ? new Date(client.date_of_birth).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const signedDate = waiver.signed_at
      ? new Date(waiver.signed_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
      : "";

    // Build HTML for PDF
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signed Waiver - ${client?.full_name}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; max-width: 700px; margin: 40px auto; color: #333; }
h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; }
h2 { text-align: center; font-size: 13pt; margin-top: 0; }
h3 { font-size: 12pt; margin-top: 24px; }
hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
ul { padding-left: 24px; }
.signed-badge { background: #d1fae5; color: #065f46; padding: 8px 16px; border-radius: 8px; display: inline-block; font-weight: bold; margin: 16px 0; }
.signature-block { margin-top: 32px; border-top: 2px solid #333; padding-top: 16px; }
.sig-row { display: flex; justify-content: space-between; margin-top: 24px; }
.sig-col { width: 45%; }
</style></head><body>
<div class="signed-badge">SIGNED: ${signedDate}</div>
<h1>BOXING PERSONAL TRAINING & SPARRING</h1>
<h2>WAIVER, ASSUMPTION OF RISK & RELEASE</h2>
<p style="text-align:center">(Australia)</p>
<hr>
<h3>1. Parties</h3>
<p>This Waiver is entered into between:</p>
<p><strong>Trainer:</strong> ${orgName}</p>
<p>and</p>
<p><strong>Participant:</strong> ${client?.full_name}<br>
<strong>Date of Birth:</strong> ${clientDob}<br>
<strong>Address:</strong> ${clientAddress}</p>
<hr>
<h3>2. Nature of Training Activities</h3>
<p>I acknowledge that I am voluntarily participating in boxing-related training activities, which may include:</p>
<ul><li>Boxing technique and skills training</li><li>Pad work, bag work, and conditioning</li><li>Strength, mobility, and cardiovascular exercises</li><li><strong>Controlled sparring or contact drills (where agreed and supervised)</strong></li></ul>
<p>I understand that sparring is <strong>not mandatory</strong>, but may occur as part of training.</p>
<hr>
<h3>3. Acknowledgment of High-Risk Activities</h3>
<p>I acknowledge that boxing, and particularly sparring or contact training, is a <strong>high-risk physical activity</strong>.</p>
<p>Risks include, but are not limited to:</p>
<ul><li>Cuts, bruises, fractures, and musculoskeletal injuries</li><li>Head injury, concussion, or neurological injury</li><li>Loss of consciousness</li><li>Serious or permanent injury</li><li>Death</li></ul>
<p>I fully understand these risks and <strong>choose to participate voluntarily</strong>.</p>
<hr>
<h3>4. Assumption of Risk</h3>
<p>I voluntarily assume <strong>all risks</strong>, whether known or unknown, associated with participation in boxing training and sparring.</p>
<hr>
<h3>5. Health Declaration</h3>
<p>I declare that I am physically and medically fit to participate and have disclosed all relevant medical conditions.</p>
<hr>
<h3>6. Illness, Injury & Symptoms</h3>
<p>I agree <strong>not to participate</strong> if I am sick, injured, or unwell.</p>
<hr>
<h3>7. Alcohol, Drugs & Medication</h3>
<p>I declare that I am not under the influence of alcohol, recreational drugs, or illicit substances.</p>
<hr>
<h3>8. Release & Indemnity</h3>
<p>To the fullest extent permitted by Australian law, I release and discharge the Trainer from all claims arising from my participation.</p>
<hr>
<h3>9. Australian Consumer Law</h3>
<p>Nothing in this Waiver excludes rights that cannot be excluded under the <strong>Australian Consumer Law</strong>.</p>
<hr>
<h3>10. Payment Terms & No Refund Policy</h3>
<p>All sessions must be paid in advance. All payments are strictly non-refundable.</p>
<hr>
<h3>11-15. Additional Terms</h3>
<p>Group training responsibilities, minor requirements, personal responsibility, photography consent, and governing law (Australia) apply as per full waiver terms.</p>
<hr>
<div class="signature-block">
<h3>16. Acknowledgment & Signature</h3>
<p>I confirm that I have read and understood this Waiver and agree freely and voluntarily.</p>
<div class="sig-row">
<div class="sig-col">
<p><strong>Participant:</strong> ${client?.full_name}</p>
<p><strong>Agreed digitally:</strong> ${signedDate}</p>
</div>
<div class="sig-col">
<p><strong>Trainer:</strong> ${orgName}</p>
</div>
</div>
</div>
</body></html>`;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }

  async function saveCommunication() {
    if (!commsForm.content.trim()) return;
    setSavingComms(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingComms(false);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setSavingComms(false);
      return;
    }

    const { data, error } = await supabase
      .from("client_communications")
      .insert({
        org_id: membership.org_id,
        client_id: clientId,
        user_id: user.id,
        type: commsForm.type,
        direction: commsForm.direction,
        subject: commsForm.subject || null,
        content: commsForm.content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving communication:", error);
      alert("Error saving: " + (error.message || JSON.stringify(error)));
    } else if (data) {
      setCommunications([data, ...communications]);
      setCommsForm({ type: "phone", subject: "", content: "", direction: "outbound" });
      setShowCommsForm(false);
    }

    setSavingComms(false);
  }

  async function startVideoCall() {
    try {
      // Create a Daily.co room for this session
      const response = await fetch("/api/video/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_name: client?.full_name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Open video call in new tab
        window.open(data.room_url, "_blank");

        // Log the video call in communications
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: membership } = await supabase
            .from("org_members")
            .select("org_id")
            .eq("user_id", user.id)
            .single();

          if (membership) {
            const { data: commData } = await supabase
              .from("client_communications")
              .insert({
                org_id: membership.org_id,
                client_id: clientId,
                user_id: user.id,
                type: "video",
                direction: "outbound",
                subject: "Video Call",
                content: `Video call started. Room: ${data.room_url}`,
              })
              .select()
              .single();

            if (commData) {
              setCommunications([commData, ...communications]);
            }
          }
        }
      } else {
        // Fallback: Generate a simple room name and use Daily.co prebuilt
        const roomName = `coach-${clientId.slice(0, 8)}-${Date.now()}`;
        const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || "your-domain";
        const roomUrl = `https://${dailyDomain}.daily.co/${roomName}`;

        // Copy link and show instructions
        const useRoom = confirm(
          `Video call room created!\n\nRoom link: ${roomUrl}\n\nClick OK to:\n1. Open the video call\n2. Copy the link to send to your client`
        );

        if (useRoom) {
          navigator.clipboard?.writeText(roomUrl);
          window.open(roomUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Error starting video call:", err);
      alert("Could not start video call. Please check your Daily.co configuration.");
    }
  }

  function startEditingProfile() {
    setEditForm({
      full_name: client.full_name || "",
      email: client.email || "",
      phone: client.phone || "",
      date_of_birth: client.date_of_birth || "",
      gender: client.gender || "",
      address_line1: client.address_line1 || "",
      address_line2: client.address_line2 || "",
      city: client.city || "",
      state: client.state || "",
      postcode: client.postcode || "",
      height_cm: client.height_cm || "",
      weight_kg: client.weight_kg || "",
      target_weight_kg: client.target_weight_kg || "",
      experience_level: client.experience_level || "beginner",
      goals: client.goals || [],
      preferred_training_days: client.preferred_training_days || [],
      preferred_time_windows: client.preferred_time_windows || [],
      emergency_contact_name: client.emergency_contact_name || "",
      emergency_contact_phone: client.emergency_contact_phone || "",
      notes: client.notes || "",
      health_conditions: client.health_conditions || [],
      injuries: Array.isArray(client.injuries) ? client.injuries.join(", ") : (client.injuries || ""),
      medications: Array.isArray(client.medications) ? client.medications.join(", ") : (client.medications || ""),
      dietary_restrictions: Array.isArray(client.dietary_restrictions) ? client.dietary_restrictions.join(", ") : (client.dietary_restrictions || ""),
    });
    setIsEditingProfile(true);
  }

  async function saveProfile() {
    setSavingProfile(true);

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: editForm.full_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        date_of_birth: editForm.date_of_birth || null,
        gender: editForm.gender || null,
        address_line1: editForm.address_line1 || null,
        address_line2: editForm.address_line2 || null,
        city: editForm.city || null,
        state: editForm.state || null,
        postcode: editForm.postcode || null,
        height_cm: editForm.height_cm ? parseFloat(editForm.height_cm) : null,
        weight_kg: editForm.weight_kg ? parseFloat(editForm.weight_kg) : null,
        target_weight_kg: editForm.target_weight_kg ? parseFloat(editForm.target_weight_kg) : null,
        experience_level: editForm.experience_level,
        goals: editForm.goals.length > 0 ? editForm.goals : null,
        preferred_training_days: editForm.preferred_training_days.length > 0 ? editForm.preferred_training_days : null,
        preferred_time_windows: editForm.preferred_time_windows.length > 0 ? editForm.preferred_time_windows : null,
        emergency_contact_name: editForm.emergency_contact_name || null,
        emergency_contact_phone: editForm.emergency_contact_phone || null,
        notes: editForm.notes || null,
        health_conditions: editForm.health_conditions.length > 0 ? editForm.health_conditions : null,
        injuries: editForm.injuries ? editForm.injuries.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
        medications: editForm.medications ? editForm.medications.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
        dietary_restrictions: editForm.dietary_restrictions ? editForm.dietary_restrictions.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
      })
      .eq("id", clientId);

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      setClient({ ...client, ...editForm });
      setIsEditingProfile(false);
    }

    setSavingProfile(false);
  }

  function toggleEditGoal(goal: string) {
    const goals = editForm.goals || [];
    setEditForm({
      ...editForm,
      goals: goals.includes(goal) ? goals.filter((g: string) => g !== goal) : [...goals, goal]
    });
  }

  function toggleEditDay(day: string) {
    const days = editForm.preferred_training_days || [];
    setEditForm({
      ...editForm,
      preferred_training_days: days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day]
    });
  }

  function addEditTimeWindow() {
    const windows = editForm.preferred_time_windows || [];
    setEditForm({
      ...editForm,
      preferred_time_windows: [...windows, { ...newTimeWindow }]
    });
    setNewTimeWindow({ day: "monday", start: "06:00", end: "09:00" });
  }

  function removeEditTimeWindow(index: number) {
    const windows = editForm.preferred_time_windows || [];
    setEditForm({
      ...editForm,
      preferred_time_windows: windows.filter((_: any, i: number) => i !== index)
    });
  }

  async function saveMeasurement() {
    if (!newMeasurement.type || !newMeasurement.value) return;
    setSavingMeasurement(true);

    const selectedType = measurementTypes.find((t) => t.name === newMeasurement.type);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    const { data, error } = await supabase
      .from("client_measurements")
      .insert({
        org_id: membership.org_id,
        client_id: clientId,
        measurement_type: newMeasurement.type,
        value: parseFloat(newMeasurement.value),
        unit: selectedType?.unit || "",
        notes: newMeasurement.notes || null,
      })
      .select()
      .single();

    if (!error && data) {
      setMeasurements([data, ...measurements]);
      setNewMeasurement({ type: "", value: "", notes: "" });
      setShowMeasurementForm(false);
    }

    setSavingMeasurement(false);
  }

  async function sendPaymentLink() {
    if (!selectedOffer || !client) return;
    setSendingPaymentLink(true);

    const offer = offers.find((o) => o.id === selectedOffer);
    if (!offer) {
      setSendingPaymentLink(false);
      return;
    }

    const priceFormatted = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(offer.price_cents / 100);

    // Generate payment link message
    const message = `Hi ${client.full_name?.split(" ")[0]}, here's your payment link for ${offer.name} (${priceFormatted}):\n\n[Payment Link]\n\nThanks!`;

    // For now, show the message - in production this would integrate with Stripe Payment Links
    try {
      // TODO: Create Stripe Payment Link and send via SMS/email
      const response = await fetch("/api/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          offer_id: selectedOffer,
          client_email: client.email,
          client_phone: client.phone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Payment link sent to ${client.phone || client.email}!\n\nLink: ${data.payment_link || "[Payment Link]"}`);
      } else {
        // Show preview for now
        alert(`Payment link feature coming soon.\n\nPreview message:\n${message}`);
      }
    } catch (err) {
      // API not configured - show preview
      alert(`Payment link feature coming soon.\n\nPreview message:\n${message}`);
    }

    setSendingPaymentLink(false);
    setShowPackageForm(false);
    setSelectedOffer("");
  }

  async function validatePromoCode() {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    setPromoError("");
    setValidatedPromo(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setValidatingPromo(false); return; }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) { setValidatingPromo(false); return; }

    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("org_id", membership.org_id)
      .eq("code", promoCodeInput.toUpperCase().trim())
      .eq("is_active", true)
      .single();

    if (error || !promo) {
      setPromoError("Invalid promo code");
      setValidatingPromo(false);
      return;
    }

    // Check expiry
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      setPromoError("This promo code has expired");
      setValidatingPromo(false);
      return;
    }

    // Check not started yet
    if (promo.valid_from && new Date(promo.valid_from) > new Date()) {
      setPromoError("This promo code is not yet active");
      setValidatingPromo(false);
      return;
    }

    // Check usage limit
    if (promo.max_uses && promo.times_used >= promo.max_uses) {
      setPromoError("This promo code has reached its usage limit");
      setValidatingPromo(false);
      return;
    }

    setValidatedPromo(promo);
    setValidatingPromo(false);
  }

  function clearPromo() {
    setPromoCodeInput("");
    setValidatedPromo(null);
    setPromoError("");
  }

  function calculateDiscount(priceCents: number) {
    if (!validatedPromo) return 0;
    if (validatedPromo.discount_type === "percentage") {
      return Math.round(priceCents * (validatedPromo.discount_value / 100));
    }
    return Math.round(validatedPromo.discount_value * 100); // fixed amount stored as dollars
  }

  async function incrementPromoUsage(promoId: string) {
    await supabase
      .from("promo_codes")
      .update({ times_used: (validatedPromo?.times_used || 0) + 1 })
      .eq("id", promoId);
  }

  async function savePackagePending() {
    if (!selectedOffer || !client) return;
    setSendingPaymentLink(true);

    const offer = offers.find((o) => o.id === selectedOffer);
    if (!offer) {
      setSendingPaymentLink(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    let expiresAt = null;
    if (offer.pack_validity_days) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + offer.pack_validity_days);
      expiresAt = expiry.toISOString();
    }

    const totalSessions = (offer.sessions_included || 0) + (offer.bonus_sessions || 0);

    const discountCents = calculateDiscount(offer.price_cents);
    const finalPrice = offer.price_cents - discountCents;

    const insertData: any = {
      org_id: membership.org_id,
      client_id: clientId,
      offer_id: selectedOffer,
      amount_paid_cents: finalPrice,
      currency: offer.currency || "aud",
      sessions_total: totalSessions,
      sessions_used: 0,
      expires_at: expiresAt,
      payment_status: "pending",
    };

    if (validatedPromo) {
      insertData.promo_code_id = validatedPromo.id;
      insertData.discount_cents = discountCents;
    }

    const { data, error } = await supabase
      .from("client_purchases")
      .insert(insertData)
      .select("*, offers(name, offer_type, sessions_included, bonus_sessions)")
      .single();

    if (error) {
      alert("Error saving package: " + (error.message || JSON.stringify(error)));
    } else if (data) {
      if (validatedPromo) await incrementPromoUsage(validatedPromo.id);
      setClientPurchases([data, ...clientPurchases]);
      const discountMsg = discountCents > 0 ? `\nDiscount: -$${(discountCents / 100).toFixed(2)}` : "";
      alert(`${offer.name} saved for ${client.full_name}.${discountMsg}\n\nStatus: Pending Payment`);
    }

    setSendingPaymentLink(false);
    setShowPackageForm(false);
    setSelectedOffer("");
    clearPromo();
  }

  function openEditPackage(purchase: any) {
    setShowPackageForm(false);
    setSelectedOffer("");
    setEditingPackage(purchase);
    setEditPackageForm({
      sessions_total: purchase.sessions_total || 0,
      sessions_used: purchase.sessions_used || 0,
      payment_status: purchase.payment_status || "pending",
      payment_method: purchase.payment_method || "",
      expires_at: purchase.expires_at ? purchase.expires_at.split("T")[0] : "",
    });
  }

  async function savePackageEdit() {
    if (!editingPackage) return;
    setSavingPackageEdit(true);

    const updateData: any = {
      sessions_total: editPackageForm.sessions_total,
      sessions_used: editPackageForm.sessions_used,
      payment_status: editPackageForm.payment_status,
    };

    if (editPackageForm.payment_method) {
      updateData.payment_method = editPackageForm.payment_method;
    }

    if (editPackageForm.expires_at) {
      updateData.expires_at = new Date(editPackageForm.expires_at).toISOString();
    } else {
      updateData.expires_at = null;
    }

    const { data, error } = await supabase
      .from("client_purchases")
      .update(updateData)
      .eq("id", editingPackage.id)
      .select("*, offers(name, offer_type, sessions_included, bonus_sessions)")
      .single();

    if (error) {
      alert("Error updating package: " + (error.message || JSON.stringify(error)));
    } else if (data) {
      setClientPurchases(clientPurchases.map(p => p.id === data.id ? data : p));
      setEditingPackage(null);
    }

    setSavingPackageEdit(false);
  }

  async function assignPackageDirectly(paymentMethod: "cash" | "card" | "bank_transfer") {
    if (!selectedOffer || !client) return;
    setSendingPaymentLink(true);

    const offer = offers.find((o) => o.id === selectedOffer);
    if (!offer) {
      setSendingPaymentLink(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Calculate expiry date if pack has validity
    let expiresAt = null;
    if (offer.pack_validity_days) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + offer.pack_validity_days);
      expiresAt = expiry.toISOString();
    }

    const totalSessions = (offer.sessions_included || 0) + (offer.bonus_sessions || 0);

    const paymentLabels: Record<string, string> = {
      cash: "Cash",
      card: "Card",
      bank_transfer: "Bank Transfer",
    };

    const discountCents = calculateDiscount(offer.price_cents);
    const finalPrice = offer.price_cents - discountCents;

    const insertData: any = {
      org_id: membership.org_id,
      client_id: clientId,
      offer_id: selectedOffer,
      amount_paid_cents: finalPrice,
      currency: offer.currency || "aud",
      sessions_total: totalSessions,
      sessions_used: 0,
      expires_at: expiresAt,
      payment_status: "succeeded",
      payment_method: paymentMethod,
    };

    if (validatedPromo) {
      insertData.promo_code_id = validatedPromo.id;
      insertData.discount_cents = discountCents;
    }

    const { data, error } = await supabase
      .from("client_purchases")
      .insert(insertData)
      .select("*, offers(name, offer_type, sessions_included, bonus_sessions)")
      .single();

    if (error) {
      alert("Error assigning package: " + (error.message || JSON.stringify(error)));
    } else if (data) {
      if (validatedPromo) await incrementPromoUsage(validatedPromo.id);
      setClientPurchases([data, ...clientPurchases]);
      const discountMsg = discountCents > 0 ? `\nDiscount: -$${(discountCents / 100).toFixed(2)}` : "";
      alert(`${offer.name} assigned to ${client.full_name}!${discountMsg}\n\nPayment: ${paymentLabels[paymentMethod]}`);
    }

    setSendingPaymentLink(false);
    setShowPackageForm(false);
    setSelectedOffer("");
    clearPromo();
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  if (!client) {
    return <div className="text-gray-500 dark:text-gray-400">Client not found</div>;
  }

  const today = new Date().toISOString().split("T")[0];
  const subscription = client.subscriptions?.[0];
  const todayRisk = client.client_risk?.find((r: any) => r.as_of_date === today);
  const riskConfig = todayRisk ? riskColors[todayRisk.tier as RiskTier] : null;

  // Payment stats
  const failedPayments = payments.filter((p) => p.payment_status === "failed" || p.type === "FAILED");
  const successfulPayments = payments.filter((p) => p.type === "INCOME" && p.payment_status !== "failed");
  const totalPaid = successfulPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

  // Group measurements by type for display
  const measurementsByType = measurements.reduce((acc, m) => {
    if (!acc[m.measurement_type]) acc[m.measurement_type] = [];
    acc[m.measurement_type].push(m);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div>
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 mb-2 inline-block">
          ← Back to Clients
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {client.avatar_path ? (
              <img src={client.avatar_path} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xl font-semibold">
                {client.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{client.full_name}</h1>
              <p className="text-gray-500 dark:text-gray-400">{client.email}</p>
              {client.date_of_birth && (
                <p className="text-sm text-gray-400">
                  {calculateAge(client.date_of_birth)} years old
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {riskConfig && (
              <span className={clsx("px-3 py-1 rounded-full text-sm font-medium", riskConfig.bg, riskConfig.text)}>
                {riskConfig.label}
              </span>
            )}
            <button
              onClick={startVideoCall}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video Call
            </button>
            <Link href={`/clients/${clientId}/messages`} className="btn-secondary">
              Message
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "profile", label: "Profile" },
            { key: "health", label: "Health" },
            { key: "comms", label: "Communications" },
            { key: "logs", label: "Logs & Measurements" },
            { key: "packages", label: "Packages" },
            { key: "payments", label: "Payments" },
            { key: "waivers", label: "Waivers" },
            { key: "marketing", label: "Marketing" },
            { key: "activity", label: "Activity" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={clsx(
                "py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
              )}
            >
              {tab.label}
              {tab.key === "payments" && failedPayments.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {failedPayments.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Risk Alert */}
            {todayRisk && todayRisk.tier !== "green" && (
              <div className={clsx(
                "card p-6",
                todayRisk.tier === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
              )}>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Risk Factors</h2>
                <ul className="space-y-1">
                  {todayRisk.reasons?.map((reason: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300">• {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Failed Payments Alert */}
            {failedPayments.length > 0 && (
              <div className="card p-6 border-red-200 bg-red-50">
                <h2 className="font-semibold text-red-800 mb-2">Payment Issues</h2>
                <p className="text-sm text-red-700 mb-3">
                  {failedPayments.length} failed payment{failedPayments.length > 1 ? "s" : ""} require attention.
                </p>
                <button
                  onClick={() => setActiveTab("payments")}
                  className="text-sm font-medium text-red-700 hover:text-red-800"
                >
                  View Payment History →
                </button>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {client.weight_kg ? `${client.weight_kg} kg` : "—"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Weight</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {client.target_weight_kg ? `${client.target_weight_kg} kg` : "—"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Target Weight</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  ${(totalPaid / 100).toFixed(0)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
              </div>
            </div>

            {/* Goals */}
            {client.goals && client.goals.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Goals</h3>
                <div className="flex flex-wrap gap-2">
                  {client.goals.map((goal: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm">
                      {goal}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Measurements */}
            {measurements.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Measurements</h3>
                  <button onClick={() => setActiveTab("logs")} className="text-sm text-brand-600 hover:text-brand-700">
                    View all
                  </button>
                </div>
                <div className="space-y-2">
                  {measurements.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300">{m.measurement_type}</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{m.value} {m.unit}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatDate(m.measured_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Subscription */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Subscription</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className={clsx(
                    "font-medium capitalize",
                    subscription?.status === "active" && "text-green-600",
                    subscription?.status === "past_due" && "text-red-600",
                    (!subscription || subscription?.status === "canceled" || subscription?.status === "none") && "text-gray-500 dark:text-gray-400"
                  )}>
                    {subscription?.status?.replace("_", " ") ?? "None"}
                  </dd>
                </div>
              </dl>
              {subscription?.manage_url && (
                <a href={subscription.manage_url} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full mt-4">
                  Manage in Stripe
                </a>
              )}
            </div>

            {/* Contact */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Contact</h3>
              <dl className="space-y-3">
                {client.phone && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd><a href={`tel:${client.phone}`} className="text-brand-600 hover:underline">{client.phone}</a></dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Member Since</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(client.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Emergency Contact */}
            {client.emergency_contact_name && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Emergency Contact</h3>
                <p className="font-medium text-gray-900 dark:text-gray-100">{client.emergency_contact_name}</p>
                {client.emergency_contact_phone && (
                  <a href={`tel:${client.emergency_contact_phone}`} className="text-brand-600 hover:underline">
                    {client.emergency_contact_phone}
                  </a>
                )}
              </div>
            )}

            {/* Onboarding Status */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Onboarding</h3>
              {client.onboarding_completed_at ? (
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Completed
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {formatDate(client.onboarding_completed_at)}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    {client.onboarding_token ? "Pending" : "Not Sent"}
                  </span>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={sendOnboardingForm}
                      disabled={sendingOnboarding}
                      className="btn-primary flex-1"
                    >
                      {sendingOnboarding ? "Sending..." : "Send Onboarding Form"}
                    </button>
                    {client.onboarding_token && (
                      <button
                        onClick={revokeOnboarding}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                  {onboardingLink && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Share this link:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={onboardingLink}
                          className="input flex-1 text-xs bg-white dark:bg-gray-800"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(onboardingLink)}
                          className="px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">${(totalPaid / 100).toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Successful Payments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{successfulPayments.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Failed Payments</p>
              <p className={clsx("text-2xl font-bold", failedPayments.length > 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100")}>
                {failedPayments.length}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Subscription Status</p>
              <p className={clsx(
                "text-2xl font-bold capitalize",
                subscription?.status === "active" ? "text-green-600" : "text-gray-500 dark:text-gray-400"
              )}>
                {subscription?.status || "None"}
              </p>
            </div>
          </div>

          {/* Failed Payments Section */}
          {failedPayments.length > 0 && (
            <div className="card border-red-200">
              <div className="px-6 py-4 border-b border-red-200 bg-red-50">
                <h3 className="font-semibold text-red-800">Failed Payments</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {failedPayments.map((payment) => (
                  <div key={payment.id} className="px-6 py-4 bg-red-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          ${(payment.amount_cents / 100).toFixed(2)} {payment.currency?.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(payment.event_date)}</p>
                        {payment.failure_reason && (
                          <p className="text-sm text-red-600 mt-1">{payment.failure_reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                          Failed
                        </span>
                        {payment.retry_count > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {payment.retry_count} retry attempt{payment.retry_count > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Payment History */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Payment History</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {payments.length > 0 ? (
                payments.map((payment) => {
                  const isFailed = payment.payment_status === "failed" || payment.type === "FAILED";
                  const isRefund = payment.type === "REFUND";
                  return (
                    <div key={payment.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {isRefund ? "Refund" : "Payment"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(payment.event_date)}</p>
                        {payment.stripe_invoice_id && (
                          <p className="text-xs text-gray-400">Invoice: {payment.stripe_invoice_id}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={clsx(
                          "font-medium",
                          isFailed ? "text-red-600" : isRefund ? "text-orange-600" : "text-green-600"
                        )}>
                          {isRefund ? "-" : ""}${(payment.amount_cents / 100).toFixed(2)}
                        </p>
                        <span className={clsx(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium mt-1",
                          isFailed ? "bg-red-100 text-red-700" :
                          isRefund ? "bg-orange-100 text-orange-700" :
                          "bg-green-100 text-green-700"
                        )}>
                          {isFailed ? "Failed" : isRefund ? "Refunded" : "Succeeded"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No payment history</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "packages" && (
        <div className="space-y-6">
          {/* Add Package Button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Packages & Session Packs</h2>
            <button
              onClick={() => {
                setEditingPackage(null);
                setShowPackageForm(true);
              }}
              className="btn-primary"
            >
              + Add Package
            </button>
          </div>

          {/* Edit Package Form */}
          {editingPackage && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Edit Package: {editingPackage.offers?.name || "Package"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Sessions Total</label>
                  <input
                    type="number"
                    min="0"
                    value={editPackageForm.sessions_total}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, sessions_total: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Sessions Used</label>
                  <input
                    type="number"
                    min="0"
                    max={editPackageForm.sessions_total}
                    value={editPackageForm.sessions_used}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, sessions_used: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Payment Status</label>
                  <select
                    value={editPackageForm.payment_status}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, payment_status: e.target.value as any })}
                    className="input"
                  >
                    <option value="pending">Pending</option>
                    <option value="succeeded">Paid</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select
                    value={editPackageForm.payment_method}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, payment_method: e.target.value as any })}
                    className="input"
                  >
                    <option value="">Not specified</option>
                    <option value="stripe">Stripe</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card (Manual)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Expiry Date</label>
                  <input
                    type="date"
                    value={editPackageForm.expires_at}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, expires_at: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank for no expiry</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={savePackageEdit}
                  disabled={savingPackageEdit}
                  className="btn-primary"
                >
                  {savingPackageEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setEditingPackage(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Package Form */}
          {showPackageForm && !editingPackage && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Package</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Select Package</label>
                  <select
                    value={selectedOffer}
                    onChange={(e) => setSelectedOffer(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose a package...</option>
                    {offers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.name} - ${(offer.price_cents / 100).toFixed(2)}
                        {offer.sessions_included ? ` (${offer.sessions_included + (offer.bonus_sessions || 0)} sessions)` : ""}
                        {offer.offer_type === "subscription" ? " (Subscription)" : ""}
                        {offer.offer_type === "single_session" ? " (Single)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOffer && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    {(() => {
                      const offer = offers.find(o => o.id === selectedOffer);
                      if (!offer) return null;
                      const discountCents = calculateDiscount(offer.price_cents);
                      const finalPrice = offer.price_cents - discountCents;
                      return (
                        <div className="space-y-2">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{offer.name}</p>
                          {discountCents > 0 ? (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-through">
                                ${(offer.price_cents / 100).toFixed(2)}
                              </p>
                              <p className="text-2xl font-bold text-green-600">
                                ${(finalPrice / 100).toFixed(2)}
                              </p>
                              <p className="text-sm text-green-600">
                                You save ${(discountCents / 100).toFixed(2)}
                                {validatedPromo?.discount_type === "percentage" && ` (${validatedPromo.discount_value}% off)`}
                              </p>
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              ${(offer.price_cents / 100).toFixed(2)}
                            </p>
                          )}
                          {offer.sessions_included && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {offer.sessions_included + (offer.bonus_sessions || 0)} sessions
                              {offer.bonus_sessions > 0 && ` (${offer.bonus_sessions} bonus)`}
                            </p>
                          )}
                          {offer.pack_validity_days && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Valid for {offer.pack_validity_days} days
                            </p>
                          )}
                          {offer.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{offer.description}</p>
                          )}
                          {offer.included_items && offer.included_items.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {offer.included_items.map((item: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Promo Code */}
                {selectedOffer && (
                  <div>
                    <label className="label">Promo Code</label>
                    {validatedPromo ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-mono font-medium text-green-700 dark:text-green-400">{validatedPromo.code}</span>
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {validatedPromo.discount_type === "percentage"
                            ? `${validatedPromo.discount_value}% off`
                            : `$${validatedPromo.discount_value} off`}
                        </span>
                        <button
                          type="button"
                          onClick={clearPromo}
                          className="ml-auto text-sm text-gray-500 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              validatePromoCode();
                            }
                          }}
                          className="input flex-1 font-mono"
                          placeholder="Enter promo code"
                        />
                        <button
                          type="button"
                          onClick={validatePromoCode}
                          disabled={!promoCodeInput.trim() || validatingPromo}
                          className="btn-secondary"
                        >
                          {validatingPromo ? "Checking..." : "Apply"}
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <p className="text-sm text-red-600 mt-1">{promoError}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => savePackagePending()}
                    disabled={!selectedOffer || sendingPaymentLink}
                    className="btn-primary"
                  >
                    {sendingPaymentLink ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={sendPaymentLink}
                    disabled={!selectedOffer || sendingPaymentLink}
                    className="btn-secondary"
                  >
                    Send Payment Link
                  </button>
                  <button
                    onClick={() => assignPackageDirectly("cash")}
                    disabled={!selectedOffer || sendingPaymentLink}
                    className="btn-secondary"
                  >
                    Paid Cash
                  </button>
                  <button
                    onClick={() => {
                      setShowPackageForm(false);
                      setSelectedOffer("");
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Packages */}
          {clientPurchases.length > 0 ? (
            <div className="space-y-4">
              {clientPurchases.map((purchase) => {
                const isExpired = purchase.expires_at && new Date(purchase.expires_at) < new Date();
                const sessionsRemaining = purchase.sessions_total - purchase.sessions_used;
                const isExhausted = sessionsRemaining <= 0;

                return (
                  <div
                    key={purchase.id}
                    className={clsx(
                      "card p-6",
                      (isExpired || isExhausted) && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {purchase.offers?.name || "Package"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Purchased {formatDate(purchase.purchased_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        {purchase.sessions_total && (
                          <div className="mb-2">
                            <span className={clsx(
                              "text-2xl font-bold",
                              sessionsRemaining > 2 ? "text-green-600" :
                              sessionsRemaining > 0 ? "text-amber-600" : "text-gray-400"
                            )}>
                              {sessionsRemaining}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm"> / {purchase.sessions_total} sessions left</span>
                          </div>
                        )}
                        <span className={clsx(
                          "inline-block px-2 py-1 rounded text-xs font-medium",
                          isExpired ? "bg-red-100 text-red-700" :
                          isExhausted ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" :
                          purchase.payment_status === "succeeded" ? "bg-green-100 text-green-700" :
                          purchase.payment_status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {isExpired ? "Expired" :
                           isExhausted ? "Used Up" :
                           purchase.payment_status === "succeeded" ? "Active" :
                           purchase.payment_status === "pending" ? "Pending Payment" :
                           "Failed"}
                        </span>
                      </div>
                    </div>

                    {purchase.sessions_total && (
                      <div className="mt-4">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              "h-full rounded-full transition-all",
                              sessionsRemaining > 2 ? "bg-green-500" :
                              sessionsRemaining > 0 ? "bg-amber-500" : "bg-gray-400"
                            )}
                            style={{ width: `${(sessionsRemaining / purchase.sessions_total) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {purchase.sessions_used} session{purchase.sessions_used !== 1 ? "s" : ""} used
                        </p>
                      </div>
                    )}

                    {purchase.expires_at && (
                      <p className={clsx(
                        "text-sm mt-3",
                        isExpired ? "text-red-600" : "text-gray-500 dark:text-gray-400"
                      )}>
                        {isExpired ? "Expired" : "Expires"} {formatDate(purchase.expires_at)}
                      </p>
                    )}

                    {/* Payment actions for pending packages */}
                    {purchase.payment_status === "pending" && (
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={async () => {
                            const offer = purchase.offers;
                            if (!offer) return;
                            const priceFormatted = new Intl.NumberFormat("en-AU", {
                              style: "currency",
                              currency: "AUD",
                            }).format(purchase.amount_paid_cents / 100);
                            const message = `Hi ${client.full_name?.split(" ")[0]}, here's your payment link for ${offer.name} (${priceFormatted}):\n\n[Payment Link]\n\nThanks!`;
                            alert(`Payment link feature coming soon.\n\nPreview message:\n${message}`);
                          }}
                          className="btn-secondary text-sm"
                        >
                          Send Payment Link
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Mark this package as paid with cash?")) return;
                            // Try with payment_method first, fall back without it
                            let result = await supabase
                              .from("client_purchases")
                              .update({ payment_status: "succeeded", payment_method: "cash" })
                              .eq("id", purchase.id);
                            if (result.error) {
                              // Fallback: update without payment_method in case column doesn't exist
                              result = await supabase
                                .from("client_purchases")
                                .update({ payment_status: "succeeded" })
                                .eq("id", purchase.id);
                            }
                            if (result.error) {
                              alert("Error updating package: " + (result.error.message || JSON.stringify(result.error)));
                            } else {
                              setClientPurchases(clientPurchases.map(p =>
                                p.id === purchase.id
                                  ? { ...p, payment_status: "succeeded", payment_method: "cash" }
                                  : p
                              ));
                            }
                          }}
                          className="btn-secondary text-sm px-12"
                        >
                          Paid Cash
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete this pending package "${purchase.offers?.name || "Package"}"? This cannot be undone.`)) return;
                            const { error } = await supabase
                              .from("client_purchases")
                              .delete()
                              .eq("id", purchase.id);
                            if (error) {
                              alert("Error deleting package: " + (error.message || JSON.stringify(error)));
                            } else {
                              setClientPurchases(clientPurchases.filter(p => p.id !== purchase.id));
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-700 font-medium ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    <div className={clsx(
                      "flex items-center justify-between mt-4 pt-4 border-t border-gray-100",
                      purchase.payment_status === "pending" && "mt-3 pt-3"
                    )}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {purchase.payment_status === "succeeded" ? "Paid" : "Amount"}: ${(purchase.amount_paid_cents / 100).toFixed(2)}
                        {purchase.payment_method && (
                          <span className="ml-1 text-gray-400">
                            ({purchase.payment_method === "stripe" ? "Stripe" :
                              purchase.payment_method === "cash" ? "Cash" :
                              purchase.payment_method === "card" ? "Card" :
                              purchase.payment_method === "bank_transfer" ? "Bank Transfer" :
                              purchase.payment_method})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditPackage(purchase)}
                          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Edit
                        </button>
                        {!isExpired && !isExhausted && purchase.sessions_total && purchase.payment_status === "succeeded" && (
                          <button
                            onClick={async () => {
                              if (!confirm("Use 1 session from this pack?")) return;
                              const { error } = await supabase
                                .from("client_purchases")
                                .update({ sessions_used: purchase.sessions_used + 1 })
                                .eq("id", purchase.id);
                              if (!error) {
                                setClientPurchases(clientPurchases.map(p =>
                                  p.id === purchase.id
                                    ? { ...p, sessions_used: p.sessions_used + 1 }
                                    : p
                                ));
                              }
                            }}
                            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                          >
                            Use 1 Session
                          </button>
                        )}
                        {purchase.sessions_used > 0 && purchase.payment_status === "succeeded" && (
                          <button
                            onClick={async () => {
                              if (!confirm("Reinstate 1 session to this pack?")) return;
                              const { error } = await supabase
                                .from("client_purchases")
                                .update({ sessions_used: purchase.sessions_used - 1 })
                                .eq("id", purchase.id);
                              if (!error) {
                                setClientPurchases(clientPurchases.map(p =>
                                  p.id === purchase.id
                                    ? { ...p, sessions_used: p.sessions_used - 1 }
                                    : p
                                ));
                              }
                            }}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 font-medium"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !showPackageForm && (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No packages assigned yet</p>
                <button onClick={() => setShowPackageForm(true)} className="btn-primary">
                  Add First Package
                </button>
              </div>
            )
          )}

          {offers.length === 0 && (
            <div className="card p-6 bg-amber-50 border-amber-200">
              <p className="text-amber-800">
                No packages available.{" "}
                <Link href="/pricing" className="font-medium hover:underline">
                  Create packages in Pricing & Offers
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-6">
          {/* Add Measurement Button */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Measurements & Logs</h2>
            <button
              onClick={() => setShowMeasurementForm(true)}
              className="btn-primary"
            >
              + Add Measurement
            </button>
          </div>

          {/* New Measurement Form */}
          {showMeasurementForm && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Log New Measurement</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Measurement Type</label>
                  <select
                    value={newMeasurement.type}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, type: e.target.value })}
                    className="input"
                  >
                    <option value="">Select type...</option>
                    {measurementCategories.map((cat) => (
                      <optgroup key={cat.key} label={cat.label}>
                        {measurementTypes
                          .filter((t) => t.category === cat.key)
                          .map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name} ({t.unit})
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Value</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMeasurement.value}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, value: e.target.value })}
                    className="input"
                    placeholder="Enter value"
                  />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <input
                    type="text"
                    value={newMeasurement.notes}
                    onChange={(e) => setNewMeasurement({ ...newMeasurement, notes: e.target.value })}
                    className="input"
                    placeholder="Any notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={saveMeasurement}
                  disabled={!newMeasurement.type || !newMeasurement.value || savingMeasurement}
                  className="btn-primary"
                >
                  {savingMeasurement ? "Saving..." : "Save Measurement"}
                </button>
                <button
                  onClick={() => {
                    setShowMeasurementForm(false);
                    setNewMeasurement({ type: "", value: "", notes: "" });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Measurements by Category */}
          {measurementCategories.map((cat) => {
            const categoryMeasurements = (Object.entries(measurementsByType) as [string, any[]][])
              .filter(([type]) => {
                const typeInfo = measurementTypes.find((t) => t.name === type);
                return typeInfo?.category === cat.key;
              });

            if (categoryMeasurements.length === 0) return null;

            return (
              <div key={cat.key} className="card">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{cat.label}</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {categoryMeasurements.map(([type, entries]) => {
                    const typeInfo = measurementTypes.find((t) => t.name === type);
                    const latest = entries[0];
                    const previous = entries[1];
                    const change = previous ? latest.value - previous.value : null;

                    return (
                      <div key={type} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{type}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {latest.value} {typeInfo?.unit}
                            </span>
                            {change !== null && (
                              <span className={clsx(
                                "text-sm font-medium",
                                change < 0 ? "text-green-600" : change > 0 ? "text-red-600" : "text-gray-500 dark:text-gray-400"
                              )}>
                                {change > 0 ? "+" : ""}{change.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {entries.slice(0, 10).map((entry: any) => (
                            <div key={entry.id} className="flex-shrink-0 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded text-center min-w-[80px]">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{entry.value}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(entry.measured_at)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {measurements.length === 0 && !showMeasurementForm && (
            <div className="card p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No measurements logged yet</p>
              <button onClick={() => setShowMeasurementForm(true)} className="btn-primary">
                Log First Measurement
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Edit Button */}
          <div className="flex justify-end">
            {!isEditingProfile ? (
              <button onClick={startEditingProfile} className="btn-primary">
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setIsEditingProfile(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Edit Mode */}
          {isEditingProfile ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Details */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personal Details</h3>
                <div>
                  <label className="label">Full Name</label>
                  <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date of Birth</label>
                    <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="input">
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Address</h3>
                <div>
                  <label className="label">Street Address</label>
                  <input type="text" value={editForm.address_line1} onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Address Line 2</label>
                  <input type="text" value={editForm.address_line2} onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })} className="input" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">City</label>
                    <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <select value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="input">
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
                    <input type="text" value={editForm.postcode} onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })} className="input" />
                  </div>
                </div>
              </div>

              {/* Physical Stats */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Physical Stats</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Height (cm)</label>
                    <input type="number" value={editForm.height_cm} onChange={(e) => setEditForm({ ...editForm, height_cm: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input type="number" value={editForm.weight_kg} onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Target (kg)</label>
                    <input type="number" value={editForm.target_weight_kg} onChange={(e) => setEditForm({ ...editForm, target_weight_kg: e.target.value })} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Experience Level</label>
                  <select value={editForm.experience_level} onChange={(e) => setEditForm({ ...editForm, experience_level: e.target.value })} className="input">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Training Preferences */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Training Preferences</h3>
                <div>
                  <label className="label">Goals</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {goalOptions.map((goal) => (
                      <button key={goal} type="button" onClick={() => toggleEditGoal(goal)} className={`px-3 py-1 rounded-full text-sm ${editForm.goals?.includes(goal) ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Preferred Days</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {trainingDays.map((day) => (
                      <button key={day} type="button" onClick={() => toggleEditDay(day)} className={`px-3 py-1 rounded-full text-sm ${editForm.preferred_training_days?.includes(day) ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Preferred Time Windows</label>
                  {editForm.preferred_time_windows?.length > 0 && (
                    <div className="space-y-2 mt-2 mb-3">
                      {editForm.preferred_time_windows.map((tw: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          <span className="capitalize text-sm w-20">{tw.day}</span>
                          <span className="text-sm">{tw.start} - {tw.end}</span>
                          <button type="button" onClick={() => removeEditTimeWindow(i)} className="ml-auto text-red-500 text-sm">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <select value={newTimeWindow.day} onChange={(e) => setNewTimeWindow({ ...newTimeWindow, day: e.target.value })} className="input text-sm py-1.5 w-28">
                      {trainingDays.map((day) => (<option key={day} value={day.toLowerCase()}>{day}</option>))}
                    </select>
                    <input type="time" value={newTimeWindow.start} onChange={(e) => setNewTimeWindow({ ...newTimeWindow, start: e.target.value })} className="input text-sm py-1.5 w-24" />
                    <span className="text-gray-500 dark:text-gray-400 pb-2">to</span>
                    <input type="time" value={newTimeWindow.end} onChange={(e) => setNewTimeWindow({ ...newTimeWindow, end: e.target.value })} className="input text-sm py-1.5 w-24" />
                    <button type="button" onClick={addEditTimeWindow} className="btn-secondary text-sm py-1.5">Add</button>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Emergency Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contact Name</label>
                    <input type="text" value={editForm.emergency_contact_name} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="label">Contact Phone</label>
                    <input type="tel" value={editForm.emergency_contact_phone} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} className="input" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="input" rows={4} />
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Details */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Personal Details</h3>
            <dl className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Full Name</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.full_name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Gender</dt>
                  <dd className="text-gray-900 dark:text-gray-100 capitalize">{client.gender?.replace("_", " ") || "—"}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.date_of_birth ? formatDate(client.date_of_birth) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Age</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.date_of_birth ? `${calculateAge(client.date_of_birth)} years` : "—"}</dd>
                </div>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Email</dt>
                <dd><a href={`mailto:${client.email}`} className="text-brand-600 hover:underline">{client.email}</a></dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
                <dd>{client.phone ? <a href={`tel:${client.phone}`} className="text-brand-600 hover:underline">{client.phone}</a> : "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Address */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Address</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Street Address</dt>
                <dd className="text-gray-900 dark:text-gray-100">{client.address_line1 || "—"}</dd>
              </div>
              {client.address_line2 && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Address Line 2</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.address_line2}</dd>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">City</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.city || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">State</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.state || "—"}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Postcode</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.postcode || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Country</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.country || "—"}</dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Physical Stats */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Physical Stats</h3>
            <dl className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Height</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.height_cm ? `${client.height_cm} cm` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Current Weight</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.weight_kg ? `${client.weight_kg} kg` : "—"}</dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Target Weight</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{client.target_weight_kg ? `${client.target_weight_kg} kg` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Experience Level</dt>
                  <dd className="text-gray-900 dark:text-gray-100 capitalize">{client.experience_level || "—"}</dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Training Preferences */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Training Preferences</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400 mb-2">Goals</dt>
                <dd>
                  {client.goals && client.goals.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {client.goals.map((goal: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-brand-100 text-brand-700 rounded text-sm">{goal}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400 mb-2">Preferred Training Days</dt>
                <dd>
                  {client.preferred_training_days && client.preferred_training_days.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {client.preferred_training_days.map((day: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm capitalize">{day}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400 mb-2">Preferred Time Windows</dt>
                <dd>
                  {client.preferred_time_windows && client.preferred_time_windows.length > 0 ? (
                    <div className="space-y-1">
                      {client.preferred_time_windows.map((window: { day: string; start: string; end: string }, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300 capitalize w-24">{window.day}</span>
                          <span className="text-gray-600 dark:text-gray-400">{window.start} - {window.end}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Emergency Contact */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Emergency Contact</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Contact Name</dt>
                <dd className="text-gray-900 dark:text-gray-100">{client.emergency_contact_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Contact Phone</dt>
                <dd>
                  {client.emergency_contact_phone ? (
                    <a href={`tel:${client.emergency_contact_phone}`} className="text-brand-600 hover:underline">
                      {client.emergency_contact_phone}
                    </a>
                  ) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Notes */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Notes</h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{client.notes || "No notes"}</p>
          </div>
        </div>
          )}
        </div>
      )}

      {activeTab === "health" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health Conditions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Health Conditions</h3>
            {client.health_conditions && client.health_conditions.length > 0 ? (
              <ul className="space-y-2">
                {client.health_conditions.map((condition: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                    <span className="text-gray-700 dark:text-gray-300">{condition}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">None reported</p>
            )}
          </div>

          {/* Injuries */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Injuries</h3>
            {client.injuries && client.injuries.length > 0 ? (
              <ul className="space-y-2">
                {client.injuries.map((injury: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span className="text-gray-700 dark:text-gray-300">{injury}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">None reported</p>
            )}
          </div>

          {/* Medications */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Medications</h3>
            {client.medications && client.medications.length > 0 ? (
              <ul className="space-y-2">
                {client.medications.map((med: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span className="text-gray-700 dark:text-gray-300">{med}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">None reported</p>
            )}
          </div>

          {/* Dietary Restrictions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Dietary Restrictions</h3>
            {client.dietary_restrictions && client.dietary_restrictions.length > 0 ? (
              <ul className="space-y-2">
                {client.dietary_restrictions.map((restriction: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    <span className="text-gray-700 dark:text-gray-300">{restriction}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">None reported</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "comms" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Communications Log</h2>
            <button
              onClick={() => setShowCommsForm(true)}
              className="btn-primary"
            >
              + Log Communication
            </button>
          </div>

          {/* Add Communication Form */}
          {showCommsForm && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Log Communication</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Type</label>
                    <select
                      value={commsForm.type}
                      onChange={(e) => setCommsForm({ ...commsForm, type: e.target.value as any })}
                      className="input"
                    >
                      <option value="phone">Phone Call</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="in_person">In Person</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Direction</label>
                    <select
                      value={commsForm.direction}
                      onChange={(e) => setCommsForm({ ...commsForm, direction: e.target.value as any })}
                      className="input"
                    >
                      <option value="outbound">Outbound (you contacted them)</option>
                      <option value="inbound">Inbound (they contacted you)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Subject (optional)</label>
                  <input
                    type="text"
                    value={commsForm.subject}
                    onChange={(e) => setCommsForm({ ...commsForm, subject: e.target.value })}
                    className="input"
                    placeholder="e.g., Session reminder, Follow-up call"
                  />
                </div>

                <div>
                  <label className="label">Notes / Content *</label>
                  <textarea
                    value={commsForm.content}
                    onChange={(e) => setCommsForm({ ...commsForm, content: e.target.value })}
                    className="input"
                    rows={4}
                    placeholder="What was discussed or communicated..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={saveCommunication}
                    disabled={!commsForm.content.trim() || savingComms}
                    className="btn-primary"
                  >
                    {savingComms ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCommsForm(false);
                      setCommsForm({ type: "phone", subject: "", content: "", direction: "outbound" });
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Communications List */}
          {communications.length > 0 ? (
            <div className="card divide-y divide-gray-200">
              {communications.map((comm) => {
                const typeIcons: Record<string, string> = {
                  phone: "📞",
                  sms: "💬",
                  email: "📧",
                  video: "🎥",
                  in_person: "👤",
                  note: "📝",
                };
                const typeLabels: Record<string, string> = {
                  phone: "Phone Call",
                  sms: "SMS",
                  email: "Email",
                  video: "Video Call",
                  in_person: "In Person",
                  note: "Note",
                };

                return (
                  <div key={comm.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{typeIcons[comm.type] || "📝"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {typeLabels[comm.type] || comm.type}
                          </span>
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            comm.direction === "outbound"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          )}>
                            {comm.direction === "outbound" ? "Outbound" : "Inbound"}
                          </span>
                          <span className="text-sm text-gray-400">
                            {formatDateTime(comm.created_at)}
                          </span>
                        </div>
                        {comm.subject && (
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {comm.subject}
                          </p>
                        )}
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{comm.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !showCommsForm && (
              <div className="card p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No communications logged yet</p>
                <button onClick={() => setShowCommsForm(true)} className="btn-primary">
                  Log First Communication
                </button>
              </div>
            )
          )}
        </div>
      )}

      {activeTab === "waivers" && (() => {
        const hasCurrentWaiver = waivers.some((w: any) => w.status === "signed");
        const sortedWaivers = [...waivers].sort((a: any, b: any) => {
          // Signed first (by signed date desc), then sent (by sent date desc)
          if (a.status === "signed" && b.status !== "signed") return -1;
          if (a.status !== "signed" && b.status === "signed") return 1;
          const dateA = a.signed_at || a.sent_at || a.created_at;
          const dateB = b.signed_at || b.sent_at || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Waivers</h3>
              {hasCurrentWaiver ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Current waiver on file</span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">No current waiver</span>
              )}
            </div>
            <button onClick={sendWaiverToClient} disabled={sendingWaiver} className="btn-primary">
              {sendingWaiver ? "Sending..." : "Send Waiver"}
            </button>
          </div>

          {/* Signing Link (shown after sending) */}
          {waiverLink && (
            <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Waiver link generated. Share with client:</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value={waiverLink} className="input flex-1 text-sm bg-white dark:bg-gray-800" onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button
                  onClick={() => { navigator.clipboard.writeText(waiverLink); }}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                {client?.email && (
                  <a
                    href={`mailto:${client.email}?subject=Waiver%20-%20${encodeURIComponent(orgName)}&body=Hi%20${encodeURIComponent(client.full_name)}%2C%0A%0APlease%20review%20and%20sign%20your%20waiver%3A%0A${encodeURIComponent(waiverLink)}%0A%0AThanks%2C%0A${encodeURIComponent(orgName)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-blue-700 border border-blue-300 hover:bg-blue-50"
                  >
                    Send via Email
                  </a>
                )}
                {client?.phone && (
                  <a
                    href={`sms:${client.phone}?body=Hi ${client.full_name}, please sign your waiver: ${waiverLink}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-blue-700 border border-blue-300 hover:bg-blue-50"
                  >
                    Send via SMS
                  </a>
                )}
              </div>
              <button onClick={() => { setWaiverLink(""); setSendMethod(null); }} className="text-xs text-blue-600 hover:text-blue-800 mt-2">
                Dismiss
              </button>
            </div>
          )}

          {/* Waiver Records */}
          {sortedWaivers.length > 0 ? (
            <div className="card divide-y divide-gray-200 dark:divide-gray-700">
              {sortedWaivers.map((waiver: any) => (
                <div key={waiver.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        waiver.status === "signed" && "bg-green-100 text-green-700",
                        waiver.status === "sent" && "bg-amber-100 text-amber-700",
                        waiver.status === "expired" && "bg-red-100 text-red-700",
                      )}>
                        {waiver.status === "signed" ? "Signed" : waiver.status === "sent" ? "Sent - Unsigned" : "Expired"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {waiver.sent_at && <span>Sent {formatDate(waiver.sent_at)}</span>}
                      {waiver.signed_at && <span>Signed {formatDateTime(waiver.signed_at)}</span>}
                    </div>
                    {waiver.status === "signed" && (client?.phone || client?.email) && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Sent to: {client.phone || client.email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {waiver.status === "signed" && (
                      <button
                        onClick={() => downloadSignedWaiverPdf(waiver)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                      >
                        Download PDF
                      </button>
                    )}
                    {(waiver.status === "sent" || waiver.status === "signed") && (
                      <button
                        onClick={() => revokeWaiver(waiver.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card px-6 py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No waivers sent yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Send a waiver to this client to get started</p>
            </div>
          )}
        </div>
        );
      })()}

      {activeTab === "marketing" && (
        <div className="space-y-6">
          {/* Engagement Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {clientReferrals.filter((r: any) => r.referrer_client_id === clientId).length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Referrals Made</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {clientReferrals.filter((r: any) => r.referrer_client_id === clientId && r.status === "converted").length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Conversions</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {communications.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Communications</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {messages.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Messages</p>
            </div>
          </div>

          {/* Communication Preferences */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Communication Preferences</h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Email Marketing</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive newsletters and promotions via email</p>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !marketingPrefs.email_opt_in;
                    setMarketingPrefs({ ...marketingPrefs, email_opt_in: newVal });
                    await supabase.from("clients").update({ email_opt_in: newVal }).eq("id", clientId);
                  }}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    marketingPrefs.email_opt_in ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    marketingPrefs.email_opt_in ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">SMS Marketing</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive promotions and updates via text</p>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !marketingPrefs.sms_opt_in;
                    setMarketingPrefs({ ...marketingPrefs, sms_opt_in: newVal });
                    await supabase.from("clients").update({ sms_opt_in: newVal }).eq("id", clientId);
                  }}
                  className={clsx(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    marketingPrefs.sms_opt_in ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                  )}
                >
                  <span className={clsx(
                    "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    marketingPrefs.sms_opt_in ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </label>
            </div>
          </div>

          {/* Referral Tracking */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Referral Activity</h3>
            </div>
            {/* Client's referral link */}
            {referralLinks.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Share referral link with this client:</p>
                <div className="flex flex-wrap gap-2">
                  {referralLinks.map((link: any) => {
                    const refUrl = `${window.location.origin}/refer/${link.code}`;
                    return (
                      <div key={link.id} className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{link.name}</span>
                        <code className="text-xs text-gray-500 dark:text-gray-400">{link.code}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(refUrl)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Copy Link
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Referral history */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {clientReferrals.length > 0 ? (
                clientReferrals.map((ref: any) => (
                  <div key={ref.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {ref.referrer_client_id === clientId
                          ? `Referred ${ref.referred_name || ref.referred_email}`
                          : `Referred by ${ref.referral_links?.name || "link"}`}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {ref.created_at ? formatDate(ref.created_at) : ""}
                      </p>
                    </div>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      ref.status === "converted" || ref.status === "rewarded" ? "bg-green-100 text-green-700" :
                      ref.status === "signed_up" ? "bg-blue-100 text-blue-700" :
                      ref.status === "pending" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {ref.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No referral activity yet</p>
              )}
            </div>
          </div>

          {/* Email Campaigns */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Email Campaigns</h3>
              {client?.email && marketingPrefs.email_opt_in && (
                <button
                  onClick={async () => {
                    setSendingNewsletter(true);
                    const subject = prompt("Email subject:");
                    if (!subject) { setSendingNewsletter(false); return; }
                    const body = prompt("Email body (plain text):");
                    if (!body) { setSendingNewsletter(false); return; }
                    // Open mailto with pre-filled content
                    window.open(`mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    setSendingNewsletter(false);
                  }}
                  className="btn-primary text-sm"
                >
                  Send Email
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {newsletters.length > 0 ? (
                newsletters.map((nl: any) => (
                  <div key={nl.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{nl.subject}</p>
                        {nl.preheader && <p className="text-sm text-gray-500 dark:text-gray-400">{nl.preheader}</p>}
                      </div>
                      <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                        <p>{nl.sent_at ? formatDate(nl.sent_at) : "Draft"}</p>
                        {nl.sent_to_count && <p>{nl.sent_to_count} recipients</p>}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No campaigns sent yet</p>
              )}
            </div>
          </div>

          {/* Communication Timeline */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Communications</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {communications.length > 0 ? (
                communications.slice(0, 10).map((comm: any) => (
                  <div key={comm.id} className="px-6 py-4 flex items-start gap-3">
                    <span className={clsx(
                      "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                      comm.direction === "outbound" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    )}>
                      {comm.type === "sms" ? "SMS" : comm.type === "email" ? "EM" : comm.type === "phone" ? "PH" : "NT"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">{comm.type}</p>
                        <span className="text-xs text-gray-400">{comm.direction}</span>
                      </div>
                      {comm.subject && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{comm.subject}</p>}
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{comm.content}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(comm.created_at)}</span>
                  </div>
                ))
              ) : (
                <p className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No communications logged</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Activity History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {activities.length > 0 ? (
              activities.map((activity: any) => (
                <div key={activity.id} className="px-6 py-4 flex items-start gap-3">
                  <span className="text-xl">{activityIcons[activity.type as ActivityType]}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">{activity.type}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activity.type === "weight" && `${activity.payload?.value} ${activity.payload?.unit ?? "kg"}`}
                      {activity.type === "habit" && activity.payload?.habit_name}
                      {activity.type === "workout" && "Completed workout"}
                      {activity.type === "checkin" && (activity.payload?.notes ?? "Weekly check-in")}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">{formatDate(activity.created_at)}</span>
                </div>
              ))
            ) : (
              <p className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No activity recorded yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
