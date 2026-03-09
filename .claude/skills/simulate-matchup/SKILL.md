---
name: simulate-matchup
description: Pull two teams' data, run probability model, output structured matchup breakdown. Use when analyzing specific matchup scenarios.
argument-hint: <TeamA> vs <TeamB> [--levers=...] [--overrides=...]
---

# Simulate Matchup Skill

Simulate a head-to-head matchup between `$ARGUMENTS` using the full probability engine.

## Steps

### 1. Identify Teams

Parse the arguments to extract two team names. Search for them in the database:

```typescript
// Read team data from Supabase or from the seeded data
import { createAuthenticatedClient } from "@/lib/supabase/server";

// Or for local testing, look at the team data in:
// src/lib/data/fetchers/torvik.ts (static data)
// scripts/fetch-and-seed.ts (seeder)
```

If team names are ambiguous, search `src/lib/data/campus-locations.ts` which has all 380+ D-1 school names.

### 2. Build TeamSeason Objects

Ensure both teams have complete `TeamSeason` data:
- `src/types/team.ts` — `TeamSeason` interface (the full shape)
- All fields: ratings (kenpom/torvik/evanmiya), fourFactorsOffense/Defense, shootingOffense/Defense, adjTempo, experience, minutesContinuity, avgHeight, twoFoulParticipation, coach, tournamentEntry

### 3. Run the Probability Engine

```typescript
import { resolveMatchup } from "@/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig, MatchupOverrides } from "@/types/engine";

// Build config (modify levers if --levers argument provided)
const config: EngineConfig = {
  ...DEFAULT_ENGINE_CONFIG,
  levers: {
    ...DEFAULT_ENGINE_CONFIG.levers,
    // Apply any lever overrides from arguments
  },
};

// Build overrides if --overrides argument provided
const overrides: MatchupOverrides | undefined = undefined;

// Run the 10-step pipeline
const result = resolveMatchup(teamA, teamB, config, overrides);
```

### 4. Format Output

Present the matchup breakdown in this structured format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MATCHUP: [Team A] vs [Team B]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WIN PROBABILITY
  Team A: XX.X%  |  Team B: XX.X%
  Spread: Team A by X.X

COMPOSITE RATINGS
  Team A: AdjEM +XX.X (OE XX.X, DE XX.X)
    Sources: KenPom +XX.X (40%) | Torvik +XX.X (35%) | Miya +XX.X (25%)
  Team B: AdjEM +XX.X (OE XX.X, DE XX.X)
    Sources: KenPom +XX.X (40%) | Torvik +XX.X (35%) | Miya +XX.X (25%)

PROBABILITY BREAKDOWN
  Base (from rating diff):     XX.X%
  Four Factors adjustment:    +X.XXX
  Experience adjustment:      +X.XXX
  Continuity adjustment:      +X.XXX
  Coach adjustment:           +X.XXX
  Total mean adjustment:      +X.XXX
  Tempo variance multiplier:   X.XXX
  3PT variance multiplier:     X.XXX
  Combined variance:           X.XXX
  Final probability:           XX.X%

OVERRIDE ADJUSTMENTS (if any)
  Injury:         X.X
  Site proximity: X.X
  Recent form:    X.X
  Rest:           X.X
  Total:          X.X

KEY STATS COMPARISON
  Stat                Team A    Team B    Edge
  eFG% (Off)          XX.X%     XX.X%     →A
  TO% (Off)           XX.X%     XX.X%     →B
  ORB% (Off)          XX.X%     XX.X%     →A
  FT Rate             XX.X%     XX.X%     →A
  Adj Tempo           XX.X      XX.X
  Experience          X.XX      X.XX      →A
  3PT Rate            XX.X%     XX.X%
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/engine/matchup.ts` | `resolveMatchup()` — 10-step pipeline |
| `src/lib/engine/composite-rating.ts` | `calculateCompositeRating()` |
| `src/lib/engine/win-probability.ts` | `calculateWinProbability()`, `ratingDiffToSpread()` |
| `src/lib/engine/levers.ts` | All lever calculation functions |
| `src/lib/engine/overrides.ts` | `applyMatchupOverrides()`, `mergeLevers()` |
| `src/types/engine.ts` | `ProbabilityBreakdown`, `EngineConfig`, `GlobalLevers`, `MatchupOverrides` |
| `src/types/team.ts` | `TeamSeason` — complete team data shape |

## Engine Pipeline Reference

The `resolveMatchup()` function runs this 10-step pipeline:
1. Merge levers (global + per-matchup overrides)
2. Calculate composite ratings for both teams
3. Calculate base win probability from rating differential (log5, k=0.0325)
4. Calculate Four Factors adjustment (8 sub-levers, scaling factor 0.15)
5. Calculate experience adjustment (0.75 eff pts / year)
6. Calculate continuity adjustment (0.05 eff pts / pct point)
7. Calculate coach adjustment (win rate + Final Four bonus)
8. Apply per-matchup overrides (injury, site, form, rest)
9. Calculate variance multipliers (tempo, 3PT rate)
10. Recalculate final probability with effective logistic K
