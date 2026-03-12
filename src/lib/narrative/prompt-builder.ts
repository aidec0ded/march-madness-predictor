/**
 * Prompt builder for the AI matchup narrative.
 *
 * Constructs the system message and user message for the Claude API
 * from structured team data, matchup context, and pool context.
 *
 * Key design decisions:
 * - All team data is formatted as labeled text blocks (not JSON)
 *   so the model can read them naturally
 * - The data dictionary is included in the system message so the model
 *   understands baselines and interaction effects
 * - Few-shot examples demonstrate the desired output format
 * - Pool context is included so the recommendation section is pool-aware
 */

import type { NarrativeRequest, NarrativeTeamData } from "@/types/narrative";
import type { ProbabilityBreakdown, MatchupOverrides } from "@/types/engine";
import { DATA_DICTIONARY } from "./data-dictionary";
import { EXAMPLE_NARRATIVES } from "./examples";

// ---------------------------------------------------------------------------
// System Message
// ---------------------------------------------------------------------------

const SYSTEM_MESSAGE = `You are an expert college basketball analyst providing a matchup breakdown for the NCAA Tournament. You specialize in synthesizing advanced statistics into actionable analysis.

## Rules
1. Ground every claim in the structured data provided. Do not speculate beyond what the data supports.
2. Synthesize interaction effects between data points — don't just list stats. Show how different factors combine to shape the matchup.
3. Always close with a concrete recommendation. Do not hedge without recommending.
4. Keep the total analysis under 600 words.
5. Use the 5-section structure shown in the examples below. Each section header uses ## markdown format.
6. When discussing stats, reference specific numbers from the data. Round to one decimal place.
7. Incorporate pool context (ownership, leverage score, pool size strategy) into your Recommendation section.

## Output Format
Your response MUST have exactly these 5 sections with these exact headers:

## Rating Profile
2-3 sentences comparing efficiency ratings across sources. Note agreement or disagreement between rating systems.

## Stylistic Matchup
3-4 sentences on how the teams' playing styles interact. Focus on pace/tempo dynamics, shooting profiles, and which team's preferred style is more likely to dominate.

## Key Factors
2-3 sentences identifying the 1-2 most impactful interaction effects. Reference coaching signals where data supports them.

## How This Game Plays Out
2-3 sentences describing a plausible game flow based on stylistic contrasts.

## Recommendation
2-3 sentences giving a concrete pick with probability and ownership context. Factor in pool strategy.

${DATA_DICTIONARY}`;

// ---------------------------------------------------------------------------
// Team Data Block Builder
// ---------------------------------------------------------------------------

/**
 * Formats a team's data into a labeled text block for the prompt.
 *
 * @param team - Serialized team data
 * @param label - "A" or "B" for identification
 * @returns Formatted team data string
 */
