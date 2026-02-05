"use client";

import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import type { BasiqConnection, CodingRule, ChartOfAccount } from "@/types";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<BasiqConnection | null>(null);
  const [rules, setRules] = useState<CodingRule[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CodingRule | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load connection info
      const connResponse = await fetch("/api/my-accounts/accounts");
      const connData = await connResponse.json();
      setConnection(connData.connection);

      // Load coding rules
      const rulesResponse = await fetch("/api/my-accounts/coding-rules");
      const rulesData = await rulesResponse.json();
      setRules(rulesData.rules || []);

      // Load accounts
      const accountsResponse = await fetch("/api/my-accounts/chart-of-accounts");
      const accountsData = await accountsResponse.json();
      setAccounts(accountsData.accounts || []);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function disconnectBank() {
    if (!confirm("Are you sure you want to disconnect your bank? Transaction history will be preserved.")) {
      return;
    }

    try {
      await fetch("/api/my-accounts/connect", {
        method: "DELETE",
      });
      setConnection(null);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  async function saveRule(rule: Partial<CodingRule>) {
    try {
      await fetch("/api/my-accounts/coding-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      await loadData();
      setShowRuleForm(false);
      setEditingRule(null);
    } catch (error) {
      console.error("Failed to save rule:", error);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Delete this coding rule?")) return;

    try {
      await fetch(`/api/my-accounts/coding-rules?id=${ruleId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (error) {
      console.error("Failed to delete rule:", error);
    }
  }

  async function saveAccount(account: Partial<ChartOfAccount>) {
    try {
      await fetch("/api/my-accounts/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      });
      await loadData();
      setShowAccountForm(false);
      setEditingAccount(null);
    } catch (error) {
      console.error("Failed to save account:", error);
    }
  }

  async function deleteAccount(accountId: string) {
    if (!confirm("Delete this account? This cannot be undone.")) return;

    try {
      await fetch(`/api/my-accounts/chart-of-accounts?id=${accountId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Bank Connection */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bank Connection</h2>
        </div>
        <div className="p-6">
          {connection?.consent_status === "active" ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Last synced: {connection.last_sync_at ? formatDate(connection.last_sync_at) : "Never"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetch("/api/my-accounts/sync", { method: "POST" })}
                  className="btn-secondary"
                >
                  Sync Now
                </button>
                <button
                  onClick={disconnectBank}
                  className="btn-danger"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No bank connected</p>
              <a href="/my-accounts/connect" className="btn-primary">
                Connect Bank
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Coding Rules */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Coding Rules</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically code transactions based on patterns
            </p>
          </div>
          <button onClick={() => setShowRuleForm(true)} className="btn-primary">
            Add Rule
          </button>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {rules.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No coding rules yet. Add a rule to auto-code matching transactions.
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</h3>
                      {rule.auto_apply && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Auto-apply
                        </span>
                      )}
                      {!rule.is_active && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {rule.match_description && `Description contains "${rule.match_description}"`}
                      {rule.match_merchant && ` | Merchant contains "${rule.match_merchant}"`}
                      {rule.match_direction && ` | ${rule.match_direction === "credit" ? "Credits only" : "Debits only"}`}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Maps to: <span className="font-medium">{rule.account?.name || "Unknown"}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Applied {rule.times_applied} times
                      {rule.last_applied_at && ` | Last: ${formatDate(rule.last_applied_at)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowRuleForm(true);
                      }}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Chart of Accounts */}
      <section className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chart of Accounts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Categories for coding transactions
            </p>
          </div>
          <button onClick={() => setShowAccountForm(true)} className="btn-primary">
            + Add Account
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tax</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-gray-100">{account.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{account.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 capitalize">{account.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {account.tax_treatment === "gst" && "GST"}
                    {account.tax_treatment === "gst_free" && "GST Free"}
                    {account.tax_treatment === "bas_excluded" && "BAS Excluded"}
                  </td>
                  <td className="px-6 py-4">
                    {account.is_system ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        System
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!account.is_system && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAccount(account);
                            setShowAccountForm(true);
                          }}
                          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteAccount(account.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rule Form Modal */}
      {showRuleForm && (
        <RuleFormModal
          rule={editingRule}
          accounts={accounts}
          onSave={saveRule}
          onClose={() => {
            setShowRuleForm(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Account Form Modal */}
      {showAccountForm && (
        <AccountFormModal
          account={editingAccount}
          existingCodes={accounts.map((a) => a.code)}
          onSave={saveAccount}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}

function RuleFormModal({
  rule,
  accounts,
  onSave,
  onClose,
}: {
  rule: CodingRule | null;
  accounts: ChartOfAccount[];
  onSave: (rule: Partial<CodingRule>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: rule?.name || "",
    match_description: rule?.match_description || "",
    match_merchant: rule?.match_merchant || "",
    match_direction: rule?.match_direction || "",
    account_id: rule?.account_id || "",
    auto_apply: rule?.auto_apply || false,
    is_active: rule?.is_active ?? true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...rule,
      ...formData,
      match_direction: formData.match_direction || null,
    } as Partial<CodingRule>);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {rule ? "Edit Coding Rule" : "New Coding Rule"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Rule Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
              placeholder="e.g., Gym Rent Payments"
            />
          </div>

          <div>
            <label className="label">Description Contains</label>
            <input
              type="text"
              value={formData.match_description}
              onChange={(e) => setFormData({ ...formData, match_description: e.target.value })}
              className="input"
              placeholder="e.g., RENT, ANYTIME FITNESS"
            />
          </div>

          <div>
            <label className="label">Merchant Contains</label>
            <input
              type="text"
              value={formData.match_merchant}
              onChange={(e) => setFormData({ ...formData, match_merchant: e.target.value })}
              className="input"
              placeholder="e.g., Anytime Fitness"
            />
          </div>

          <div>
            <label className="label">Transaction Type</label>
            <select
              value={formData.match_direction}
              onChange={(e) => setFormData({ ...formData, match_direction: e.target.value as any })}
              className="input"
            >
              <option value="">Any</option>
              <option value="credit">Credits (Money In)</option>
              <option value="debit">Debits (Money Out)</option>
            </select>
          </div>

          <div>
            <label className="label">Map to Account</label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="input"
              required
            >
              <option value="">Select an account...</option>
              <optgroup label="Income">
                {accounts.filter((a) => a.category === "income").map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Expenses">
                {accounts.filter((a) => a.category === "expense").map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other">
                {accounts.filter((a) => a.category === "other").map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.auto_apply}
                onChange={(e) => setFormData({ ...formData, auto_apply: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-apply on sync</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountFormModal({
  account,
  existingCodes,
  onSave,
  onClose,
}: {
  account: ChartOfAccount | null;
  existingCodes: string[];
  onSave: (account: Partial<ChartOfAccount>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    code: account?.code || "",
    name: account?.name || "",
    category: account?.category || "expense",
    tax_treatment: account?.tax_treatment || "gst",
  });
  const [codeError, setCodeError] = useState("");

  // Generate next code based on category
  function generateCode(category: string) {
    const prefix = category === "income" ? "INC" : category === "expense" ? "EXP" : "OTH";
    const existingInCategory = existingCodes.filter((c) => c.startsWith(prefix));
    const numbers = existingInCategory.map((c) => parseInt(c.split("-")[1] || "0", 10));
    const nextNum = Math.max(0, ...numbers) + 1;
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  }

  // Auto-generate code when category changes (for new accounts)
  function handleCategoryChange(category: string) {
    setFormData((prev) => ({
      ...prev,
      category: category as "income" | "expense" | "other",
      code: account ? prev.code : generateCode(category),
    }));
  }

  // Initialize code for new accounts
  useState(() => {
    if (!account) {
      setFormData((prev) => ({
        ...prev,
        code: generateCode(prev.category),
      }));
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate code uniqueness
    if (!account && existingCodes.includes(formData.code)) {
      setCodeError("This code already exists");
      return;
    }

    onSave({
      ...account,
      ...formData,
      is_system: false,
    } as Partial<ChartOfAccount>);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {account ? "Edit Account" : "Add New Account"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="input"
                required
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => {
                  setFormData({ ...formData, code: e.target.value.toUpperCase() });
                  setCodeError("");
                }}
                className={`input font-mono ${codeError ? "border-red-500" : ""}`}
                required
                placeholder="e.g., EXP-015"
              />
              {codeError && <p className="text-red-500 text-xs mt-1">{codeError}</p>}
            </div>
          </div>

          <div>
            <label className="label">Account Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
              placeholder="e.g., Supplements"
            />
          </div>

          <div>
            <label className="label">Tax Treatment</label>
            <select
              value={formData.tax_treatment}
              onChange={(e) => setFormData({ ...formData, tax_treatment: e.target.value as any })}
              className="input"
              required
            >
              <option value="gst">GST (10%)</option>
              <option value="gst_free">GST Free</option>
              <option value="bas_excluded">BAS Excluded</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.tax_treatment === "gst" && "Standard GST rate applies"}
              {formData.tax_treatment === "gst_free" && "No GST (e.g., insurance, some food)"}
              {formData.tax_treatment === "bas_excluded" && "Not reported on BAS (e.g., wages, private expenses)"}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {account ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
