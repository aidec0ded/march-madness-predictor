# Project Plan — March Madness Bracket Prediction App

## Architecture Summary

| Component     | Choice                         | Rationale                                             |
| ------------- | ------------------------------ | ----------------------------------------------------- |
| Framework     | Next.js + TypeScript           | SSR, API routes, single deployable unit               |
| Auth & DB     | Supabase (PostgreSQL)          | Built-in auth, row-level security, generous free tier |
| Deployment    | Railway or Render              | Persistent server for simulation compute              |
| Simulation    | Server-side (API routes)       | Reliable performance for 10K–100K bracket sims        |
| Data Pipeline | Admin-managed ingestion        | KenPom (CSV), Torvik (API), Evan Miya (manual)        |
| AI Narrative  | Claude API (server-side)       | Prompt-engineered matchup analysis                    |
| Styling       | Tailwind CSS                   | Utility-first, dark mode support, rapid iteration     |
| Testing       | Vitest + React Testing Library | Fast, co-located tests                                |

---

## Development Phases

### Phase 0: Project Scaffolding & Infrastructure

> Foundation — everything else builds on this.

- [x] Initialize Next.js 16 + TypeScript project (App Router)
- [x] Configure Tailwind CSS 4 with dark mode defaults (CSS custom properties, Baseball Savant palette)
- [x] Set up Supabase project (auth + database) — `xiwpovarclryqtkaugsm.supabase.co`, 7 tables, RLS policies applied
- [x] Configure ESLint 9 (flat config) + Prettier
- [x] Set up Vitest 4 + React Testing Library
- [x] Create base directory structure (`src/types/`, `src/lib/`, `src/components/`, `src/hooks/`, `src/app/api/`)
- [x] Configure environment variables (`.env.example` template)
- [x] Set up CI with GitHub Actions (lint + test + build on PR)
- [x] Deploy initial skeleton to Render — `render.yaml` Blueprint, `output: "standalone"`, `.nvmrc` for Node 20

**Parallelizable:** Supabase project setup can happen alongside Next.js scaffolding.

---

### Phase 1: Data Layer & Admin Pipeline

> Get real data flowing before building UI or simulation.

- [x] Define TypeScript interfaces for all team data fields (`src/types/team.ts`, `src/types/data-import.ts`)
- [x] Design Supabase schema (`supabase/migrations/001_initial_schema.sql`, `002_rls_policies.sql`)
- [x] Build admin data import API routes (KenPom CSV, Torvik fetch, Evan Miya manual)
- [x] Build Torvik data fetcher (`src/lib/data/fetchers/torvik.ts` — static CSV files from barttorvik.com)
- [x] Build data normalization layer — KenPom, Torvik, Evan Miya normalizers + data merger
- [x] Create admin UI page for data management (`/admin/data`)
- [x] Seed database with 2026 Torvik data (365 teams, programmatic seeder via `scripts/fetch-and-seed.ts`)
- [x] Build campus location lookup for 380+ D-1 schools (`src/lib/data/campus-locations.ts`)
- [x] Write unit tests for data validation and normalization (56 tests total)

**Parallelizable:** Schema design, TypeScript types, and Torvik fetcher are independent.

---

### Phase 2: Core Probability Engine

> The mathematical heart of the application.

- [x] Implement composite rating calculator (weighted KenPom/Torvik/Miya with auto-renormalization)
- [x] Implement log5 logistic model for pairwise win probability (k=0.11, derived from game σ≈11 and ~68 possessions)
- [x] Build global lever system — mean-adjusting levers:
  - Four Factors weights (8 sub-levers: offense/defense × 4 factors, scaling factor 0.15)
  - Roster Experience weight (0.75 eff pts / year)
  - Minutes Continuity weight (0.05 eff pts / pct point)
  - Coach Tournament Experience weight (win rate + Final Four bonus)
- [x] Build variance levers:
  - Pace/Tempo effect on distribution width (baseline 68, 0.015 scaling, clamped [0.7, 1.4])
  - Three-Point Rate effect on distribution width (baseline 35%, 0.02 scaling, clamped [0.8, 1.5])
- [x] Build per-matchup override system (inherits globals, deep-merges overrides)
  - Injury/Availability adjustment (efficiency point deduction)
  - Recent Form/Momentum override (-5.0 to +5.0 eff pts)
  - Rest/Schedule Density adjustment (-3.0 to +3.0 eff pts)
