---
name: generate-narrative
description: Build AI narrative prompt from matchup data. Use when testing or debugging the narrative prompt construction for a matchup.
argument-hint: <TeamA> vs <TeamB> [--pool=small|medium|large|very_large]
---

# Generate Narrative Skill

Build and display the AI narrative prompt for the matchup `$ARGUMENTS`, showing exactly what would be sent to Claude for analysis.

## Steps

### 1. Identify Teams

Parse the arguments to extract two team names. Look up their `TeamSeason` data from the database or static data files.

### 2. Build Team Data Blocks

```typescript
import { buildTeamDataBlock } from "@/lib/narrative/prompt-builder";
import type { NarrativeTeamData } from "@/types/narrative";

// Serialize TeamSeason → NarrativeTeamData
// (see src/hooks/useMatchupNarrative.ts → serializeTeamData() for reference)
function serializeTeamData(team: TeamSeason): NarrativeTeamData {
  return {
    name: team.team.shortName,
    seed: team.tournamentEntry?.seed ?? 0,
    region: team.tournamentEntry?.region ?? "Unknown",
    conference: team.team.conference,
    kenpomAdjOE: team.ratings.kenpom?.adjOE,
    kenpomAdjDE: team.ratings.kenpom?.adjDE,
    kenpomAdjEM: team.ratings.kenpom?.adjEM,
    // ... all other fields
  };
}

const blockA = buildTeamDataBlock(serializeTeamData(teamA), "A");
const blockB = buildTeamDataBlock(serializeTeamData(teamB), "B");
```

### 3. Run Probability Engine

```typescript
import { resolveMatchup } from "@/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";

const result = resolveMatchup(teamA, teamB, { ...DEFAULT_ENGINE_CONFIG });
```

### 4. Build Full Prompt

```typescript
import { buildNarrativePrompt, hashNarrativeInput } from "@/lib/narrative/prompt-builder";
import type { NarrativeRequest } from "@/types/narrative";

const request: NarrativeRequest = {
  gameId: "R64-East-1", // or appropriate game ID
  round: "R64",
  teamAData: serializeTeamData(teamA),
  teamBData: serializeTeamData(teamB),
  probA: result.winProbabilityA,
  spread: ratingDiffToSpread(adjustedDiff),
  breakdown: result.breakdown,
  poolSizeBucket: "medium", // or from --pool argument
  ownershipA: getOwnership(teamA.teamId, "R64"),
  ownershipB: getOwnership(teamB.teamId, "R64"),
  leverageA: leverageScoreA,
  leverageB: leverageScoreB,
  poolDescription: POOL_STRATEGY_CONFIGS[poolSizeBucket].description,
};

const { system, userMessage } = buildNarrativePrompt(request);
const hash = hashNarrativeInput(request);
```

### 5. Format Output

Display the constructed prompt in sections:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NARRATIVE PROMPT: [Team A] vs [Team B]
Cache Hash: nar_XXXXXXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── SYSTEM MESSAGE ──────────────────────────────
[Full system message with role, rules, data dictionary]

── USER MESSAGE ────────────────────────────────
[Full user message with team blocks, context, examples]

── PROMPT STATS ────────────────────────────────
System tokens (approx): ~XXXX
User tokens (approx):   ~XXXX
Model: claude-sonnet-4-20250514
Max output tokens: 1024
```

Optionally, if the user wants to actually call the API, show how:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  system,
  messages: [{ role: "user", content: userMessage }],
});
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/narrative/prompt-builder.ts` | `buildNarrativePrompt()`, `buildTeamDataBlock()`, `hashNarrativeInput()` |
| `src/lib/narrative/data-dictionary.ts` | Stat explanations, baselines, interaction effects |
| `src/lib/narrative/examples.ts` | Few-shot example narratives |
| `src/types/narrative.ts` | `NarrativeRequest`, `NarrativeTeamData`, `NarrativeState` |
| `src/hooks/useMatchupNarrative.ts` | Client-side hook with `serializeTeamData()` reference |
| `src/app/api/narrative/route.ts` | API route handler (SSE streaming) |

## Prompt Structure Reference

The prompt has two parts:

**System message** contains:
- Role definition (expert basketball analyst)
- 7 rules (ground claims, synthesize interactions, recommend, <600 words, 5 sections, specific numbers, pool context)
- 5-section output format specification
- Full data dictionary with baselines and interaction effects

**User message** contains (in order):
1. Round label
2. Team A data block (all stats labeled)
3. Team B data block (all stats labeled)
4. Matchup context (probabilities, spread, variance multipliers)
5. Per-matchup overrides (if any)
6. Pool context (strategy, ownership, leverage scores)
7. Few-shot example(s)
8. Generation instruction

## 5-Section Output Format

```
## Rating Profile
## Stylistic Matchup
## Key Factors
## How This Game Plays Out
## Recommendation
```
