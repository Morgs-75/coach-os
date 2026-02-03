"use client";

import { useState, useRef, useEffect } from "react";
import type { ChartOfAccount } from "@coach-os/shared";
import { clsx } from "clsx";

interface AccountPickerProps {
  accounts: ChartOfAccount[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder = "Select an account...",
  compact = false,
}: AccountPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = accounts.find((a) => a.id === value);

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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
  }

  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          {selectedAccount ? selectedAccount.name : placeholder}
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-y-auto">
            <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
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
          </div>
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

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-y-auto">
          <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input py-1.5 text-sm"
              placeholder="Search accounts..."
            />
          </div>
          <AccountList
            incomeAccounts={incomeAccounts}
            expenseAccounts={expenseAccounts}
            otherAccounts={otherAccounts}
            onSelect={handleSelect}
            selectedId={value}
          />
        </div>
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
        <div className="px-3 py-4 text-sm text-gray-500 text-center">
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
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
        {title}
      </div>
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className={clsx(
            "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between",
            selectedId === account.id && "bg-brand-50 text-brand-700"
          )}
        >
          <span>
            <span className="font-mono text-xs text-gray-400 mr-2">{account.code}</span>
            {account.name}
          </span>
          {account.tax_treatment === "gst_free" && (
            <span className="text-xs text-gray-400">GST Free</span>
          )}
        </button>
      ))}
    </div>
  );
}