- [x] Build site proximity global lever — auto-computed from campus-to-venue distance using continuous exponential decay model (`3.0 × e^(-0.003 × distance)` + travel penalty >1000mi), controlled by `siteProximityWeight` global lever
- [x] Build matchup resolver (`resolveMatchup` — 10-step pipeline, full `ProbabilityBreakdown`)
- [x] Write comprehensive unit tests (96 engine tests, 152 total)
- [ ] ~~Validate against known matchup outcomes for sanity checking~~ → moved to Backlog

**Parallelizable:** Mean levers, variance levers, and per-matchup overrides are independent once the base model exists.

---

### Phase 3: Monte Carlo Simulation Engine ✅

> Full bracket simulation, server-side.

- [x] Define simulation types (`src/types/simulation.ts` — BracketSlot, BracketMatchup, SimulationConfig, SimulationResult, etc.)
- [x] Build bracket structure (`src/lib/engine/bracket.ts` — 63 matchups, 4 regions × 16 seeds, standard NCAA seeding order)
- [x] Implement single-game outcome sampling (`src/lib/engine/sampler.ts` — mulberry32 seeded PRNG for reproducibility)
- [x] Implement full bracket propagation (`src/lib/engine/simulator.ts` — 63 games, forward-propagating with lever effects)
- [x] Build streaming result aggregation (`src/lib/engine/aggregator.ts` — path probabilities, round survival, champion likelihood, upset rates)
- [x] Build simulation API endpoint (`POST /api/simulate` — validates 64-team request, runs simulation, returns results)
- [x] Apply lever effects to simulation parameters (inherits full engine pipeline per game)
- [x] Add configurable simulation count (10K / 25K / 50K / 100K via `SIMULATION_COUNT_OPTIONS`)
- [x] Write comprehensive tests (85 simulation tests: bracket 34, sampler 20, simulator 31; 237 total)
- [ ] ~~Optimize for performance (target: 50K sims in < 5 seconds)~~ → moved to Backlog
- [ ] ~~Add progress reporting for long-running simulations~~ → moved to Backlog

**Dependencies:** Requires Phase 2 (probability engine).

---

### Phase 4: Authentication & User Management ✅

> User accounts, bracket persistence, saved configurations.

- [x] Integrate Supabase Auth with Next.js — four-client pattern (`@supabase/ssr`), middleware for session refresh + route protection
- [x] Build sign-up / sign-in pages (email + OAuth providers) — `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/reset-password`
- [x] Add OAuth callback and email confirmation route handlers (`/auth/callback`, `/auth/confirm`)
- [x] Create AuthProvider context with server-side initial user hydration + `useAuth` hook
- [x] Design schema for user data: `user_brackets`, `user_lever_configs`, `user_settings` (`003_user_tables.sql`)
- [x] Implement bracket save/load API routes (`GET/POST /api/brackets`, `GET/PUT/DELETE /api/brackets/[id]`)
- [x] Implement lever configuration save/load (`GET/POST /api/lever-configs`, `GET/PUT/DELETE /api/lever-configs/[id]`)
- [x] Implement settings API route with upsert pattern (`GET/PUT /api/settings`)
- [x] Set up Supabase Row Level Security (RLS) policies — `auth.uid() = user_id` with admin override
- [x] Build user settings page (`/settings`) — pool size bucket, simulation count preferences
- [x] Transition admin auth to dual Supabase Auth + API key fallback
- [ ] ~~Write auth integration tests~~ → moved to Backlog

**Parallelizable with Phase 2 and Phase 3** — auth is independent of the engine.

---

### Phase 5: Bracket View UI ✅

> The primary screen — data-dense, dark, smooth.

