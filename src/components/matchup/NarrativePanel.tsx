"use client";

/**
 * NarrativePanel — AI matchup analysis display with streaming generation.
 *
 * States:
 * - Idle:       Placeholder text + "Generate Analysis" button with sparkle icon
 * - Generating: Streaming text with blinking cursor
 * - Complete:   Full narrative with "Regenerate" button
 * - Error:      Red border, error message, "Retry" button
 *
 * The narrative is rendered with a lightweight markdown renderer that
 * handles ## headers and **bold** text. No external markdown library
 * is needed.
 *
 * Styling follows the project's dark-mode-first design with CSS variables.
 */

import React, { useMemo } from "react";
import { useMatchupNarrative } from "@/hooks/useMatchupNarrative";
import type { TeamSeason } from "@/types/team";
import type { MatchupAnalysis } from "@/types/matchup-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NarrativePanelProps {
  /** The computed matchup analysis */
  analysis: MatchupAnalysis | null;
  /** Team A data */
  teamA: TeamSeason | null;
  /** Team B data */
  teamB: TeamSeason | null;
}

// ---------------------------------------------------------------------------
// Simple Markdown Renderer
// ---------------------------------------------------------------------------

/**
 * Renders a subset of markdown into React elements:
 * - ## headers → <h3> elements
 * - **bold** → <strong> elements
 * - Paragraphs separated by double newlines
 */
function renderNarrativeMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const content = currentParagraph.join(" ");
    if (content.trim()) {
      elements.push(
        <p key={key++} className="narrative-panel__paragraph">
          {renderBold(content)}
        </p>
      );
    }
    currentParagraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // ## Header
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      const headerText = trimmed.slice(3);
      const isRecommendation =
        headerText.toLowerCase().includes("recommendation");
      elements.push(
        <h3
          key={key++}
          className={`narrative-panel__section-header ${isRecommendation ? "narrative-panel__section-header--recommendation" : ""}`}
        >
          {headerText}
        </h3>
      );
      continue;
    }

    // Empty line = paragraph break
    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    // Regular text line
    currentParagraph.push(trimmed);
  }

  flushParagraph();
  return elements;
}

/**
 * Replaces **bold** markers with <strong> elements.
 */
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Sparkle Icon SVG
// ---------------------------------------------------------------------------

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NarrativePanel({ analysis, teamA, teamB }: NarrativePanelProps) {
  const { state, generate, reset } = useMatchupNarrative(
    analysis,
    teamA,
    teamB
  );

  const renderedContent = useMemo(() => {
    if (!state.text) return null;
    return renderNarrativeMarkdown(state.text);
  }, [state.text]);

  const isDisabled = !analysis || !teamA || !teamB;

  return (
    <div
      className={`narrative-panel ${state.status === "error" ? "narrative-panel--error" : ""}`}
    >
      {/* Header */}
      <div className="narrative-panel__header">
        <div className="narrative-panel__title">
          <SparkleIcon />
          <span>AI Matchup Analysis</span>
        </div>

        {state.status === "idle" && (
          <button
            type="button"
            className="narrative-panel__btn narrative-panel__btn--generate"
            onClick={generate}
            disabled={isDisabled}
            aria-label="Generate AI analysis"
          >
            <SparkleIcon />
            Generate Analysis
          </button>
        )}

        {state.status === "generating" && (
          <span className="narrative-panel__generating-label">
            Analyzing...
          </span>
        )}

        {state.status === "complete" && (
          <button
            type="button"
            className="narrative-panel__btn narrative-panel__btn--regenerate"
            onClick={() => {
              reset();
              // Small delay so the reset state renders before re-generating
              setTimeout(generate, 50);
            }}
            aria-label="Regenerate analysis"
          >
            Regenerate
          </button>
        )}

        {state.status === "error" && (
          <button
            type="button"
            className="narrative-panel__btn narrative-panel__btn--retry"
            onClick={generate}
            aria-label="Retry analysis"
          >
            Retry
          </button>
        )}
      </div>

      {/* Body */}
      <div className="narrative-panel__body">
        {state.status === "idle" && (
          <p className="narrative-panel__placeholder">
            Click &quot;Generate Analysis&quot; to get an AI-powered breakdown
            of this matchup, including rating profiles, stylistic analysis, key
            factors, and a pool-context-aware recommendation.
          </p>
        )}

        {(state.status === "generating" || state.status === "complete") &&
          renderedContent && (
            <div className="narrative-panel__content">
              {renderedContent}
              {state.status === "generating" && (
                <span className="narrative-panel__cursor">|</span>
              )}
            </div>
          )}

        {state.status === "error" && (
          <div className="narrative-panel__error">
            <p>{state.error ?? "An unexpected error occurred."}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .narrative-panel {
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background-color: var(--bg-surface);
          overflow: hidden;
        }
        .narrative-panel--error {
          border-color: var(--accent-danger, #ef4444);
        }
        .narrative-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-subtle);
          background-color: var(--bg-surface);
        }
        .narrative-panel__title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .narrative-panel__btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid var(--border-subtle);
          flex-shrink: 0;
        }
        .narrative-panel__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .narrative-panel__btn--generate {
          color: var(--text-primary);
          background-color: var(--accent-primary);
          border-color: var(--accent-primary);
        }
        .narrative-panel__btn--generate:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        .narrative-panel__btn--regenerate {
          color: var(--text-secondary);
          background-color: transparent;
        }
        .narrative-panel__btn--regenerate:hover {
          color: var(--text-primary);
          border-color: var(--accent-primary);
        }
        .narrative-panel__btn--retry {
          color: var(--accent-danger, #ef4444);
          background-color: transparent;
          border-color: var(--accent-danger, #ef4444);
        }
        .narrative-panel__btn--retry:hover {
          background-color: rgba(239, 68, 68, 0.1);
        }
        .narrative-panel__generating-label {
          font-size: 0.75rem;
          color: var(--accent-primary);
          font-weight: 600;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .narrative-panel__body {
          padding: 16px;
        }
        .narrative-panel__placeholder {
          color: var(--text-muted);
          font-size: 0.8125rem;
          line-height: 1.6;
          text-align: center;
          padding: 12px 0;
        }
        .narrative-panel__content {
          font-size: 0.8125rem;
          line-height: 1.65;
          color: var(--text-secondary);
        }
        .narrative-panel__error {
          font-size: 0.8125rem;
          color: var(--accent-danger, #ef4444);
          line-height: 1.5;
        }
        .narrative-panel__cursor {
          display: inline-block;
          color: var(--accent-primary);
          font-weight: 700;
          animation: blink 0.8s step-end infinite;
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* Global styles for rendered markdown content (cannot use jsx scoped for nested elements) */}
      <style jsx global>{`
        .narrative-panel__section-header {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 16px 0 6px;
          padding: 0;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .narrative-panel__section-header:first-child {
          margin-top: 0;
        }
        .narrative-panel__section-header--recommendation {
          border-left: 3px solid var(--accent-primary);
          padding-left: 10px;
        }
        .narrative-panel__paragraph {
          margin: 0 0 8px;
          color: var(--text-secondary);
        }
        .narrative-panel__paragraph:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
