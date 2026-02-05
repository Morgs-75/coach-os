"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ChartOfAccount, AccountCategory, TaxTreatment } from "@/types";
import { clsx } from "clsx";

interface AccountPickerProps {
  accounts: ChartOfAccount[];
  value: string;
  onChange: (accountId: string) => void;
  onAccountsChange?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function AccountPicker({
  accounts,
  value,
  onChange,
  onAccountsChange,
  placeholder = "Select an account...",
  compact = false,
}: AccountPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ name: "", category: "expense" as AccountCategory, tax_treatment: "gst" as TaxTreatment });
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = accounts.find((a) => a.id === value);

  const DROPDOWN_HEIGHT = 320; // max-h-72 = 18rem = 288px + padding

  // Update dropdown position when opening - ensure it stays in viewport
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If not enough space below and more space above, open upward
      const openUpward = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

      // Calculate available height for dropdown
      const availableHeight = openUpward
        ? Math.min(DROPDOWN_HEIGHT, spaceAbove - 10)
        : Math.min(DROPDOWN_HEIGHT, spaceBelow - 10);

      let top: number;
      if (openUpward) {
        // Position above the button (fixed positioning uses viewport coords)
        top = rect.top - availableHeight;
      } else {
        // Position below the button
        top = rect.bottom + 4;
      }

      // Ensure dropdown stays within viewport vertically
      top = Math.max(10, Math.min(top, viewportHeight - availableHeight - 10));

      // Ensure left position doesn't go off-screen
      let left = rect.left;
      const dropdownWidth = Math.max(rect.width, 300);
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 10;
      }

      setDropdownPosition({
        top,
        left: Math.max(10, left),
        width: rect.width,
        openUpward,
      });
    }
  }, [isOpen]);

  // Filter accounts by search
  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const incomeAccounts = filteredAccounts.filter((a) => a.category === "income");
  const expenseAccounts = filteredAccounts.filter((a) => a.category === "expense");
  const otherAccounts = filteredAccounts.filter((a) => a.category === "other");

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // Check if click is inside the container or inside the portal dropdown
      const isInContainer = containerRef.current?.contains(target);
      const isInDropdown = (target as Element).closest?.('[data-account-picker-dropdown]');
      if (!isInContainer && !isInDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(accountId: string) {
    onChange(accountId);
    setIsOpen(false);
    setSearch("");
    setShowQuickAdd(false);
  }

  async function handleQuickAdd() {
    if (!quickAddData.name.trim()) return;
    setSaving(true);
    try {
      const prefix = quickAddData.category === "income" ? "INC" : quickAddData.category === "expense" ? "EXP" : "OTH";
      const response = await fetch("/api/my-accounts/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: `${prefix}-${Date.now()}`,
          name: quickAddData.name.trim(),
          category: quickAddData.category,
          tax_treatment: quickAddData.tax_treatment,
        }),
      });
      const data = await response.json();
      if (data.account?.id) {
        onAccountsChange?.();
        onChange(data.account.id);
        setIsOpen(false);
        setShowQuickAdd(false);
        setQuickAddData({ name: "", category: "expense", tax_treatment: "gst" });
      }
    } catch (error) {
      console.error("Failed to create account:", error);
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        >
          {selectedAccount ? selectedAccount.name : placeholder}
        </button>

        {isOpen && typeof window !== "undefined" && createPortal(
          <div
            data-account-picker-dropdown
            className="fixed z-[9999] w-64 bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 overflow-y-auto"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              maxHeight: Math.min(DROPDOWN_HEIGHT, window.innerHeight - 40),
            }}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 dark:bg-gray-900 p-2 border-b border-gray-100 dark:border-gray-800 dark:border-gray-700">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input py-1.5 text-sm"
                placeholder="Search accounts..."
                autoFocus
              />
            </div>
            <AccountList
              incomeAccounts={incomeAccounts}
              expenseAccounts={expenseAccounts}
              otherAccounts={otherAccounts}
              onSelect={handleSelect}
              selectedId={value}
            />
            <QuickAddSection
              show={showQuickAdd}
              onToggle={() => setShowQuickAdd(!showQuickAdd)}
              data={quickAddData}
              onChange={setQuickAddData}
              onSave={handleQuickAdd}
              saving={saving}
            />
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={clsx(
          "w-full text-left input flex items-center justify-between",
          !selectedAccount && "text-gray-400"
        )}
      >
        <span>
          {selectedAccount ? (
            <>
              <span className="font-mono text-xs text-gray-500 mr-2">
                {selectedAccount.code}
              </span>
              {selectedAccount.name}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg
          className={clsx("w-5 h-5 text-gray-400 transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && typeof window !== "undefined" && createPortal(
        <div
          data-account-picker-dropdown
          className="fixed z-[9999] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 300),
            maxHeight: Math.min(DROPDOWN_HEIGHT, window.innerHeight - 40),
          }}
        >
          <div className="sticky top-0 bg-white dark:bg-gray-900 p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input py-1.5 text-sm"
              placeholder="Search accounts..."
              autoFocus
            />
          </div>
          <AccountList
            incomeAccounts={incomeAccounts}
            expenseAccounts={expenseAccounts}
            otherAccounts={otherAccounts}
            onSelect={handleSelect}
            selectedId={value}
          />
          <QuickAddSection
            show={showQuickAdd}
            onToggle={() => setShowQuickAdd(!showQuickAdd)}
            data={quickAddData}
            onChange={setQuickAddData}
            onSave={handleQuickAdd}
            saving={saving}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

function AccountList({
  incomeAccounts,
  expenseAccounts,
  otherAccounts,
  onSelect,
  selectedId,
}: {
  incomeAccounts: ChartOfAccount[];
  expenseAccounts: ChartOfAccount[];
  otherAccounts: ChartOfAccount[];
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  return (
    <div>
      {incomeAccounts.length > 0 && (
        <AccountGroup
          title="Income"
          accounts={incomeAccounts}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      )}
      {expenseAccounts.length > 0 && (
        <AccountGroup
          title="Expenses"
          accounts={expenseAccounts}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      )}
      {otherAccounts.length > 0 && (
        <AccountGroup
          title="Other"
          accounts={otherAccounts}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      )}
      {incomeAccounts.length === 0 && expenseAccounts.length === 0 && otherAccounts.length === 0 && (
        <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          No accounts found
        </div>
      )}
    </div>
  );
}

function AccountGroup({
  title,
  accounts,
  onSelect,
  selectedId,
}: {
  title: string;
  accounts: ChartOfAccount[];
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800 dark:bg-gray-800">
        {title}
      </div>
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className={clsx(
            "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-800 flex items-center justify-between dark:text-gray-200",
            selectedId === account.id && "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400"
          )}
        >
          <span>
            <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-2">{account.code}</span>
            {account.name}
          </span>
          {account.tax_treatment === "gst_free" && (
            <span className="text-xs text-gray-400 dark:text-gray-500">GST Free</span>
          )}
        </button>
      ))}
    </div>
  );
}

function QuickAddSection({
  show,
  onToggle,
  data,
  onChange,
  onSave,
  saving,
}: {
  show: boolean;
  onToggle: () => void;
  data: { name: string; category: AccountCategory; tax_treatment: TaxTreatment };
  onChange: (data: { name: string; category: AccountCategory; tax_treatment: TaxTreatment }) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
      {!show ? (
        <button
          onClick={onToggle}
          className="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left font-medium"
        >
          + Add New Account
        </button>
      ) : (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 dark:bg-gray-800 space-y-2">
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            placeholder="Account name..."
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
          <div className="flex gap-2">
            <select
              value={data.category}
              onChange={(e) => onChange({ ...data, category: e.target.value as AccountCategory })}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="other">Other</option>
            </select>
            <select
              value={data.tax_treatment}
              onChange={(e) => onChange({ ...data, tax_treatment: e.target.value as TaxTreatment })}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
            >
              <option value="gst">GST</option>
              <option value="gst_free">No GST</option>
              <option value="bas_excluded">Exclude</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saving || !data.name.trim()}
              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add"}
            </button>
            <button
              onClick={onToggle}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