- [x] Build 64-team bracket layout component (responsive, all four regions + Final Four) — `BracketGrid`, `RegionBracket`, `FinalFour` with CSS Grid layout + connector lines
- [x] Build team card component (name, seed, probability bars) — `TeamCard` (React.memo, seed badge color-coded), `ProbabilityBar` (3px color-interpolated bar)
- [x] Implement interactive bracket picking (click to advance team) — `BracketProvider` with `useReducer`, cascading pick invalidation on upstream changes
- [x] Build global lever panel (collapsible sidebar/drawer) — `LeverPanel` with `CompositeWeightsControl` (auto-normalization), `FourFactorsControls` (8 sliders), `VarianceControls`
- [x] Build simulation trigger button with loading/progress state — `SimulationButton` with idle/loading/success/error states, `useBracketSimulation` hook
- [x] Display simulation results overlay (champion probabilities, round survival) — `SimulationResultsOverlay` with top 10 champions table, upset rates, execution metadata
- [x] Implement dark mode theme system (Baseball Savant inspired) — CSS custom properties throughout, all components use `--bg-*`, `--text-*`, `--accent-*` variables
- [x] Add visual indicators for matchups with per-matchup overrides — `OverrideIndicator` orange dot with tooltip
- [x] Connect `/api/simulate` to Supabase — `transforms.ts` for DB row → `TeamSeason` conversion, endpoint fetches 64 teams and runs engine
- [x] Build `/bracket` page (Server Component) with team fetching and optional saved bracket loading
- [x] Build bracket save/load persistence — `useBracketPersistence` hook connected to brackets API
- [ ] ~~Responsive design polish (tablet horizontal scroll, mobile region-by-region view)~~ → moved to Backlog
- [ ] ~~Add bracket-specific unit/component tests~~ → moved to Backlog

**Dependencies:** Requires Phase 2 (lever system), Phase 3 (simulation results to display), Phase 4 (save/load).

---

### Phase 6: Matchup View UI ✅

> Deep-dive "film room" for individual games.

- [x] Build team statistical profile card component — `TeamProfileCard` showing efficiency ratings, four factors, shooting splits, tempo, experience, coaching
- [x] Build side-by-side comparison layout — `StatComparison` with 15 metrics grouped by category (efficiency, four factors, shooting, other) with advantage coloring
- [x] Build per-matchup lever override panel (shows inherited defaults, allows override) — `MatchupOverridePanel` with sliders for injury, site proximity, recent form, rest
- [x] Display win probability before and after overrides — `ProbabilityDisplay` with large probability numbers, point spread, and full breakdown table
- [x] Build Monte Carlo distribution visualization (histogram/density chart) — `DistributionChart` using Recharts with margin-of-victory bins color-split at 0
- [x] Navigation: bracket view ↔ matchup view with context preservation — Full-screen `MatchupView` overlay triggered by clicking any matchup, closes on Escape key
- [x] Charting library integration — Recharts installed and integrated
- [x] Build shared bracket-utils — Extracted `resolveSlotTeam()` and `resolveMatchupTeams()` into shared `bracket-utils.ts`
- [x] Build distribution generator — `generateMatchupDistribution()` mini Monte Carlo (1000 samples), Box-Muller normal noise
- [x] Build useMatchupAnalysis hook — Resolves teams, runs probability with/without overrides, generates distribution
- [x] Write tests (8 distribution generator tests, 245 total passing)

**Dependencies:** Requires Phase 5 (bracket navigation context).

---

### Phase 7: Game Theory / Contest Mode ✅

> Strategic layer — pool size shapes recommendations.

- [x] Build pool size selection UI — `PoolSizeSelector` compact dropdown in header bar, dispatches `SET_POOL_SIZE` to BracketContext
- [x] Implement ownership model — seed-based baseline (1-seed: 98%, 16-seed: 2%) × round decay (R64: 1.0 → NCG: 0.3) × conference premium (power +4%) × rating-strength adjustment
- [x] Build strategy recommendation engine — 4 pool tiers (small/medium/large/very_large), leverage score = winProb / (ownership/100), typed recommendations (max_probability, contrarian_value, slight_contrarian, avoid, neutral)
- [x] Display ownership estimates alongside win probabilities in bracket view — `OwnershipBadge` (memo-wrapped) inline on `TeamCard`, color-coded by ownership level
- [x] Add `poolSizeBucket` to BracketState + `SET_POOL_SIZE` action
- [x] Wire ownership through BracketGrid → RegionBracket → MatchupSlot → TeamCard + FinalFour
- [x] Build `useContestStrategy` hook with memoized `getOwnership()` and `getRecommendation()` functions
- [x] Write tests (27 new: 9 ownership + 18 strategy, 264 total passing)
- [x] Feed contest context into AI narrative recommendations (completed in Phase 9)

**Parallelizable with Phase 6 and Phase 8.**

---

### Phase 8: Contextual Guidance System ✅

> Proactive warnings and insights without restricting choice.

