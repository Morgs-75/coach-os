"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const tabs = [
  { name: "Overview", href: "/my-accounts" },
  { name: "Transactions", href: "/my-accounts/transactions" },
  { name: "P&L", href: "/my-accounts/pnl" },
  { name: "Ledger", href: "/my-accounts/ledger" },
  { name: "Accounts", href: "/my-accounts/accounts" },
  { name: "Settings", href: "/my-accounts/settings" },
];

export default function MyAccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">myAccounts</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href ||
              (tab.href !== "/my-accounts" && pathname.startsWith(tab.href));
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={clsx(
                  "whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
