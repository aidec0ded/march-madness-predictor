/**
 * ChartSkeleton — Reusable pulsing placeholder for dynamically loaded charts.
 *
 * Used as the `loading` fallback for `next/dynamic` chart imports.
 */

"use client";

interface ChartSkeletonProps {
  /** Height in pixels */
  height?: number;
}

export function ChartSkeleton({ height = 320 }: ChartSkeletonProps) {
  return (
    <div
      style={{
        width: "100%",
        height,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        animation: "chartPulse 1.5s ease-in-out infinite",
      }}
    />
  );
}