- [x] Build guidance rules engine — 6 pure-function rules evaluating BracketState → GuidanceMessage[]:
  - Upset volume warning — counts R64 upsets vs historical avg (~4), warning >6, danger ≥8
  - Chalk concentration warning — % picks matching higher seed, warning ≥80%, danger ≥90%
  - Variance mismatch note — flags teams with 3PT rate ≥38% picked to S16+
  - Lever conflict detection — high experience/continuity/coach weight vs team profile contradiction
  - Recency divergence flag — |recentForm override| > 2.0 or rating sources disagree >5 pts
  - Pace/tempo explanation — slow-paced teams (<64 adj tempo) in R64 upset picks
- [x] Build guidance evaluator pipeline — runs all rules, catches errors, deduplicates by ID, sorts by severity (danger > warning > info)
- [x] Build `GuidancePanel` component — collapsible panel with color-coded messages (danger/warning/info), category icons, individual dismiss support
- [x] Build `useGuidance` hook — memoized, builds GuidanceContext from BracketState, recomputes on picks/levers/overrides/simulation changes
- [x] Integrate into BracketShell — "Guidance" toggle button in header bar
- [x] Write comprehensive tests (37 new tests across 7 files, 274 total passing)

**Parallelizable with Phase 7.**

---

### Phase 9: AI Matchup Narrative ✅

> Claude-powered analysis in the matchup view.

- [x] Build Claude API integration (`POST /api/narrative` — SSE streaming via Anthropic SDK, `claude-sonnet-4-20250514`, 1024 max tokens)
- [x] Engineer prompt template:
  - Structured team data payload (`buildTeamDataBlock()` — all stats from TeamSeason in labeled format)
  - Data dictionary for field interpretation (`src/lib/narrative/data-dictionary.ts` — baselines, interaction effects)
  - Reasoning instructions for interaction effects (6 documented interaction patterns)
  - 1 few-shot example output for style/structure (`src/lib/narrative/examples.ts`)
  - Constraints (no speculation, must recommend, under 600 words, 5-section format)
- [x] Build narrative display component (`NarrativePanel` — generate button, streaming text, lightweight markdown renderer)
- [x] Add generation trigger (button, not auto-generate — "Generate Analysis" with sparkle icon)
- [x] Implement response caching (module-level `Map<hash, text>` in `useMatchupNarrative`, keyed by djb2 hash of data inputs)
- [x] Rate limiting / cost controls (in-memory `Map<userId, {count, resetAt}>`, 10 req/min per user)
- [x] Incorporate contest mode context into prompt (ownership %, leverage scores, pool strategy description)
- [x] Write prompt builder tests (28 tests, 337 total passing)

**Implementation notes:**
- 8 new files: `src/types/narrative.ts`, `src/lib/narrative/data-dictionary.ts`, `src/lib/narrative/examples.ts`, `src/lib/narrative/prompt-builder.ts`, `src/lib/narrative/prompt-builder.test.ts`, `src/app/api/narrative/route.ts`, `src/hooks/useMatchupNarrative.ts`, `src/components/matchup/NarrativePanel.tsx`
- 3 modified files: `src/types/matchup-view.ts` (+`rawBreakdown`), `src/hooks/useMatchupAnalysis.ts` (populate rawBreakdown), `src/components/matchup/MatchupView.tsx` (+NarrativePanel)
- Prompt structure: system message (role + rules + data dictionary) + user message (team blocks + matchup context + pool context + examples + instruction)
- 5-section output format: Rating Profile, Stylistic Matchup, Key Factors, How This Game Plays Out, Recommendation
- NarrativePanel states: idle → generating (streaming with blinking cursor) → complete / error
- `@anthropic-ai/sdk` added as dependency

**Dependencies:** Requires Phase 6 (matchup view to display in), Phase 7 (contest context for prompt).

---

### Phase 10: Backtesting Module ✅

> Model validation and lever tuning against history.

- [x] Source and format historical data — scraped 2008–2024 from sports-reference.com (1,007 games across 16 seasons)
- [x] Build historical data import pipeline — `scripts/scrape-tournament-results.ts` → `src/lib/backtest/historical-results.ts`
- [x] Build backtest runner: per-game `resolveMatchup()` evaluation against actual results
- [x] Implement Brier Score calculator — `src/lib/backtest/brier-score.ts` (15 tests)
- [x] Build naive seed-based baseline for comparison — `src/lib/backtest/seed-baseline.ts` (14 tests)
- [x] Build calibration bins for model calibration analysis — `src/lib/backtest/calibration.ts` (15 tests)
- [x] Build backtest runner with multi-year aggregation — `src/lib/backtest/runner.ts` (19 tests)
- [x] Build lever tuning interface: isolated levers for backtest configuration
- [x] Implement train/test split management (2008–2019 train, 2021–2024 test)
- [x] Flag 2021 as anomalous (COVID bubble — all games in Indianapolis)
- [x] Build results visualization (Brier Score chart, calibration plot, results table)
- [x] Build API route — `POST /api/backtest`
- [x] Build historical data seeder — `scripts/seed-historical.ts`
- [x] Build full backtest dashboard UI — `/backtest` page with all components

