---
name: backtest-year
description: Run a full backtest for a historical tournament year — load archived data, simulate against actual results, compute Brier Score, and compare against the seed baseline. Use when evaluating model calibration for a specific season.
argument-hint: <year> [--config=JSON] [--verbose]
---

# Backtest Year Skill

Run a full backtest for `$ARGUMENTS` — load the archived team data for that season, run the probability model against every actual tournament game, compute Brier Score, and compare against the naive seed-based baseline.

## Prerequisites

- Historical tournament results must exist for the year (available: 2008-2024, excluding 2020)
- Team season data for that year should be seeded in Supabase (if missing, the runner falls back to seed baseline per-game)
- The backtest system evaluates per-game probabilities directly (no Monte Carlo needed)

## Steps

### 1. Parse and Validate Year

Extract the year from arguments. Validate it against available seasons:

```typescript
import { ALL_SEASONS, ANOMALOUS_SEASONS, TRAIN_SEASONS, TEST_SEASONS } from "@/types/backtest";

// Available: 2008-2019, 2021-2024 (2020 excluded — tournament cancelled)
const year = parseInt(args, 10);

if (!ALL_SEASONS.includes(year)) {
  // Error: year not available
}

// Check if anomalous
if (ANOMALOUS_SEASONS[year]) {
  // Flag: e.g., 2021 = "COVID bubble — all games in Indianapolis"
}

// Determine train/test split
const splitLabel = TEST_SEASONS.includes(year) ? "test" : "train";
// Train: 2008-2019 | Test: 2021-2024
```

### 2. Load Historical Tournament Results

```typescript
import { HISTORICAL_RESULTS } from "@/lib/backtest/historical-results";

const seasonData = HISTORICAL_RESULTS.find((r) => r.season === year);
// seasonData.games contains all 63 games (R64 through NCG)
// Each game: { season, round, region?, winnerName, winnerSeed, loserName, loserSeed }
```

### 3. Fetch Team Season Data from Supabase

```typescript
import { createAdminClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";

const supabase = createAdminClient();

const { data: rows, error } = await supabase
  .from("team_seasons")
  .select("*, teams!inner(*), coaches(*)")
  .eq("season", year);

// Transform DB rows into TeamSeason objects
const teams = transformTeamSeasonRows(rows as unknown as TeamSeasonJoinedRow[]);
```

If no team data exists for the year, the runner falls back to seed baseline for every game. This is expected for seasons not yet seeded — the output will note that all games used baseline predictions.

### 4. Build Engine Configuration

```typescript
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { EngineConfig } from "@/types/engine";

// Use defaults, or merge with --config overrides
const config: EngineConfig = {
  ...DEFAULT_ENGINE_CONFIG,
  // Apply any --config overrides here:
  // levers: { ...DEFAULT_ENGINE_CONFIG.levers, ...customLevers },
};
```

### 5. Run the Backtest

```typescript
import { runBacktestYear, buildTeamLookup } from "@/lib/backtest/runner";

const result = runBacktestYear(seasonData, teams, config);

// result: BacktestYearResult
// {
//   season, anomalous, anomalyNote?,
//   modelScore: BrierScoreResult,     // { overallBrier, gameCount, byRound, gameScores }
//   baselineScore: BrierScoreResult,
//   improvement,                       // (baseline - model) / baseline (positive = model wins)
//   unresolvedTeams,                   // count of games that fell back to seed baseline
//   gamesEvaluated,                    // should be 63 for a full tournament
//   splitLabel                         // "train" or "test"
// }
```

### 6. Build Calibration Bins

```typescript
import { buildCalibrationBins } from "@/lib/backtest/calibration";

const calibration = buildCalibrationBins(result.modelScore.gameScores);
// 10 bins across [0, 1] — each has: { binStart, binEnd, avgPredicted, actualWinRate, count }
```

### 7. Format Output

Present the full backtest results in this structured format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKTEST: [Year] NCAA Tournament
Split: [train/test]  |  Anomalous: [Yes (note) / No]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL SCORES
  Model Brier:        0.XXXX
  Baseline Brier:     0.XXXX
  Improvement:        +XX.X% (model better) / -XX.X% (baseline better)
  Games Evaluated:    63
  Unresolved Teams:   XX (fell back to seed baseline)

PER-ROUND BREAKDOWN
  Round         Model    Baseline  Games  Improvement
  ─────────────────────────────────────────────────────
  Round of 64   0.XXXX   0.XXXX    32     +XX.X%
  Round of 32   0.XXXX   0.XXXX    16     +XX.X%
  Sweet 16      0.XXXX   0.XXXX     8     +XX.X%
  Elite 8       0.XXXX   0.XXXX     4     +XX.X%
  Final Four    0.XXXX   0.XXXX     2     +XX.X%
  Championship  0.XXXX   0.XXXX     1     +XX.X%

