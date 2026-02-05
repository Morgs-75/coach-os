"use client";

import { useState, useEffect } from "react";
import type { ChartOfAccount, TaxTreatment, AccountCategory } from "@/types";

type EditData = { name: string; tax_treatment: TaxTreatment };
type NewAccountData = { category: AccountCategory; name: string; tax_treatment: TaxTreatment };

export default function AccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>({ name: "", tax_treatment: "gst" });
  const [newAccount, setNewAccount] = useState<NewAccountData | null>(null);

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

  function addNewRow(category: AccountCategory) {
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
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>;
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
  editData: EditData;
  setEditData: (data: EditData) => void;
  onStartEdit: (account: ChartOfAccount) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  newAccount: { name: string; tax_treatment: TaxTreatment } | null;
  onAddNew: () => void;
  onSaveNew: () => void;
  onNewChange: (data: Partial<{ name: string; tax_treatment: TaxTreatment }>) => void;
  color: "green" | "red" | "gray";
}) {
  const headerColors = {
    green: "bg-green-50 text-green-800",
    red: "bg-red-50 text-red-800",
    gray: "bg-gray-100 dark:bg-gray-700 text-gray-800",
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
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              {editingId === account.id ? (
                <>
                  <td className="px-3 py-1">
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded"
                      autoFocus
                    />
                  </td>
                  <td className="px-3 py-1 text-center">
                    <select
                      value={editData.tax_treatment}
                      onChange={(e) => setEditData({ ...editData, tax_treatment: e.target.value as TaxTreatment })}
                      className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded"
                    >
                      <option value="gst">Y</option>
                      <option value="gst_free">N</option>
                      <option value="bas_excluded">-</option>
                    </select>
                  </td>
                  <td className="px-3 py-1 text-right whitespace-nowrap">
                    <button onClick={() => onSave(account.id)} className="text-green-600 hover:text-green-800 mr-2">Save</button>
                    <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-3 py-1 text-gray-900 dark:text-gray-100">{account.name}</td>
                  <td className="px-3 py-1 text-center text-gray-600 dark:text-gray-400">
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
                  className="w-full px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded"
                  placeholder="Account name..."
                  autoFocus
                />
              </td>
              <td className="px-3 py-1 text-center">
                <select
                  value={newAccount.tax_treatment}
                  onChange={(e) => onNewChange({ tax_treatment: e.target.value as TaxTreatment })}
                  className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded"
                >
                  <option value="gst">Y</option>
                  <option value="gst_free">N</option>
                  <option value="bas_excluded">-</option>
                </select>
              </td>
              <td className="px-3 py-1 text-right whitespace-nowrap">
                <button onClick={onSaveNew} className="text-green-600 hover:text-green-800 mr-2">Save</button>
                <button onClick={onCancel} className="text-gray-500 dark:text-gray-400 hover:text-gray-700">Cancel</button>
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
