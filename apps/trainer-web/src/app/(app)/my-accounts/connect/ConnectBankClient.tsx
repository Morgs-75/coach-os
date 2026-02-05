"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConnectBankClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (success === "true") {
      setStatus("success");
      // Trigger sync after successful connection
      syncTransactions();
    } else if (errorParam) {
      setStatus("error");
      setError(errorParam);
    }
  }, [searchParams]);

  async function initiateConnection() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/my-accounts/connect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      // Redirect to Basiq consent UI
      if (data.consentUrl) {
        window.location.href = data.consentUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  }

  async function syncTransactions() {
    try {
      const response = await fetch("/api/my-accounts/sync", {
        method: "POST",
      });

      if (response.ok) {
        // Redirect to transactions after sync
        router.push("/my-accounts/transactions");
      }
    } catch (err) {
      console.error("Sync error:", err);
    }
  }

  if (status === "success") {
    return (
      <div className="card p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Bank Connected Successfully
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your bank account has been connected. We're now syncing your transactions...
          </p>
          <div className="animate-pulse text-gray-500">
            Syncing transactions...
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Connection Failed
          </h2>
          <p className="text-red-600 mb-6">
            {error || "Failed to connect your bank account. Please try again."}
          </p>
          <button onClick={initiateConnection} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏦</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Connect Your Bank Account
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Securely connect your business bank account to import transactions automatically.
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <span className="text-green-600">🔒</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Bank-level Security</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your credentials are never stored. We use Basiq, a trusted open banking provider.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600">👁️</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Read-only Access</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We can only view your transactions. We cannot move money or make changes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <span className="text-purple-600">🤖</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">AI-Powered Categorization</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We'll automatically suggest categories for your transactions using AI.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={initiateConnection}
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "Connecting..." : "Connect Your Bank"}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          By connecting, you agree to share your transaction data with Coach OS.
          You can disconnect at any time.
        </p>
      </div>
    </div>
  );
}
