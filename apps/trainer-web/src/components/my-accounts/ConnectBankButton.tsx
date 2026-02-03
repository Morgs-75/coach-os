"use client";

import Link from "next/link";
import { clsx } from "clsx";

interface ConnectBankButtonProps {
  variant?: "default" | "small";
}

export function ConnectBankButton({ variant = "default" }: ConnectBankButtonProps) {
  if (variant === "small") {
    return (
      <Link
        href="/my-accounts/connect"
        className="text-sm text-brand-600 hover:text-brand-700"
      >
        + Add Account
      </Link>
    );
  }

  return (
    <Link href="/my-accounts/connect" className="btn-primary">
      Connect Bank Account
    </Link>
  );
}
