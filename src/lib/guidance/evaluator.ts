/**
 * Guidance Evaluator
 *
 * Runs all registered guidance rules against the current bracket state,
 * deduplicates messages by ID, and sorts them by severity (danger first,
 * then warning, then info).
 */

import type {
  GuidanceContext,
  GuidanceMessage,
  GuidanceRule,
  GuidanceSeverity,
} from "@/types/guidance";
import { upsetVolumeRule } from "./rules/upset-volume";
import { chalkConcentrationRule } from "./rules/chalk-concentration";
import { varianceMismatchRule } from "./rules/variance-mismatch";
import { leverConflictRule } from "./rules/lever-conflict";
import { recencyDivergenceRule } from "./rules/recency-divergence";
import { tempoExplanationRule } from "./rules/tempo-explanation";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All guidance rules in evaluation order */
const ALL_RULES: GuidanceRule[] = [
  upsetVolumeRule,
  chalkConcentrationRule,
  varianceMismatchRule,
  leverConflictRule,
  recencyDivergenceRule,
  tempoExplanationRule,
];

// ---------------------------------------------------------------------------
// Severity ordering (lower = more important)
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<GuidanceSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate all guidance rules and return deduplicated, sorted messages.
 *
 * @param context - The current bracket state context
 * @returns Array of guidance messages, sorted by severity (danger > warning > info)
 */
export function evaluateGuidance(context: GuidanceContext): GuidanceMessage[] {
  const allMessages: GuidanceMessage[] = [];

  for (const rule of ALL_RULES) {
    try {
      const messages = rule(context);
      allMessages.push(...messages);
    } catch {
      // Individual rule failures should not break the entire guidance system.
      // In production, we would log these errors.
      continue;
    }
  }

  // Deduplicate by ID (first occurrence wins)
  const seen = new Set<string>();
  const deduplicated: GuidanceMessage[] = [];

  for (const message of allMessages) {
    if (!seen.has(message.id)) {
      seen.add(message.id);
      deduplicated.push(message);
    }
  }

  // Sort by severity (danger > warning > info)
  deduplicated.sort((a, b) => {
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  return deduplicated;
}
