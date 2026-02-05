import { Suspense } from "react";
import ConnectBankClient from "./ConnectBankClient";

// Prevent static prerendering - this page uses searchParams
export const dynamic = "force-dynamic";

export default function ConnectBankPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 animate-pulse">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto"></div>
          </div>
        </div>
      </div>
    }>
      <ConnectBankClient />
    </Suspense>
  );
}
