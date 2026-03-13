# Performance Baseline

## Tools

- **Bundle analyzer**: `npm run analyze` (generates interactive treemap)
- **Engine benchmark**: `npx tsx scripts/perf-benchmark.ts`
- **Server-Timing header**: Visible in browser DevTools Network tab on `/api/simulate` responses

## Simulation Engine Targets

| Metric | Target | Notes |
|--------|--------|-------|
| 50K simulations | < 5 seconds | Full bracket, all levers enabled |
| 10K simulations | < 1 second | Default user-facing simulation count |
| resolveMatchup (single) | < 0.05ms | Hot path per-game computation |

## How to Reproduce

### Engine Benchmark

```bash
npx tsx scripts/perf-benchmark.ts
```

Runs 5 iterations at 1K, 5K, 10K, 25K, 50K simulations and reports median/P95 times.

### Bundle Analysis

```bash
npm run analyze
```

Opens an interactive treemap showing client and server bundle composition. Key areas to watch:
- `recharts` — largest charting library, only used on backtest page (dynamically imported)
- `@supabase/supabase-js` — database client
- `@anthropic-ai/sdk` — AI narrative generation (server-only)

## Architecture Notes

- Simulation runs **server-side** via Next.js API route (`/api/simulate`)
- No Web Workers — synchronous execution on the API server
- Streaming aggregator keeps memory O(64) regardless of simulation count
- Matchup probability cache avoids redundant computation for repeated team pairings
