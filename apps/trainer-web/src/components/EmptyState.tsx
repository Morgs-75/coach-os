import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  headline: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}

export function EmptyState({ icon, headline, description, ctaLabel, ctaHref, onCtaClick }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-sm">
        <p className="text-3xl mb-3">{icon}</p>
        <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">{headline}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            {ctaLabel}
          </Link>
        )}
        {ctaLabel && onCtaClick && !ctaHref && (
          <button
            onClick={onCtaClick}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
