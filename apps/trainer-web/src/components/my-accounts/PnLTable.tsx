import { formatCurrency } from "@/lib/utils";
import { clsx } from "clsx";

interface AccountTotal {
  account_id: string;
  account_code: string;
  account_name: string;
  category: string;
  total_cents: number;
  gst_cents: number;
  transaction_count: number;
}

interface PnLTableProps {
  title: string;
  accounts: AccountTotal[];
  total: number;
  variant: "income" | "expense";
}

export function PnLTable({ title, accounts, total, variant }: PnLTableProps) {
  const headerColor = variant === "income" ? "bg-green-50" : "bg-red-50";
  const totalColor = variant === "income" ? "text-green-600" : "text-red-600";

  return (
    <div className="card overflow-hidden">
      <div className={clsx("px-6 py-4 border-b border-gray-200", headerColor)}>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Account
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Transactions
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              GST
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {accounts.map((account) => (
            <tr key={account.account_id} className="hover:bg-gray-50">
              <td className="px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{account.account_name}</p>
                  <p className="text-xs text-gray-500 font-mono">{account.account_code}</p>
                </div>
              </td>
              <td className="px-6 py-3 text-right text-sm text-gray-500">
                {account.transaction_count}
              </td>
              <td className="px-6 py-3 text-right text-sm text-gray-500">
                {formatCurrency(account.gst_cents)}
              </td>
              <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                {formatCurrency(Math.abs(account.total_cents))}
              </td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                No {variant} transactions yet
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-6 py-3 text-sm font-semibold text-gray-900">
              Total {title}
            </td>
            <td className="px-6 py-3 text-right text-sm text-gray-500">
              {accounts.reduce((sum, a) => sum + a.transaction_count, 0)}
            </td>
            <td className="px-6 py-3 text-right text-sm text-gray-500">
              {formatCurrency(accounts.reduce((sum, a) => sum + a.gst_cents, 0))}
            </td>
            <td className={clsx("px-6 py-3 text-right text-sm font-bold", totalColor)}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
