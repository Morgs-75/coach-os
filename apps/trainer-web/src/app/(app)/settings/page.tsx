"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [orgName, setOrgName] = useState("");

  // Payout settings
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [payoutFrequency, setPayoutFrequency] = useState("weekly");

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

    // Load org
    const { data: org } = await supabase
      .from("orgs")
      .select("name, commission_rate")
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

    if (org) setOrgName(org.name);
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Platform Fee (5%)</p>
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

      {/* Payout Settings */}
      <form onSubmit={handleSavePayout} className="space-y-8 mt-8">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Payout Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure how you want to receive your earnings (minus 5% platform fee).
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