**Completed: 63 backtest tests, 400 total tests passing.**

---

### Phase 11: Polish, Performance & Production ✅

> Ship it.

- [x] Error boundaries and graceful failure handling — `global-error.tsx`, `error.tsx`, `not-found.tsx`, bracket/backtest-specific boundaries
- [x] Loading states — `loading.tsx` skeletons for all routes (bracket grid skeleton, backtest chart skeleton, spinner fallbacks)
- [x] Lazy loading for heavy components — `MatchupView`, `BrierScoreChart`, `CalibrationPlot` via `next/dynamic` with `ChartSkeleton` fallbacks
- [x] Security headers — HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy via `next.config.ts`
- [x] SEO / Open Graph tags — metadata with title template, OpenGraph, Twitter cards, robots, metadataBase on layout + bracket + backtest pages
- [x] Rate limiting — `src/lib/rate-limit.ts` with `createRateLimiter()` applied to all 4 API routes (simulate 20/min, narrative 10/min, backtest 10/min, teams 30/min)
- [x] Structured logging — `src/lib/logger.ts` with JSON output, error serialization, debug suppression in production
- [x] Accessibility improvements — `:focus-visible` outlines, skip-to-content link, `aria-pressed` on toggles, `aria-label` on charts and team cards, focus management in MatchupView dialog, `--text-muted` contrast ratio fix
- [x] Final documentation pass — USER_GUIDE.md (all sections filled), README.md (clone URL, deployment, rate limits), CLAUDE.md (new conventions)

**Completed: 12 new rate-limit/logger tests, 412 total tests passing.**

- [ ] ~~Performance audit: bundle analyzer, API response times~~ → moved to Backlog
- [ ] ~~Custom domain setup~~ → moved to Backlog
- [ ] ~~Responsive/mobile design polish~~ → moved to Backlog

---

## Backlog

> Prioritized work queue. Items are grouped into execution batches.

### Batch 1 — Testing Gaps & Skill _(parallel)_ ✅

- [x] **Auth integration tests** — 9 test files, 56 tests covering sign-in/up/forgot/reset password, AuthProvider, API routes, middleware
- [x] **Bracket component tests** — 11 test files, 152 tests covering TeamCard, ProbabilityBar, OwnershipBadge, MatchupSlot, SimulationButton, BracketProvider, PoolSizeSelector, GuidancePanel, SimulationResultsOverlay, BracketShell
- [x] `/backtest-year [year]` skill — `.claude/skills/backtest-year/SKILL.md` — full backtesting workflow with 8-step process

### Batch 2 — Matchup Bug Fix ✅

- [x] **Defensive metrics display bug** — Root cause: `num()` in transforms.ts converted NULL → 0, masking missing data. Fix: made `fourFactorsDefense` and `shootingDefense` nullable on TeamSeason; transforms return null when all DB fields are NULL; engine skips four factors adjustment when defensive data is missing; UI shows "—" instead of 0.0%
- [x] **Defensive data overwrite bug** — Root cause: KenPom commit route always included defensive columns (`def_efg_pct`, etc.) in its upsert, even when the defense CSV wasn't uploaded; `nanToNull(undefined?.efgPct)` → `null` overwrote Torvik-provided defensive data. Fix: applied conditional-include pattern (same approach Torvik already used for height/experience) to all three import paths — KenPom commit, Torvik commit, and fetch-and-seed script. Defensive columns are now only included in the upsert when actual data is present.

### Batch 3 — Teams API ✅

- [x] **Teams API route: connected to Supabase** — `GET /api/teams` now queries `team_seasons` (joined with `teams` and `coaches`) plus `tournament_entries`, transforms via `transformTeamSeasonRows()`, and returns fully-hydrated TeamSeason objects. Supports `?season=`, `?teamId=`, `?tournamentOnly=true` filters. Default season 2026. Tournament entries error is non-fatal. 11 new tests in `route.test.ts`.

### Batch 4 — Data Ingestion _(sequential)_

