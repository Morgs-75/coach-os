import { formatCurrency, formatDate } from "@/lib/utils";
import { clsx } from "clsx";
import type { CashbookLedger } from "@coach-os/shared";

interface LedgerEntry extends CashbookLedger {
  running_balance: number;
}

interface LedgerTableProps {
  entries: LedgerEntry[];
}

export function LedgerTable({ entries }: LedgerTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Debit
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Credit
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                GST
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {formatDate(entry.transaction_date)}
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-xs">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {entry.merchant_name || entry.description}
                    </p>
                    <p className="text-xs text-gray-500">{entry.bank_account_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      entry.account_category === "income" && "bg-green-100 text-green-800",
                      entry.account_category === "expense" && "bg-red-100 text-red-800",
                      entry.account_category === "other" && "bg-gray-100 text-gray-800"
                    )}
                  >
                    {entry.account_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900 whitespace-nowrap">
                  {entry.direction === "debit" ? formatCurrency(entry.amount_cents) : "-"}
                </td>
                <td className="px-4 py-3 text-right text-sm text-green-600 whitespace-nowrap">
                  {entry.direction === "credit" ? formatCurrency(entry.amount_cents) : "-"}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-500 whitespace-nowrap">
                  {entry.gst_cents > 0 ? formatCurrency(entry.gst_cents) : "-"}
                </td>
                <td
                  className={clsx(
                    "px-4 py-3 text-right text-sm font-medium whitespace-nowrap",
                    entry.running_balance >= 0 ? "text-gray-900" : "text-red-600"
                  )}
                >
                  {formatCurrency(entry.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