export function buildTeamDataBlock(
  team: NarrativeTeamData,
  label: "A" | "B"
): string {
  const lines: string[] = [];

  lines.push(
    `TEAM ${label}: ${team.name} (${team.seed} seed, ${team.region}, ${team.conference})`
  );

  // Efficiency ratings
  const effParts: string[] = [];
  if (team.kenpomAdjEM !== undefined) {
    effParts.push(
      `KenPom AdjEM ${team.kenpomAdjEM > 0 ? "+" : ""}${team.kenpomAdjEM.toFixed(1)} (AdjOE ${team.kenpomAdjOE?.toFixed(1)}, AdjDE ${team.kenpomAdjDE?.toFixed(1)})`
    );
  }
  if (team.torvikAdjEM !== undefined) {
    effParts.push(
      `Torvik AdjEM ${team.torvikAdjEM > 0 ? "+" : ""}${team.torvikAdjEM.toFixed(1)}`
    );
  }
  if (team.miyaBPR !== undefined) {
    effParts.push(
      `Miya BPR ${team.miyaBPR > 0 ? "+" : ""}${team.miyaBPR.toFixed(1)}`
    );
  }
  if (effParts.length > 0) {
    lines.push(`Efficiency: ${effParts.join(" | ")}`);
  }

  // Four Factors (Offense)
  lines.push(
    `Four Factors (Off): eFG ${team.offEfgPct.toFixed(1)}% | TO ${team.offToPct.toFixed(1)}% | ORB ${team.offOrbPct.toFixed(1)}% | FTR ${team.offFtRate.toFixed(1)}%`
  );

  // Four Factors (Defense)
  lines.push(
    `Four Factors (Def): eFG ${team.defEfgPct.toFixed(1)}% | TO ${team.defToPct.toFixed(1)}% | ORB ${team.defOrbPct.toFixed(1)}% | FTR ${team.defFtRate.toFixed(1)}%`
  );

  // Shooting
  lines.push(
    `Shooting (Off): 3PT ${team.offThreePtPct.toFixed(1)}% at ${team.offThreePtRate.toFixed(1)}% rate | FT ${team.offFtPct.toFixed(1)}%`
  );
  lines.push(
    `Shooting (Def): 3PT ${team.defThreePtPct.toFixed(1)}% at ${team.defThreePtRate.toFixed(1)}% rate`
  );

  // Tempo
  lines.push(
    `Tempo: ${team.adjTempo.toFixed(1)} adj tempo | Off poss ${team.avgPossLengthOff.toFixed(1)}s | Def poss ${team.avgPossLengthDef.toFixed(1)}s`
  );

  // Roster
  lines.push(
    `Roster: Exp ${team.experience.toFixed(2)} yrs | Continuity ${(team.minutesContinuity * 100).toFixed(0)}% | Bench ${(team.benchMinutesPct * 100).toFixed(1)}% | Height ${team.avgHeight.toFixed(1)}"`
  );

  // Coach
  lines.push(
    `Coach: ${team.coachName} — ${team.coachTournamentWins}W/${team.coachTournamentGames}G, ${team.coachFinalFours} F4, ${team.coachChampionships} titles, ${team.coachYearsHC} yrs HC`
  );

  // Style
  lines.push(`Style: 2-Foul Part ${team.twoFoulParticipation.toFixed(2)}`);

  // Schedule & Luck
  if (team.sosNetRating !== undefined) {
    lines.push(
      `Schedule: SoS Net ${team.sosNetRating >= 0 ? "+" : ""}${team.sosNetRating.toFixed(2)}`
    );
  }
  if (team.luck !== undefined) {
    lines.push(
      `Luck: ${team.luck >= 0 ? "+" : ""}${team.luck.toFixed(3)}`
    );
  }

  // Evan Miya metrics (only if data loaded)
  if (team.evanmiyaOpponentAdjust !== undefined) {
    const oppAdj = team.evanmiyaOpponentAdjust;
    const paceAdj = team.evanmiyaPaceAdjust ?? 0;
    const ksPerGame = team.evanmiyaKillShotsPerGame ?? 0;
    const ksAllowed = team.evanmiyaKillShotsAllowedPerGame ?? 0;
    const ksMargin = team.evanmiyaKillShotsMargin ?? 0;
    lines.push(
      `Evan Miya: Opp Adj ${oppAdj >= 0 ? "+" : ""}${oppAdj.toFixed(1)} | Pace Adj ${paceAdj >= 0 ? "+" : ""}${paceAdj.toFixed(1)} | Kill Shots ${ksPerGame.toFixed(1)}/game (allowed ${ksAllowed.toFixed(1)}) margin ${ksMargin >= 0 ? "+" : ""}${ksMargin.toFixed(1)}`
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Matchup Context Builder
// ---------------------------------------------------------------------------

/**
 * Formats the matchup context section (probabilities, breakdown, variance).
 */
function buildMatchupContext(req: NarrativeRequest): string {
  const { probA, spread, breakdown } = req;
  const probB = 1 - probA;

  const lines: string[] = [];
  lines.push("MATCHUP CONTEXT:");
  lines.push(
    `Win Probability: Team A ${(probA * 100).toFixed(1)}% | Team B ${(probB * 100).toFixed(1)}%`
  );
  lines.push(
    `Point Spread: ${spread > 0 ? "Team B" : "Team A"} by ${Math.abs(spread).toFixed(1)}`
  );
  lines.push(
    `Rating Differential: ${breakdown.ratingDifferential > 0 ? "+" : ""}${breakdown.ratingDifferential.toFixed(2)} (A - B)`
  );

  // Lever adjustments
  lines.push(
    `Lever Adjustments: Four Factors ${breakdown.fourFactorsAdjustment >= 0 ? "+" : ""}${breakdown.fourFactorsAdjustment.toFixed(3)} | Experience ${breakdown.experienceAdjustment >= 0 ? "+" : ""}${breakdown.experienceAdjustment.toFixed(3)} | Continuity ${breakdown.continuityAdjustment >= 0 ? "+" : ""}${breakdown.continuityAdjustment.toFixed(3)} | Coach ${breakdown.coachAdjustment >= 0 ? "+" : ""}${breakdown.coachAdjustment.toFixed(3)} | Opp Adj ${breakdown.opponentAdjustAdjustment >= 0 ? "+" : ""}${breakdown.opponentAdjustAdjustment.toFixed(3)} | Bench Depth ${breakdown.benchDepthAdjustment >= 0 ? "+" : ""}${breakdown.benchDepthAdjustment.toFixed(3)} | Pace Adj ${breakdown.paceAdjustAdjustment >= 0 ? "+" : ""}${breakdown.paceAdjustAdjustment.toFixed(3)} | Site Proximity ${breakdown.siteProximityAdjustment >= 0 ? "+" : ""}${breakdown.siteProximityAdjustment.toFixed(3)} | SoS ${breakdown.sosAdjustment >= 0 ? "+" : ""}${breakdown.sosAdjustment.toFixed(3)} | Luck Reg ${breakdown.luckRegressionAdjustment >= 0 ? "+" : ""}${breakdown.luckRegressionAdjustment.toFixed(3)}`
  );

  // Variance multipliers
  lines.push(
    `Variance: Tempo ×${breakdown.tempoVarianceMultiplier.toFixed(3)} | 3PT ×${breakdown.threePtVarianceMultiplier.toFixed(3)} | Combined ×${breakdown.combinedVarianceMultiplier.toFixed(3)}`
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Override Context Builder
// ---------------------------------------------------------------------------

/**
 * Formats per-matchup override information if any are applied.
 */
function buildOverrideContext(overrides: MatchupOverrides | undefined): string {
  if (!overrides) return "";

  const parts: string[] = [];

  if (overrides.injuryAdjustmentA && overrides.injuryAdjustmentA !== 0) {
    parts.push(`Team A injury: ${overrides.injuryAdjustmentA.toFixed(1)} eff pts`);
  }
  if (overrides.injuryAdjustmentB && overrides.injuryAdjustmentB !== 0) {
    parts.push(`Team B injury: ${overrides.injuryAdjustmentB.toFixed(1)} eff pts`);
  }
  if (overrides.recentFormA && overrides.recentFormA !== 0) {
    parts.push(
      `Team A recent form: ${overrides.recentFormA > 0 ? "+" : ""}${overrides.recentFormA.toFixed(1)} eff pts`
    );
  }
  if (overrides.recentFormB && overrides.recentFormB !== 0) {
    parts.push(
      `Team B recent form: ${overrides.recentFormB > 0 ? "+" : ""}${overrides.recentFormB.toFixed(1)} eff pts`
    );
  }
  if (overrides.restAdjustmentA && overrides.restAdjustmentA !== 0) {
    parts.push(
      `Team A rest: ${overrides.restAdjustmentA > 0 ? "+" : ""}${overrides.restAdjustmentA.toFixed(1)} eff pts`
    );
  }
  if (overrides.restAdjustmentB && overrides.restAdjustmentB !== 0) {
    parts.push(
      `Team B rest: ${overrides.restAdjustmentB > 0 ? "+" : ""}${overrides.restAdjustmentB.toFixed(1)} eff pts`
    );
  }

  if (parts.length === 0) return "";

  return `\nPER-MATCHUP OVERRIDES:\n${parts.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Pool Context Builder
// ---------------------------------------------------------------------------

/**
 * Formats pool/contest context for the prompt.
 */
function buildPoolContext(req: NarrativeRequest): string {
  const lines: string[] = [];
  lines.push("POOL CONTEXT:");
  lines.push(`Pool Strategy: ${req.poolDescription}`);
  lines.push(
    `Ownership: Team A ${req.ownershipA.toFixed(1)}% | Team B ${req.ownershipB.toFixed(1)}%`
  );
  lines.push(
    `Leverage Score: Team A ${req.leverageA.toFixed(2)} | Team B ${req.leverageB.toFixed(2)}`
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Few-Shot Examples
// ---------------------------------------------------------------------------

/**
 * Formats the few-shot examples section.
 */
function buildExamplesSection(): string {
  return EXAMPLE_NARRATIVES.map((ex, i) => {
    return `--- Example ${i + 1} ---\nScenario: ${ex.context}\n\n${ex.narrative}\n--- End Example ${i + 1} ---`;
  }).join("\n\n");
}

// ---------------------------------------------------------------------------
// Main Prompt Builder
// ---------------------------------------------------------------------------

export interface NarrativePrompt {
  system: string;
  userMessage: string;
}

/**
 * Builds the complete system + user message for the Claude API call.
 *
 * @param request - The narrative request with all data
 * @returns The system message and user message
 */
export function buildNarrativePrompt(request: NarrativeRequest): NarrativePrompt {
  const teamABlock = buildTeamDataBlock(request.teamAData, "A");
  const teamBBlock = buildTeamDataBlock(request.teamBData, "B");
  const matchupContext = buildMatchupContext(request);
  const overrideContext = buildOverrideContext(request.overrides);
  const poolContext = buildPoolContext(request);
  const examples = buildExamplesSection();

  const roundLabels: Record<string, string> = {
    R64: "Round of 64",
    R32: "Round of 32",
    S16: "Sweet 16",
    E8: "Elite 8",
    F4: "Final Four",
    NCG: "National Championship",
  };

  const userMessage = `Analyze this ${roundLabels[request.round] ?? request.round} matchup.

${teamABlock}

${teamBBlock}

${matchupContext}
${overrideContext}
${poolContext}

## Examples of Desired Output Format

${examples}

---

Now write your analysis of the matchup above. Follow the exact 5-section format shown in the examples. Ground all claims in the data provided. Be specific with numbers. Close with a concrete recommendation that incorporates pool context.`;

  return {
    system: SYSTEM_MESSAGE,
    userMessage,
  };
}

// ---------------------------------------------------------------------------
// Input Hashing (for client-side caching)
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic hash string from a NarrativeRequest.
 *
 * Used to key the client-side cache — if the same matchup with the
 * same data/levers/overrides/pool context is requested again, we can
 * serve the cached narrative instead of re-generating.
 *
 * Uses a simple string-based hash since we just need cache key uniqueness,
 * not cryptographic security.
 *
 * @param request - The narrative request
 * @returns A hash string
 */
export function hashNarrativeInput(request: NarrativeRequest): string {
  // Build a deterministic string from the key fields that affect the narrative
  const parts = [
    request.gameId,
    request.round,
    request.teamAData.name,
    request.teamBData.name,
    request.probA.toFixed(4),
    request.spread.toFixed(4),
    request.poolSizeBucket,
    request.ownershipA.toFixed(2),
    request.ownershipB.toFixed(2),
    // Include variance multipliers (they change with lever adjustments)
    request.breakdown.tempoVarianceMultiplier.toFixed(4),
    request.breakdown.threePtVarianceMultiplier.toFixed(4),
    request.breakdown.combinedVarianceMultiplier.toFixed(4),
    // Include new lever adjustments
    request.breakdown.opponentAdjustAdjustment.toFixed(4),
    request.breakdown.benchDepthAdjustment.toFixed(4),
    request.breakdown.paceAdjustAdjustment.toFixed(4),
    request.breakdown.siteProximityAdjustment.toFixed(4),
    request.breakdown.sosAdjustment.toFixed(4),
    request.breakdown.luckRegressionAdjustment.toFixed(4),
    // Include override total (changes with per-matchup overrides)
    request.breakdown.overrideAdjustments.total.toFixed(4),
  ];

  const str = parts.join("|");

  // Simple djb2 hash
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }

  return `nar_${(hash >>> 0).toString(36)}`;
}