- [x] **Populate real 2026 bracket teams** — Tournament bracket population admin tooling, tournament entries seeded via admin panel
- [x] **Historical tournament data for backtesting** — Kaggle March Machine Learning Mania dataset integrated, historical tournament results scraped and seeded
- [x] **Coach data ingestion** — Kaggle tournament results pipeline (`scripts/seed-coaches.ts`), `--all-seasons` flag for historical data, coach table with win/loss/F4/championship records
- [x] **Tournament venue / location data** — Admin API (`POST/GET/DELETE /api/admin/tournament-sites`), `tournament_sites` Supabase table, `buildSiteMap()` for round/region→venue mapping, continuous exponential decay distance model for site proximity global lever, auto-computed from campus-to-venue haversine distance
- [x] **NET Ranking / Strength of Schedule lever** — `sosWeight` global lever (default 1.0) with `sosNetRating` data field, `calculateSosAdjustment()` in engine, "Strength of Schedule" slider in LeverPanel Schedule & Luck section
- [x] **Luck regression lever** — `luckRegressionWeight` global lever (default 1.0) with `luck` data field (KenPom), `calculateLuckRegressionAdjustment()` in engine (8.0 eff pts scaling), "Luck Regression" slider in LeverPanel Schedule & Luck section
- [x] **2-Foul Participation editability** — No longer needed as a per-matchup override; data is ingested via the stats upload script and displayed read-only in TeamProfileCard. Used for narrative context.

### Batch 5 — Model Validation & Backtest Parity ✅

- [x] **Validate model against known outcomes** — Sanity-check engine predictions against historical matchup results
- [x] **Align backtest levers with global bracket levers** — Backtest lever configuration should match the full set of global lever options from the bracket, so users can test their bracket lever configuration against historical data

### Batch 6 — UX Clarity & Guidance _(sequential)_

- [x] **Per-matchup override guidance** — Added calibration hints to all 5 override sections in MatchupOverridePanel: Injury/Availability (role player through star player ranges), Recent Form (hot streak, skid, dramatic surge), Rest/Schedule (extra rest, conf. tourney fatigue), Bench Depth and Pace Adjustment (weight scale guidance). Hints display as italic muted text below each section description.
- [x] **Clarify probability numbers on team cards** — Bracket cards now show per-game head-to-head win probabilities (via `resolveMatchup()`), available immediately when both teams are known. Simulation path probabilities shown as tooltips. New `useGameProbabilities` hook computes probabilities for all 63 games.
- [x] **Picked-team probability mismatch** — Fixed: bracket view and matchup view now show the same per-game win probability from `resolveMatchup()`. Path probability (P of advancing through this round from simulation) is shown separately in tooltips and in the matchup view's ProbabilityDisplay.
- [x] **Simulation workflow clarity** — Implemented 5 improvements: (1) Stale simulation indicator — tracks input hash to detect when picks/levers/overrides change after simulation, shows "Re-run Simulation" with amber dot; (2) Tooltip on SimulationButton explaining what simulation does vs. per-game probabilities; (3) "Run simulation" prompt in ProbabilityDisplay when path probabilities are unavailable; (4) Auto-open results overlay after first simulation; (5) Explanatory header in SimulationResultsOverlay describing methodology. Stale banner in results overlay warns when results are outdated.
- [x] **Ownership model transparency** — Enhanced OwnershipBadge tooltip to mention 4 factors (seed position, round depth, conference profile, rating strength). Created collapsible OwnershipExplainer component in matchup view documenting all 4 ownership factors with specific values from the model (seed baselines, round decay multipliers, conference premiums, rating adjustment range). Includes disclaimer that estimates are heuristic.
- [x] **Backtest results interpretation guide** — Created collapsible BacktestInterpretationGuide component rendered at top of backtest dashboard. Covers 5 topics: Brier Score (scale, interpretation ranges), Model vs. Baseline (what seed-only baseline means), Train vs. Test (why test matters more, overfitting risk), Calibration Chart (diagonal, over/under-confidence, point size), 2021 Anomaly (COVID bubble context).

### Batch 7 — Performance & Polish _(parallel)_ ✅

