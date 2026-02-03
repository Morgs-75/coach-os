import { clsx } from "clsx";

interface MetricCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "danger" | "warning" | "success";
}

export function MetricCard({
  label,
  value,
  subvalue,
  trend,
  variant = "default",
}: MetricCardProps) {
  return (
    <div className="card p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p
        className={clsx(
          "mt-2 text-3xl font-semibold",
          variant === "danger" && "text-red-600",
          variant === "warning" && "text-amber-600",
          variant === "success" && "text-green-600",
          variant === "default" && "text-gray-900"
        )}
      >
        {value}
      </p>
      {subvalue && (
        <p
          className={clsx(
            "mt-1 text-sm",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600",
            !trend && "text-gray-500"
          )}
        >
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {subvalue}
        </p>
      )}
    </div>
  );
}
