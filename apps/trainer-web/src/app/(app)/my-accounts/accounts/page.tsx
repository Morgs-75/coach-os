"use client";

import { useState, useEffect } from "react";
import type { ChartOfAccount } from "@coach-os/shared";

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "other">("all");

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const response = await fetch("/api/my-accounts/chart-of-accounts");
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAccount(account: Partial<ChartOfAccount>) {
    try {
      await fetch("/api/my-accounts/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      });
      await loadAccounts();
      setShowForm(false);
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
      await loadAccounts();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  }

  const filteredAccounts = filter === "all"
    ? accounts
    : accounts.filter(a => a.category === filter);

  const incomeAccounts = filteredAccounts.filter(a => a.category === "income").sort((a, b) => a.name.localeCompare(b.name));
  const expenseAccounts = filteredAccounts.filter(a => a.category === "expense").sort((a, b) => a.name.localeCompare(b.name));
  const otherAccounts = filteredAccounts.filter(a => a.category === "other").sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading accounts...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500">
            {accounts.length} accounts configured for categorizing transactions
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Add Account
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "income", "expense", "other"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              filter === f
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Income Section */}
      {(filter === "all" || filter === "income") && incomeAccounts.length > 0 && (
        <AccountSection
          title="Income"
          description="Revenue accounts for money coming in"
          accounts={incomeAccounts}
          onEdit={(a) => { setEditingAccount(a); setShowForm(true); }}
          onDelete={deleteAccount}
          color="green"
        />
      )}

      {/* Expense Section */}
      {(filter === "all" || filter === "expense") && expenseAccounts.length > 0 && (
        <AccountSection
          title="Expenses"
          description="Deductible business expenses"
          accounts={expenseAccounts}
          onEdit={(a) => { setEditingAccount(a); setShowForm(true); }}
          onDelete={deleteAccount}
          color="red"
        />
      )}

      {/* Other Section */}
      {(filter === "all" || filter === "other") && otherAccounts.length > 0 && (
        <AccountSection
          title="Other"
          description="Transfers, drawings, and excluded items"
          accounts={otherAccounts}
          onEdit={(a) => { setEditingAccount(a); setShowForm(true); }}
          onDelete={deleteAccount}
          color="gray"
        />
      )}

      {filteredAccounts.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No accounts found</p>
        </div>
      )}

      {/* Account Form Modal */}
      {showForm && (
        <AccountFormModal
          account={editingAccount}
          existingCodes={accounts.map((a) => a.code)}
          onSave={saveAccount}
          onClose={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}

function AccountSection({
  title,
  description,
  accounts,
  onEdit,
  onDelete,
  color,
}: {
  title: string;
  description: string;
  accounts: ChartOfAccount[];
  onEdit: (account: ChartOfAccount) => void;
  onDelete: (id: string) => void;
  color: "green" | "red" | "gray";
}) {
  const colorClasses = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    gray: "border-l-gray-400",
  };

  return (
    <div className={`card border-l-4 ${colorClasses[color]}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {accounts.map((account) => (
          <div key={account.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {account.code}
                </span>
                <span className="font-medium text-gray-900">{account.name}</span>
                {account.is_system && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                    System
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {account.tax_treatment === "gst" && "GST 10%"}
                  {account.tax_treatment === "gst_free" && "GST Free"}
                  {account.tax_treatment === "bas_excluded" && "BAS Excluded"}
                </span>
              </div>
            </div>
            {!account.is_system && (
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(account)}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(account.id)}
                  className="text-sm text-red-600 hover:text-red-800 px-3 py-1"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
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
  useEffect(() => {
    if (!account && !formData.code) {
      setFormData((prev) => ({
        ...prev,
        code: generateCode(prev.category),
      }));
    }
  }, []);

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
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {account ? "Edit Account" : "Add New Account"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create a category for coding your transactions
          </p>
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
              placeholder="e.g., Supplements, Uniforms, Travel"
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
            <p className="text-xs text-gray-500 mt-1">
              {formData.tax_treatment === "gst" && "Standard GST rate - most business expenses"}
              {formData.tax_treatment === "gst_free" && "No GST - insurance, some food, medical"}
              {formData.tax_treatment === "bas_excluded" && "Not on BAS - wages, bank transfers, private"}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
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
