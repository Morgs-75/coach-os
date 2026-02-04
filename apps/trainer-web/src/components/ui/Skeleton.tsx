"use client";

import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse bg-gray-200 dark:bg-gray-700 rounded",
        className
      )}
    />
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TransactionTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 w-10"><Skeleton className="h-4 w-4" /></th>
              <th className="px-4 py-3 text-left"><Skeleton className="h-4 w-16" /></th>
              <th className="px-4 py-3 text-left"><Skeleton className="h-4 w-32" /></th>
              <th className="px-4 py-3 text-left"><Skeleton className="h-4 w-24" /></th>
              <th className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </td>
                <td className="px-4 py-3"><Skeleton className="h-6 w-28 rounded-full" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("card p-6", className)}>
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}
