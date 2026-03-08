// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadingSpinnerProps {
  /** Size in pixels (default: 24) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SVG animated loading spinner.
 *
 * Uses --accent-primary for the spinner color.
 * Animates with CSS spin animation.
 */
export function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-20"
        style={{ color: "var(--accent-primary)" }}
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ color: "var(--accent-primary)" }}
      />
    </svg>
  );
}
