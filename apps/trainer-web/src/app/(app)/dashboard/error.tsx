"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Dashboard Error
        </h2>
        <p className="text-red-600 dark:text-red-300 mb-4">
          {error.message}
        </p>
        {error.digest && (
          <p className="text-xs text-red-500 mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