- [x] **Simulation performance optimization** — Two-tier caching + fast path: `resolveMatchupFast()` returns only probability number (skipping all ProbabilityBreakdown diagnostic allocation), `MatchupCache` Map wrapper deduplicates (teamA, teamB) pairs across simulations (at most ~2,016 unique pairings for 64 teams). Cache only stores results for games without per-matchup overrides. `simulateBracket()` checks cache before computing, falls back to fast path. Targets <5s for 50K sims.
- [x] **Simulation progress reporting** — SSE streaming via ReadableStream. New `/api/simulate/stream` endpoint sends `progress` events every 1,000 sims with `{completed, total, elapsedMs}` and a final `result` event. `runSimulation()` accepts optional `onProgress` callback and `progressInterval`. Frontend: `useBracketSimulation` hook consumes SSE stream with TextDecoder, dispatches `SET_SIMULATION_PROGRESS` actions into BracketProvider state. `SimulationButton` shows "Simulating... XX%" label + thin 2px progress bar at button bottom during streaming.
- [x] **Performance audit** — Installed `@next/bundle-analyzer` with `ANALYZE=true` env var wrapper in `next.config.ts`. Added `"analyze"` npm script. Created `scripts/perf-benchmark.ts` measuring `runSimulation()` at 1K/5K/10K/25K/50K with median/P95/min/max/sims-per-sec. Added `Server-Timing` header to `/api/simulate` response. Documented targets and reproduction steps in `docs/PERFORMANCE.md`.
- [x] **Responsive / mobile design polish** — Three breakpoints: desktop (≥1024px) unchanged, tablet (768–1023px) scroll affordance gradient, mobile (<768px) region-by-region tabbed view. Created `useMediaQuery` hook (SSR-safe, returns false during hydration) with `MOBILE_QUERY`/`TABLET_QUERY` constants. `MobileBracketView` component with 5 tabs (East/West/South/Midwest/Final 4), proper ARIA tablist/tab/tabpanel roles. `BracketGrid` delegates to MobileBracketView on mobile. `BracketShell` responsive header (condensed padding/fonts, hidden bracket name on mobile). `LeverPanel` full-width drawer (100vw) on mobile. Added `--border-primary` CSS variable, scroll affordance gradient, and mobile tab bar styles to globals.css.

### Batch 8 — Infrastructure & Tooling

- [ ] **Custom domain setup** — Configure custom domain on deployment provider (Render)
- [x] **Fix Vitest / Vite ESM compatibility** — Root cause was two test files using vitest globals (`beforeEach`, `afterEach`) without importing them. While `globals: true` in vitest.config.ts makes them available at runtime, TypeScript couldn't resolve the types. Fixed by adding the missing imports to `page.test.tsx` and `PoolSizeSelector.test.tsx`. `npx tsc --noEmit` now passes with zero errors.

### Batch 9 — Documentation & Guides ✅

- [x] **Comprehensive User Guide update** — Complete rewrite of `docs/USER_GUIDE.md` with flow-first structure: 9-step walkthrough from first visit to finished bracket (browse → matchup deep dive → picks → overrides → simulate → results → guidance → levers → iterate). Detailed "How the Probabilities Work" section covering composite ratings, rating differential, lever adjustments with math (logistic conversion formula, additive vs. variance adjustments), and Monte Carlo path probability engine. Full backtesting guide (Brier Score interpretation, calibration plot reading, train/test split rationale, 2021 anomaly). Expanded FAQ (8 questions) and glossary (12 terms). All content verified against actual UI component implementations.

### Batch 10 — Critical Fixes

