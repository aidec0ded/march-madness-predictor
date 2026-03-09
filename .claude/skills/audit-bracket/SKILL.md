---
name: audit-bracket
description: Run guidance system against current bracket state, surface all warnings. Use when reviewing a bracket for issues, conflicts, or optimization opportunities.
argument-hint: [--picks=JSON] [--levers=JSON] [--pool=small|medium|large|very_large]
---

# Audit Bracket Skill

Run the full guidance system against the current bracket state (`$ARGUMENTS`) and surface all warnings, conflicts, and optimization opportunities.

## Steps

### 1. Build Guidance Context

Construct a `GuidanceContext` from the bracket state:

```typescript
import type { GuidanceContext } from "@/types/guidance";
import type { TeamSeason } from "@/types/team";
import type { GlobalLevers, MatchupOverrides } from "@/types/engine";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";

const context: GuidanceContext = {
  picks: {},          // gameId -> winning teamId (from --picks or loaded from DB)
  teams: new Map(),   // teamId -> TeamSeason (loaded from DB/data)
  globalLevers: DEFAULT_GLOBAL_LEVERS, // or from --levers
  matchupOverrides: {},                // gameId -> MatchupOverrides
  simulationResult: null,             // or from a recent simulation
};
```

### 2. Run All Guidance Rules

```typescript
import { evaluateGuidance } from "@/lib/guidance/evaluator";

const messages = evaluateGuidance(context);
```

The evaluator runs these 6 rules (all pure functions, `GuidanceContext → GuidanceMessage[]`):

| Rule | File | What it checks |
|------|------|----------------|
| `upsetVolumeRule` | `rules/upset-volume.ts` | R64 upsets vs historical avg (~4). Warning >6, danger ≥8 |
| `chalkConcentrationRule` | `rules/chalk-concentration.ts` | % picks matching higher seed. Warning ≥80%, danger ≥90% |
| `varianceMismatchRule` | `rules/variance-mismatch.ts` | High 3PT rate teams (≥38%) picked to S16+ |
| `leverConflictRule` | `rules/lever-conflict.ts` | High experience/continuity/coach weight vs team profile contradiction |
| `recencyDivergenceRule` | `rules/recency-divergence.ts` | \|recentForm override\| > 2.0 or rating sources disagree >5 pts |
| `tempoExplanationRule` | `rules/tempo-explanation.ts` | Slow-paced teams (<64 adj tempo) in R64 upset picks |

### 3. Format Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRACKET AUDIT
Picks: XX/63  |  Pool: medium  |  Levers: default
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 DANGER (X messages)
─────────────────────
[ID] Title
     Description
     Related: gameId / teamIds

🟡 WARNING (X messages)
─────────────────────
[ID] Title
     Description
     Related: gameId / teamIds

🔵 INFO (X messages)
─────────────────────
[ID] Title
     Description
     Related: gameId / teamIds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
  Total messages:  XX
  Danger:          X
  Warning:         X
  Info:            X
  Bracket health:  [Good / Needs Attention / Critical]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Optional: Ownership Analysis

If pool context is provided, include ownership analysis:

```typescript
import { buildFullOwnershipModel } from "@/lib/game-theory/ownership";
import { getStrategyRecommendation, POOL_STRATEGY_CONFIGS } from "@/lib/game-theory/strategy";

const ownershipModel = buildFullOwnershipModel(Array.from(teams.values()));
const poolConfig = POOL_STRATEGY_CONFIGS[poolSizeBucket];

// For each pick, check leverage score
for (const [gameId, teamId] of Object.entries(picks)) {
  const ownership = ownershipModel.getOwnership(teamId, round);
  const rec = getStrategyRecommendation(winProb, ownership, poolConfig);
  // Surface contrarian value or avoid recommendations
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/guidance/evaluator.ts` | `evaluateGuidance()` — master evaluator |
| `src/lib/guidance/rules/upset-volume.ts` | Upset count vs historical average |
| `src/lib/guidance/rules/chalk-concentration.ts` | Higher-seed pick percentage |
| `src/lib/guidance/rules/variance-mismatch.ts` | 3PT-dependent teams advancing deep |
| `src/lib/guidance/rules/lever-conflict.ts` | Lever weights vs picked team profiles |
| `src/lib/guidance/rules/recency-divergence.ts` | Form overrides or source disagreement |
| `src/lib/guidance/rules/tempo-explanation.ts` | Slow-pace upset picks |
| `src/types/guidance.ts` | `GuidanceContext`, `GuidanceMessage`, `GuidanceSeverity`, `GuidanceCategory` |
| `src/lib/game-theory/ownership.ts` | `buildFullOwnershipModel()` |
| `src/lib/game-theory/strategy.ts` | `getStrategyRecommendation()`, `POOL_STRATEGY_CONFIGS` |

## GuidanceMessage Shape

```typescript
interface GuidanceMessage {
  id: string;          // Unique ID for deduplication
  title: string;       // Short display title
  description: string; // Detailed explanation
  severity: "danger" | "warning" | "info";
  category: "upset_volume" | "chalk_concentration" | "variance_mismatch"
           | "lever_conflict" | "recency_divergence" | "tempo_explanation";
  gameId?: string;     // Related game
  teamIds?: string[];  // Related teams
}
```

## Interpreting Results

- **No messages** = bracket looks solid for the chosen strategy
- **Info only** = minor notes, no action needed
- **Warnings** = potential issues worth considering
- **Danger** = significant concerns that could hurt bracket performance
- Messages are deduplicated by ID and sorted by severity (danger first)
