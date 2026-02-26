"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [orgName, setOrgName] = useState("");

  // Booking settings
  const [timezone, setTimezone] = useState("Australia/Brisbane");
  const [orgId, setOrgId] = useState("");

  // Payment processing settings
  const [gstRegistered, setGstRegistered] = useState(false);
  const [passStripeFees, setPassStripeFees] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  // Payout settings
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [payoutFrequency, setPayoutFrequency] = useState("weekly");

  // Waiver template
  const [waiverTemplate, setWaiverTemplate] = useState("");
  const [savingWaiver, setSavingWaiver] = useState(false);
  const [waiverMessage, setWaiverMessage] = useState("");

  // Proforma disclaimer
  const [proformaDisclaimer, setProformaDisclaimer] = useState("");
  const [savingProforma, setSavingProforma] = useState(false);
  const [proformaMessage, setProformaMessage] = useState("");

  // Earnings
  const [earnings, setEarnings] = useState<any>(null);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [message, setMessage] = useState("");
  const [payoutMessage, setPayoutMessage] = useState("");
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

    // Load booking settings
    const { data: bookingSettings } = await supabase
      .from("booking_settings")
      .select("timezone, gst_registered, pass_stripe_fees")
      .eq("org_id", membership.org_id)
      .maybeSingle();
    if (bookingSettings?.timezone) setTimezone(bookingSettings.timezone);
    if (bookingSettings?.gst_registered != null) setGstRegistered(bookingSettings.gst_registered);
    if (bookingSettings?.pass_stripe_fees != null) setPassStripeFees(bookingSettings.pass_stripe_fees);

    // Load org
    const { data: org } = await supabase
      .from("orgs")
      .select("name, commission_rate, waiver_template, proforma_disclaimer")
      .eq("id", membership.org_id)
      .single();

    // Load branding
    const { data: branding } = await supabase
      .from("branding")
      .select("display_name, primary_color")
      .eq("org_id", membership.org_id)
      .single();

    // Load payout settings
    const { data: payoutSettings } = await supabase
      .from("org_payout_settings")
      .select("*")
      .eq("org_id", membership.org_id)
      .single();

    // Load earnings
    const { data: earningsData } = await supabase
      .from("org_earnings")
      .select("*")
      .eq("org_id", membership.org_id)
      .single();

    // Load recent payouts
    const { data: payoutsData } = await supabase
      .from("org_payouts")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (org) {
      setOrgName(org.name);
      setWaiverTemplate(org.waiver_template || "");
      setProformaDisclaimer(org.proforma_disclaimer || "");
    }
    if (branding) {
      setDisplayName(branding.display_name);
      setPrimaryColor(branding.primary_color);
    }
    if (payoutSettings) {
      setPayoutMethod(payoutSettings.payout_method);
      setBankAccountName(payoutSettings.bank_account_name || "");
      setBankBsb(payoutSettings.bank_bsb || "");
      setBankAccountNumber(payoutSettings.bank_account_number || "");
      setPaypalEmail(payoutSettings.paypal_email || "");
      setPayoutFrequency(payoutSettings.payout_frequency);
    }
    if (earningsData) setEarnings(earningsData);
    if (payoutsData) setRecentPayouts(payoutsData);

    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    // Update org name
    await supabase
      .from("orgs")
      .update({ name: orgName })
      .eq("id", membership.org_id);

    // Update branding
    await supabase
      .from("branding")
      .update({ display_name: displayName, primary_color: primaryColor })
      .eq("org_id", membership.org_id);

    // Update timezone
    await supabase
      .from("booking_settings")
      .update({ timezone })
      .eq("org_id", membership.org_id);

    setMessage("Settings saved!");
    setSaving(false);
  }

  async function handleSavePayout(e: React.FormEvent) {
    e.preventDefault();
    setSavingPayout(true);
    setPayoutMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;

    const payoutData = {
      org_id: membership.org_id,
      payout_method: payoutMethod,
      bank_account_name: payoutMethod === "bank_transfer" ? bankAccountName : null,
      bank_bsb: payoutMethod === "bank_transfer" ? bankBsb : null,
      bank_account_number: payoutMethod === "bank_transfer" ? bankAccountNumber : null,
      paypal_email: payoutMethod === "paypal" ? paypalEmail : null,
      payout_frequency: payoutFrequency,
      updated_at: new Date().toISOString(),
    };

    // Upsert payout settings
    const { error } = await supabase
      .from("org_payout_settings")
      .upsert(payoutData, { onConflict: "org_id" });

    if (error) {
      setPayoutMessage("Failed to save payout settings");
    } else {
      setPayoutMessage("Payout settings saved!");
    }
    setSavingPayout(false);
  }

  async function handleSavePaymentSettings() {
    setSavingPayment(true);
    setPaymentMessage("");
    const { error } = await supabase
      .from("booking_settings")
      .update({ gst_registered: gstRegistered, pass_stripe_fees: passStripeFees })
      .eq("org_id", orgId);
    setPaymentMessage(error ? "Failed to save" : "Payment settings saved!");
    setSavingPayment(false);
  }

  async function handleSaveWaiver() {
    setSavingWaiver(true);
    setWaiverMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingWaiver(false); return; }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) { setSavingWaiver(false); return; }

    const { error } = await supabase
      .from("orgs")
      .update({ waiver_template: waiverTemplate })
      .eq("id", membership.org_id);

    if (error) {
      setWaiverMessage("Failed to save waiver template");
    } else {
      setWaiverMessage("Waiver template saved!");
    }
    setSavingWaiver(false);
  }

  async function handleSaveProforma() {
    setSavingProforma(true);
    setProformaMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingProforma(false); return; }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) { setSavingProforma(false); return; }

    const { error } = await supabase
      .from("orgs")
      .update({ proforma_disclaimer: proformaDisclaimer })
      .eq("id", membership.org_id);

    if (error) {
      setProformaMessage("Failed to save proforma disclaimer");
    } else {
      setProformaMessage("Proforma disclaimer saved!");
    }
    setSavingProforma(false);
  }

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Settings</h1>

      {/* Earnings Overview */}
      {earnings && (
        <div className="card p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Earnings</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(earnings.gross_earnings_cents || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Platform Fee (3.3%)</p>
              <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">
                -{formatCurrency(earnings.commission_cents || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Earnings</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(earnings.net_earnings_cents || 0)}
              </p>
            </div>
          </div>
          <div className="flex gap-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Paid Out</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(earnings.paid_out_cents || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Payout</p>
              <p className={clsx(
                "font-semibold",
                (earnings.pending_payout_cents || 0) > 0 ? "text-amber-600" : "text-gray-900 dark:text-gray-100"
              )}>
                {formatCurrency(earnings.pending_payout_cents || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Branding */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Branding</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="orgName" className="label">
                Business Name
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="displayName" className="label">
                Display Name (shown to clients)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="timezone" className="label">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input"
              >
                <option value="Australia/Brisbane">Queensland (UTC+10, no DST)</option>
                <option value="Australia/Sydney">NSW / ACT / Victoria (AEDT/AEST)</option>
                <option value="Australia/Adelaide">South Australia (ACDT/ACST)</option>
                <option value="Australia/Darwin">Northern Territory (UTC+9:30)</option>
                <option value="Australia/Perth">Western Australia (UTC+8)</option>
                <option value="Australia/Hobart">Tasmania (AEDT/AEST)</option>
                <option value="Pacific/Auckland">New Zealand (NZDT/NZST)</option>
              </select>
            </div>

            <div>
              <label htmlFor="primaryColor" className="label">
                Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="input w-32"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Branding */}
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {message && <span className="text-green-600">{message}</span>}
        </div>
      </form>

      {/* Waiver Template */}
      <div className="card p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Waiver Template</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This is your standard waiver that will be sent to clients for signing. Use placeholders: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{client_name}"}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{client_dob}"}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{client_address}"}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{business_name}"}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{date}"}</code>
        </p>
        <textarea
          value={waiverTemplate}
          onChange={(e) => setWaiverTemplate(e.target.value)}
          className="input font-mono text-sm"
          rows={20}
          placeholder="Paste your waiver template here..."
        />
        <div className="flex items-center gap-4 mt-4">
          <button onClick={handleSaveWaiver} className="btn-primary" disabled={savingWaiver}>
            {savingWaiver ? "Saving..." : "Save Waiver Template"}
          </button>
          {waiverMessage && (
            <span className={waiverMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {waiverMessage}
            </span>
          )}
        </div>
      </div>

      {/* Proforma Disclaimer */}
      <div className="card p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Proforma Disclaimer</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This disclaimer will appear on proforma invoices sent to clients. Use this to include payment terms, refund policies, or other important legal notices.
        </p>
        <textarea
          value={proformaDisclaimer}
          onChange={(e) => setProformaDisclaimer(e.target.value)}
          className="input font-mono text-sm"
          rows={10}
          placeholder="Enter your proforma disclaimer here..."
        />
        <div className="flex items-center gap-4 mt-4">
          <button onClick={handleSaveProforma} className="btn-primary" disabled={savingProforma}>
            {savingProforma ? "Saving..." : "Save Proforma Disclaimer"}
          </button>
          {proformaMessage && (
            <span className={proformaMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {proformaMessage}
            </span>
          )}
        </div>
      </div>

      {/* Payout Settings */}
      <form onSubmit={handleSavePayout} className="space-y-8 mt-8">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Payout Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure how you want to receive your earnings (minus 3.3% platform fee on ex-GST amount).
          </p>

          <div className="space-y-4">
            <div>
              <label className="label">Payout Method</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="bank_transfer"
                    checked={payoutMethod === "bank_transfer"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="text-brand-600"
                  />
                  <span>Bank Transfer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="paypal"
                    checked={payoutMethod === "paypal"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="text-brand-600"
                  />
                  <span>PayPal</span>
                </label>
              </div>
            </div>

            {payoutMethod === "bank_transfer" && (
              <>
                <div>
                  <label className="label">Account Name</label>
                  <input
                    type="text"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="input"
                    placeholder="John Smith"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">BSB</label>
                    <input
                      type="text"
                      value={bankBsb}
                      onChange={(e) => setBankBsb(e.target.value)}
                      className="input"
                      placeholder="000-000"
                      maxLength={7}
                    />
                  </div>
                  <div>
                    <label className="label">Account Number</label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className="input"
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </>
            )}

            {payoutMethod === "paypal" && (
              <div>
                <label className="label">PayPal Email</label>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                />
              </div>
            )}

            <div>
              <label className="label">Payout Frequency</label>
              <select
                value={payoutFrequency}
                onChange={(e) => setPayoutFrequency(e.target.value)}
                className="input"
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum payout: $50. Amounts under $50 roll over to next period.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={savingPayout}>
            {savingPayout ? "Saving..." : "Save Payout Settings"}
          </button>
          {payoutMessage && (
            <span className={payoutMessage.includes("Failed") ? "text-red-600" : "text-green-600"}>
              {payoutMessage}
            </span>
          )}
        </div>
      </form>

      {/* Payment Processing */}
      <div className="card p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Payment Processing</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Coach OS charges a 3.3% platform fee on the ex-GST sale amount.
        </p>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={gstRegistered}
              onChange={e => setGstRegistered(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">GST Registered</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your package prices include 10% GST. Clients will see &quot;incl. GST&quot; at checkout.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={passStripeFees}
              onChange={e => setPassStripeFees(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Pass card processing fees to clients</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A 1.75% + $0.30 Stripe processing fee is added to the checkout price.
                Your listed price is what you receive.
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <button
            type="button"
            onClick={handleSavePaymentSettings}
            disabled={savingPayment}
            className="btn-primary"
          >
            {savingPayment ? "Saving..." : "Save Payment Settings"}
          </button>
          {paymentMessage && (
            <span className={paymentMessage.includes("Failed") ? "text-red-600 text-sm" : "text-green-600 text-sm"}>
              {paymentMessage}
            </span>
          )}
        </div>
      </div>

      {/* Recent Payouts */}
      {recentPayouts.length > 0 && (
        <div className="card mt-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Payouts</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentPayouts.map((payout) => (
              <div key={payout.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(payout.period_start).toLocaleDateString("en-AU")} - {new Date(payout.period_end).toLocaleDateString("en-AU")}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Gross: {formatCurrency(payout.gross_amount_cents)} | Fee: {formatCurrency(payout.commission_cents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(payout.net_amount_cents)}</p>
                  <span className={clsx(
                    "inline-block px-2 py-0.5 rounded text-xs font-medium",
                    payout.status === "paid" ? "bg-green-100 text-green-700" :
                    payout.status === "processing" ? "bg-amber-100 text-amber-700" :
                    payout.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {payout.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
