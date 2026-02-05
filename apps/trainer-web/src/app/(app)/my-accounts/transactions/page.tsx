import { Suspense } from "react";
import TransactionsClient from "./TransactionsClient";
import { TransactionTableSkeleton } from "@/components/ui/Skeleton";

// Prevent static prerendering - this page uses searchParams
export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionTableSkeleton />}>
      <TransactionsClient />
    </Suspense>
  );
}
