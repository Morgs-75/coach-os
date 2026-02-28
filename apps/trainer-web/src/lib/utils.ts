export function formatCurrency(cents: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Format currency with 2 decimal places, negatives in brackets
export function formatCurrencyLedger(cents: number, currency = "AUD"): string {
  const isNegative = cents < 0;
  const absValue = Math.abs(cents);
  const formatted = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue / 100);

  return isNegative ? `(${formatted})` : formatted;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Convert an Australian phone number to E.164 format for Twilio.
 * Handles: 0413974875 → +61413974875, 61413974875 → +61413974875,
 *          +61413974875 → +61413974875 (no-op).
 * Returns null for empty/invalid input.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[\s\-()]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+61" + digits.slice(1);
  if (digits.startsWith("61") && digits.length >= 11) return "+" + digits;
  return digits.length >= 10 ? "+61" + digits : digits;
}
