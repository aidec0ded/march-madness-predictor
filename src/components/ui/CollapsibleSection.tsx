"use client";

import React, { useState } from "react";

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section with a chevron toggle indicator.
 *
 * Reusable across any panel that needs grouped, expandable content
 * (e.g., lever panels, settings panels). Uses styled-jsx for scoped styles.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <div className="collapsible-section">
      <button
        type="button"
        className="collapsible-section__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="collapsible-section__title">{title}</span>
        <span
          className={`collapsible-section__chevron ${isExpanded ? "collapsible-section__chevron--open" : ""}`}
        >
          ▸
        </span>
      </button>
      {isExpanded && (
        <div className="collapsible-section__content">{children}</div>
      )}
      <style jsx>{`
        .collapsible-section {
          border-bottom: 1px solid var(--border-subtle);
        }
        .collapsible-section__toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 0;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
        }
        .collapsible-section__toggle:hover {
          color: var(--accent-primary);
        }
        .collapsible-section__title {
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .collapsible-section__chevron {
          font-size: 0.875rem;
          transition: transform 0.2s ease;
          color: var(--text-muted);
        }
        .collapsible-section__chevron--open {
          transform: rotate(90deg);
        }
        .collapsible-section__content {
          padding: 0 0 16px 0;
        }
      `}</style>
    </div>
  );
}