CALIBRATION (10 bins)
  Bin Range       Predicted   Actual    Count   Delta
  ─────────────────────────────────────────────────────
  0.00 – 0.10     0.XXX      0.XXX      XX     +0.XXX
  0.10 – 0.20     0.XXX      0.XXX      XX     +0.XXX
  ...
  0.90 – 1.00     0.XXX      0.XXX      XX     +0.XXX

NOTABLE GAMES (if --verbose)
  Biggest upsets (highest Brier Score — model was most wrong):
    R64: #15 Seed over #2 Seed — predicted 0.XX, Brier 0.XXXX
    R32: #11 Seed over #3 Seed — predicted 0.XX, Brier 0.XXXX

  Best predictions (lowest Brier Score — model was most right):
    R64: #1 Seed over #16 Seed — predicted 0.XX, Brier 0.XXXX
    E8:  #2 Seed over #3 Seed — predicted 0.XX, Brier 0.XXXX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERPRETATION
  Brier Score: 0.0 = perfect, 0.25 = coin flip, 1.0 = worst possible
  Improvement > 0% means model outperforms naive seed baseline
  Calibration delta near 0 = well-calibrated for that probability range
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8. Optional: Run via API

Alternatively, trigger the backtest through the API endpoint:

```typescript
// POST /api/backtest
const response = await fetch("/api/backtest", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    seasons: [year],
    engineConfig: config, // optional, omit for defaults
  }),
});

const { success, result, error }: BacktestResponse = await response.json();
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/backtest/runner.ts` | `runBacktestYear()`, `runBacktestMultiYear()`, `evaluateGame()`, `buildTeamLookup()` |
| `src/lib/backtest/brier-score.ts` | `createBrierGameScore()`, `calculateBrierScore()` |
| `src/lib/backtest/seed-baseline.ts` | `getSeedBaselineProbability()` — naive baseline model |
| `src/lib/backtest/calibration.ts` | `buildCalibrationBins()` — predicted vs actual bins |
| `src/lib/backtest/historical-results.ts` | `HISTORICAL_RESULTS` — 2008-2024 tournament game data |
| `src/types/backtest.ts` | `BacktestYearResult`, `BrierScoreResult`, `BrierGameScore`, `CalibrationBin`, `ALL_SEASONS`, `TRAIN_SEASONS`, `TEST_SEASONS` |
| `src/types/engine.ts` | `EngineConfig`, `DEFAULT_ENGINE_CONFIG`, `GlobalLevers` |
| `src/lib/engine/matchup.ts` | `resolveMatchup()` — 10-step probability pipeline |
| `src/app/api/backtest/route.ts` | `POST /api/backtest` — HTTP endpoint |
| `src/lib/supabase/client.ts` | `createAdminClient()` — Supabase admin client |
| `src/lib/supabase/transforms.ts` | `transformTeamSeasonRows()` — DB row to TeamSeason |

## Backtest Pipeline Reference

The per-game evaluation (`evaluateGame()`) works as follows:

1. Look up both teams in the `teamLookup` map (keyed by full name and short name)
2. If both found: call `resolveMatchup(teamA, teamB, config)` to get predicted win probability
3. If one/both missing: fall back to `getSeedBaselineProbability(winnerSeed, loserSeed, round)`
4. Compute Brier Score: `(predictedProb - actualOutcome)^2` where actualOutcome = 1 for the winner
5. Also compute baseline Brier Score using seed-based probability for comparison
6. Aggregate per-round and overall average Brier Scores

## Interpreting Results

- **Brier Score scale**: 0.0 = perfect prediction, 0.25 = coin flip, 1.0 = maximally wrong
- **Improvement > 0%**: Model outperforms the seed baseline (good)
- **Improvement < 0%**: Seed baseline is more accurate than the model (investigate lever weights)
- **High unresolved count**: Team data is missing for this season; seed the data and re-run
- **Calibration check**: For well-calibrated model, avgPredicted should be close to actualWinRate in each bin
- **Train vs test**: Test-set performance (2021-2024) is the true measure; train-set (2008-2019) can overfit
- **2021 anomaly**: COVID bubble tournament — all neutral site in Indianapolis. Expect unusual patterns.

## Available Seasons

| Season | Split | Anomalous | Games |
|--------|-------|-----------|-------|
| 2008   | train | No        | 63    |
| 2009   | train | No        | 63    |
| 2010   | train | No        | 63    |
| 2011   | train | No        | 63    |
| 2012   | train | No        | 63    |
| 2013   | train | No        | 63    |
| 2014   | train | No        | 63    |
| 2015   | train | No        | 63    |
| 2016   | train | No        | 63    |
| 2017   | train | No        | 63    |
| 2018   | train | No        | 63    |
| 2019   | train | No        | 63    |
| 2020   | N/A   | Cancelled | 0     |
| 2021   | test  | Yes (COVID bubble) | 63 |
| 2022   | test  | No        | 63    |
| 2023   | test  | No        | 63    |
| 2024   | test  | No        | 63    |