- [x] **Picks-aware simulation** — Added `picks?: Record<string, string>` to `SimulationConfig`, threaded through `simulateBracket()` (lock-in before probability computation), `runSimulation()`, both API routes (`/api/simulate` and `/api/simulate/stream`), and `useBracketSimulation` hook. Invalid picks (teamId doesn't match either matchup participant) are silently ignored. 6 new tests covering lock-in, propagation, invalid picks, full-bracket determinism, and backwards compatibility.
- [x] **Team name normalization** — Added `normalizeForMerge()` to `merger.ts` with 20+ abbreviation rules (State↔St., Saint↔St., UConn↔Connecticut, directional abbreviations, punctuation stripping). The `resolveCanonicalKey()` fallback now uses this normalization instead of raw lowercasing. 38 new tests covering State/St. suffix, Saint/St. prefix, common abbreviations (BYU, TCU, VCU, UCF, etc.), and non-collision verification (Ohio ≠ Ohio State).
- [x] **Probability breakdown color mismatch** — Changed `getAdjustmentColor()` in `ProbabilityDisplay.tsx` from `var(--accent-success)` (green) to `var(--accent-primary)` (blue) for positive adjustments, matching Team A's color.
- [x] **FT Rate display precision** — Changed FT Rate formatting in `TeamProfileCard.tsx` from `fmtDec(value, 3)` (3 decimal places → "34.000") to `fmtDec(value, 1)` (1 decimal place → "34.0") for both offense and defense.

### Batch 11 — Important Features

- [x] **Clear all picks button** — Added `CLEAR_PICKS` reducer action that resets all bracket picks while preserving lever settings, matchup overrides, pool size, and bracket name. New `ClearPicksButton` component in the bracket header with inline confirmation ("Clear N picks? Yes/No"). Disabled when no picks exist. Marks bracket dirty only if previously saved. 3 new tests.
- [x] **Venue locations in matchup UI** — Added venue name and city display to the matchup view header (e.g., "KeyBank Center • Buffalo, New York"). Updated `seed-tournament-sites.ts` to parse the Arena column from CSV and store actual venue names. Exposed `venue` field from `useMatchupAnalysis` hook via `GameSiteCoordinates`.
- [x] **2025 backtest data** — Added 2025 to scraper SEASONS array, updated `TEST_SEASONS` in `backtest.ts`, ran scraper to generate 63 games of 2025 tournament results into `historical-results.ts`.

### Batch 12 — Big Feature ✅

- [x] **First Four play-in bracket** — Full 68-team bracket support with 4 First Four play-in games (2 at 16-seed, 2 at 11-seed). Added `"FF"` to `TournamentRound`, `PlayInConfig`/`PlayInMatchup` types, dynamic `buildBracketMatchups(playInConfig)` producing 67 games, `buildBracketSlots()` for FF slot IDs, `detectPlayInPairs()` auto-detection, `processTournamentField()` replacement for `filterToMainBracket()`. BracketProvider uses dynamic matchups/downstream map via reducer factory pattern. Both API routes thread play-in config. New `FirstFour` UI component (horizontal strip of 4 MatchupSlot cards) renders above main bracket grid on desktop and as "First 4" tab on mobile. Updated `seed-mock-bracket.ts` (default 68 teams, `--no-play-ins` for 64) and `seed-bracket.ts` (accepts 64 or 68 teams). Fixed `ROUND_ORDER` array-index alignment bug and aggregator expected-wins calculation for play-in teams. 27 files changed, 9 new tests, all 941 tests passing.

### Batch 13 — Polish & Close-out

- [x] **Missing coaches data** — Root cause: `seed-coaches.ts` used raw `toLowerCase()` matching for Kaggle team names, but Kaggle uses period-less abbreviations ("Michigan St", "St Louis", "NC State") that don't match DB names ("Michigan St.", "Saint Louis", "North Carolina St."). Fix: (1) Extended `normalizeForMerge()` in `merger.ts` with rules for bare "St"→"state"/"saint" suffix/prefix, bare directional abbreviations ("N"→"north", "S"→"south"), "NC"→"north carolina", "SC"→"south carolina", "MS"→"mississippi", "Mt"→"mount"; (2) Updated `seed-coaches.ts` to use `normalizeForMerge()` instead of raw lowercasing; (3) Added `KAGGLE_NAME_OVERRIDES` table for Kaggle-specific abbreviations (`normalizeForMerge` can't resolve (e.g., "Abilene Chr"→"Abilene Christian", "FL Atlantic"→"Florida Atlantic", 70+ mappings). Match rate improved from ~60% to 99.5% (365/367 coaches matched and seeded). Added 9 new Kaggle-format tests to `merger.test.ts`. Created `/seed-coaches` skill for reusable Selection Sunday workflow.
- [ ] **Final README and PRD update** — Update `README.md` and `docs/PRD.md` to reflect all completed features, architecture, and deployment state. Last documentation pass before launch.

### Claude Code Skills _(completed)_

- [x] `/simulate-matchup` — `.claude/skills/simulate-matchup/SKILL.md`
- [x] `/generate-narrative` — `.claude/skills/generate-narrative/SKILL.md`
- [x] `/add-team-data` — `.claude/skills/add-team-data/SKILL.md`
- [x] `/audit-bracket` — `.claude/skills/audit-bracket/SKILL.md`
- [x] `/component [name]` — `.claude/skills/component/SKILL.md`
- [x] `/seed-coaches` — `.claude/skills/seed-coaches/SKILL.md`

---

## Completed Phases

_Phases will be moved here as they are completed, with completion dates._
