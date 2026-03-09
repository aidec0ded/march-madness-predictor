"use client";

/**
 * GuidancePanel
 *
 * Collapsible panel that displays contextual guidance messages for the
 * user's bracket. Messages are color-coded by severity and support
 * individual dismissal. Renders below the header bar when open.
 */

import { useState, useCallback } from "react";
import { useGuidance } from "@/hooks/useGuidance";
import type { GuidanceSeverity, GuidanceCategory } from "@/types/guidance";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<GuidanceSeverity, string> = {
  danger: "var(--severity-danger, #ef4444)",
  warning: "var(--severity-warning, #f59e0b)",
  info: "var(--severity-info, #3b82f6)",
};

const SEVERITY_BG: Record<GuidanceSeverity, string> = {
  danger: "rgba(239, 68, 68, 0.08)",
  warning: "rgba(245, 158, 11, 0.08)",
  info: "rgba(59, 130, 246, 0.08)",
};

const SEVERITY_LABELS: Record<GuidanceSeverity, string> = {
  danger: "HIGH",
  warning: "WARN",
  info: "INFO",
};

const CATEGORY_ICONS: Record<GuidanceCategory, string> = {
  upset_volume: "\u26A0",       // warning sign
  chalk_concentration: "\u2696", // scales
  variance_mismatch: "\u2194",  // left-right arrow
  lever_conflict: "\u26A1",     // lightning
  recency_divergence: "\u2B06", // upward arrow
  tempo_explanation: "\u23F1",  // stopwatch
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuidancePanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidancePanel({ isOpen, onClose }: GuidancePanelProps) {
  const messages = useGuidance();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clearDismissals = useCallback(() => {
    setDismissedIds(new Set());
  }, []);

  if (!isOpen) return null;

  const visibleMessages = messages.filter((m) => !dismissedIds.has(m.id));
  const dismissedCount = messages.length - visibleMessages.length;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-primary)",
        backgroundColor: "var(--bg-secondary, #1a1a2e)",
        maxHeight: "300px",
        overflowY: "auto",
        padding: "12px 24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Guidance
          </span>
          {visibleMessages.length > 0 && (
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--text-tertiary, #888)",
                backgroundColor: "var(--bg-tertiary, #2a2a3e)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {visibleMessages.length}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {dismissedCount > 0 && (
            <button
              type="button"
              onClick={clearDismissals}
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-tertiary, #888)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              Show {dismissedCount} dismissed
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: "0.75rem",
              color: "var(--text-tertiary, #888)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              lineHeight: 1,
            }}
            aria-label="Close guidance panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      {visibleMessages.length === 0 ? (
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-tertiary, #888)",
            padding: "8px 0",
          }}
        >
          {messages.length === 0
            ? "No guidance to display. Make bracket picks to see contextual advice."
            : "All guidance messages dismissed."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "6px",
                backgroundColor: SEVERITY_BG[message.severity],
                borderLeft: `3px solid ${SEVERITY_COLORS[message.severity]}`,
              }}
            >
              {/* Icon */}
              <span
                style={{
                  fontSize: "0.875rem",
                  lineHeight: "1.4",
                  flexShrink: 0,
                }}
              >
                {CATEGORY_ICONS[message.category]}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "2px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      color: SEVERITY_COLORS[message.severity],
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {SEVERITY_LABELS[message.severity]}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {message.title}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {message.description}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => dismiss(message.id)}
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--text-tertiary, #888)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                aria-label={`Dismiss: ${message.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
