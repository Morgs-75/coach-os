"use client";

import { useState, useEffect } from "react";
import type { ChartOfAccount } from "@coach-os/shared";

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", tax_treatment: "gst" });
  const [newAccount, setNewAccount] = useState<{ category: string; name: string; tax_treatment: string } | null>(null);

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
      setEditingId(null);
      setNewAccount(null);
    } catch (error) {
      console.error("Failed to save account:", error);
    }
  }

  async function deleteAccount(accountId: string) {
    if (!confirm("Delete this account?")) return;
    try {
      await fetch(`/api/my-accounts/chart-of-accounts?id=${accountId}`, {
        method: "DELETE",
      });
      await loadAccounts();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  }

  function startEdit(account: ChartOfAccount) {
    setEditingId(account.id);
    setEditData({
      name: account.name,
      tax_treatment: account.tax_treatment || "gst",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setNewAccount(null);
  }

  function addNewRow(category: string) {
    setNewAccount({
      category,
      name: "",
      tax_treatment: "gst",
    });
  }

  const incomeAccounts = accounts.filter(a => a.category === "income").sort((a, b) => a.name.localeCompare(b.name));
  const expenseAccounts = accounts.filter(a => a.category === "expense").sort((a, b) => a.name.localeCompare(b.name));
  const otherAccounts = accounts.filter(a => a.category === "other").sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4" style={{ fontSize: '8pt' }}>
      {/* Income */}
      <AccountTable
        title="Income"
        accounts={incomeAccounts}
        editingId={editingId}
        editData={editData}
        setEditData={setEditData}
        onStartEdit={startEdit}
        onSave={(id) => saveAccount({ id, ...editData })}
        onCancel={cancelEdit}
        onDelete={deleteAccount}
        newAccount={newAccount?.category === "income" ? newAccount : null}
        onAddNew={() => addNewRow("income")}
        onSaveNew={() => saveAccount({ ...newAccount, code: `INC-${Date.now()}`, is_system: false })}
        onNewChange={(data) => setNewAccount({ ...newAccount!, ...data })}
        color="green"
      />

      {/* Expenses */}
      <AccountTable
        title="Expenses"
        accounts={expenseAccounts}
        editingId={editingId}
        editData={editData}
        setEditData={setEditData}
        onStartEdit={startEdit}
        onSave={(id) => saveAccount({ id, ...editData })}
        onCancel={cancelEdit}
        onDelete={deleteAccount}
        newAccount={newAccount?.category === "expense" ? newAccount : null}
        onAddNew={() => addNewRow("expense")}
        onSaveNew={() => saveAccount({ ...newAccount, code: `EXP-${Date.now()}`, is_system: false })}
        onNewChange={(data) => setNewAccount({ ...newAccount!, ...data })}
        color="red"
      />

      {/* Other */}
      <AccountTable
        title="Other"
        accounts={otherAccounts}
        editingId={editingId}
        editData={editData}
        setEditData={setEditData}
        onStartEdit={startEdit}
        onSave={(id) => saveAccount({ id, ...editData })}
        onCancel={cancelEdit}
        onDelete={deleteAccount}
        newAccount={newAccount?.category === "other" ? newAccount : null}
        onAddNew={() => addNewRow("other")}
        onSaveNew={() => saveAccount({ ...newAccount, code: `OTH-${Date.now()}`, is_system: false })}
        onNewChange={(data) => setNewAccount({ ...newAccount!, ...data })}
        color="gray"
      />
    </div>
  );
}

function AccountTable({
  title,
  accounts,
  editingId,
  editData,
  setEditData,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  newAccount,
  onAddNew,
  onSaveNew,
  onNewChange,
  color,
}: {
  title: string;
  accounts: ChartOfAccount[];
  editingId: string | null;
  editData: { name: string; tax_treatment: string };
  setEditData: (data: { name: string; tax_treatment: string }) => void;
  onStartEdit: (account: ChartOfAccount) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  newAccount: { name: string; tax_treatment: string } | null;
  onAddNew: () => void;
  onSaveNew: () => void;
  onNewChange: (data: Partial<{ name: string; tax_treatment: string }>) => void;
  color: "green" | "red" | "gray";
}) {
  const headerColors = {
    green: "bg-green-50 text-green-800",
    red: "bg-red-50 text-red-800",
    gray: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className={headerColors[color]}>
            <th className="px-3 py-1.5 text-left font-bold">{title}</th>
            <th className="px-3 py-1.5 text-center font-semibold w-12">GST</th>
            <th className="px-3 py-1.5 text-right w-24">
              <button onClick={onAddNew} className="text-blue-600 hover:text-blue-800 font-medium">
                + Add
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-gray-50">
              {editingId === account.id ? (
                <>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-2 py-0.5 border border-gray-300 rounded"
                      autoFocus
                    />
                  </td>
                  <td className="px-3 py-1 text-center">
                    <select
                      value={editData.tax_treatment}
                      onChange={(e) => setEditData({ ...editData, tax_treatment: e.target.value })}
                      className="px-1 py-0.5 border border-gray-300 rounded"
                    >
                      <option value="gst">Y</option>
                      <option value="gst_free">N</option>
                      <option value="bas_excluded">-</option>
                    </select>
                  </td>
                  <td className="px-3 py-1 text-right whitespace-nowrap">
                    <button onClick={() => onSave(account.id)} className="text-green-600 hover:text-green-800 mr-2">Save</button>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-1 text-gray-900">{account.name}</td>
                  <td className="px-3 py-1 text-center text-gray-600">
                    {account.tax_treatment === "gst" ? "Y" : account.tax_treatment === "gst_free" ? "N" : "-"}
                  </td>
                  <td className="px-3 py-1 text-right whitespace-nowrap">
                    <button onClick={() => onStartEdit(account)} className="text-blue-600 hover:text-blue-800 mr-2">Edit</button>
                    <button onClick={() => onDelete(account.id)} className="text-red-600 hover:text-red-800">Del</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {newAccount && (
            <tr className="bg-blue-50">
              <td className="px-3 py-1">
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => onNewChange({ name: e.target.value })}
                  className="w-full px-2 py-0.5 border border-gray-300 rounded"
                  placeholder="Account name..."
                  autoFocus
                />
              </td>
              <td className="px-3 py-1 text-center">
                <select
                  value={newAccount.tax_treatment}
                  onChange={(e) => onNewChange({ tax_treatment: e.target.value })}
                  className="px-1 py-0.5 border border-gray-300 rounded"
                >
                  <option value="gst">Y</option>
                  <option value="gst_free">N</option>
                  <option value="bas_excluded">-</option>
                </select>
              </td>
              <td className="px-3 py-1 text-right whitespace-nowrap">
                <button onClick={onSaveNew} className="text-green-600 hover:text-green-800 mr-2">Save</button>
                <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">Cancel</button>
              </td>
            </tr>
          )}
          {accounts.length === 0 && !newAccount && (
            <tr>
              <td colSpan={3} className="px-3 py-2 text-center text-gray-400">
                No accounts. Click + Add to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
