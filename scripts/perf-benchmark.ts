/**
 * Performance benchmark script for the simulation engine.
 *
 * Measures execution time for runSimulation at various simulation counts
 * and reports results in a formatted table.
 *
 * Run: npx tsx scripts/perf-benchmark.ts
 */

import { runSimulation } from "../src/lib/engine/simulator";
import { create64TeamField } from "../src/lib/engine/test-helpers-bracket";
import type { SimulationConfig } from "../src/types/simulation";
import { DEFAULT_ENGINE_CONFIG } from "../src/types/engine";
import type { TeamSeason } from "../src/types/team";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const teamsArray = create64TeamField();
const teamsMap = new Map<string, TeamSeason>(
  teamsArray.map((t) => [t.teamId, t])
);

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

interface BenchmarkResult {
  simCount: number;
  runs: number;
  times: number[];
  median: number;
  p95: number;
  min: number;
  max: number;
  simsPerSecond: number;
}

function benchmark(simCount: number, runs: number): BenchmarkResult {
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const config: SimulationConfig = {
      numSimulations: simCount,
      engineConfig: { ...DEFAULT_ENGINE_CONFIG },
      randomSeed: 42 + i, // Different seed each run for variety
    };

    const start = performance.now();
    runSimulation(teamsMap, config);
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];

  return {
    simCount,
    runs,
    times,
    median,
    p95,
    min: times[0],
    max: times[times.length - 1],
    simsPerSecond: Math.round(simCount / (median / 1000)),
  };
}

// ---------------------------------------------------------------------------
// Run benchmarks
// ---------------------------------------------------------------------------

console.log("=== March Madness Simulation Engine — Performance Benchmark ===\n");
console.log(`Teams: ${teamsMap.size}`);
console.log(`Engine config: DEFAULT_ENGINE_CONFIG`);
console.log("");

const simCounts = [1000, 5000, 10000, 25000, 50000];
const runsPerCount = 5;

console.log(
  "Sim Count  | Runs | Median (ms) | P95 (ms) | Min (ms) | Max (ms) | Sims/sec"
);
console.log(
  "---------- | ---- | ----------- | -------- | -------- | -------- | --------"
);

for (const count of simCounts) {
  const result = benchmark(count, runsPerCount);
  console.log(
    `${String(result.simCount).padStart(10)} | ${String(result.runs).padStart(4)} | ${result.median.toFixed(0).padStart(11)} | ${result.p95.toFixed(0).padStart(8)} | ${result.min.toFixed(0).padStart(8)} | ${result.max.toFixed(0).padStart(8)} | ${String(result.simsPerSecond).padStart(8)}`
  );
}

// Check target
const target50K = benchmark(50000, 3);
console.log("");
console.log(`\n🎯 Target: 50K sims in <5 seconds`);
console.log(
  `   Result: 50K sims median = ${target50K.median.toFixed(0)}ms (${target50K.median < 5000 ? "✅ PASS" : "❌ FAIL"})`
);
