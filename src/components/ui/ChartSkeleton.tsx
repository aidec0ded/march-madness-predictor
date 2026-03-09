/**
 * ChartSkeleton — Reusable pulsing placeholder for dynamically loaded charts.
 *
 * Used as the `loading` fallback for `next/dynamic` chart imports.
 */

interface ChartSkeletonProps {
  /** Height in pixels */
  height?: number;
}

export function ChartSkeleton({ height = 320 }: ChartSkeletonProps) {
  return (
    <div className="chart-skeleton">
      <style jsx>{`
        .chart-skeleton {
          width: 100%;
          height: ${height}px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          animation: chartPulse 1.5s ease-in-out infinite;
        }
        @keyframes chartPulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
