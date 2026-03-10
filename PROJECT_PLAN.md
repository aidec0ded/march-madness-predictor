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
- [x] Implement log5 logistic model for pairwise win probability (k=0.0325, calibrated)
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
  - Site Proximity adjustment (5 buckets, -1.0 to +3.0 eff pts)
  - Recent Form/Momentum override (-5.0 to +5.0 eff pts)
  - Rest/Schedule Density adjustment (-3.0 to +3.0 eff pts)
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

- [ ] **Populate real 2026 bracket teams** — Replace test data with likely tournament field using Bracket Matrix as guide; define methodology for inputting the actual bracket post-Selection Sunday
- [ ] **Historical tournament data for backtesting** — Integrate Kaggle March Machine Learning Mania dataset (https://www.kaggle.com/competitions/march-machine-learning-mania-2023/data) for additional historical coverage; identify gaps and fill for tournaments not included
- [ ] **Coach data ingestion** — Define methodology for injecting coach tournament records (current season + historical) into the database
- [ ] **Tournament venue / location data** — Add game site locations for each round (already known info); auto-calculate site proximity from campus-to-venue distance instead of relying on manual user adjustment
- [ ] **NET Ranking / Strength of Schedule lever** — Add NET ranking or SoS-based lever (requires manual data capture + DB ingestion pipeline)
- [ ] **Luck regression lever** — KenPom Luck factor as a regression-to-mean signal (requires manual data capture + DB ingestion pipeline)
- [ ] **2-Foul Participation editability** — Either make 2-Foul Participation editable on the matchup screen, provide a manual DB injection path, or remove it from the UI if it can't be edited

### Batch 5 — Model Validation & Backtest Parity

- [ ] **Validate model against known outcomes** — Sanity-check engine predictions against historical matchup results
- [ ] **Align backtest levers with global bracket levers** — Backtest lever configuration should match the full set of global lever options from the bracket, so users can test their bracket lever configuration against historical data

### Batch 6 — UX Clarity & Guidance _(sequential)_

- [ ] **Per-matchup override guidance** — Add contextual help explaining how to calibrate each override slider (e.g., "if a team's 3rd-best player is injured, try 0.5–1.0; if a starter is out, try 2.0–3.0")
- [ ] **Clarify probability numbers on team cards** — The numbers next to team names are confusing: explain what they represent (round survival probability from simulation vs. single-game win probability); consider UX improvements so they're intuitive without explanation
- [ ] **Picked-team probability mismatch** — When a team is advanced, the number next to their name doesn't match the probability from the matchup screen; clarify the relationship between per-game probability and path probability, and decide on display approach
- [ ] **Simulation workflow clarity** — Clarify the intended user flow: can a user run simulation at start and after every pick? Running simulation updates per-game probabilities (visible from matchup screen) but doesn't auto-fill the bracket — make this clear in the UI
- [ ] **Ownership model transparency** — Document or expose what factors drive ownership estimates (seed, conference, media profile, historical over-pick patterns) so users understand the numbers
- [ ] **Backtest results interpretation guide** — Add in-app explanation of how to interpret backtest results: what Brier Score means, what the calibration chart shows, what "improvement over baseline" represents, and what good/bad values look like

### Batch 7 — Performance & Polish _(parallel)_

- [ ] **Simulation performance optimization** — Target 50K sims in <5 seconds (deferred from Phase 3)
- [ ] **Simulation progress reporting** — Real-time progress indicator for long-running simulations (deferred from Phase 3)
- [ ] **Performance audit** — Bundle analyzer, API response time benchmarks (deferred from Phase 11)
- [ ] **Responsive / mobile design polish** — Tablet horizontal scroll, mobile region-by-region bracket view (deferred from Phase 5 and Phase 11)

### Batch 8 — Custom Domain

- [ ] **Custom domain setup** — Configure custom domain on deployment provider (Render)

### Claude Code Skills _(completed)_

- [x] `/simulate-matchup` — `.claude/skills/simulate-matchup/SKILL.md`
- [x] `/generate-narrative` — `.claude/skills/generate-narrative/SKILL.md`
- [x] `/add-team-data` — `.claude/skills/add-team-data/SKILL.md`
- [x] `/audit-bracket` — `.claude/skills/audit-bracket/SKILL.md`
- [x] `/component [name]` — `.claude/skills/component/SKILL.md`

---

## Completed Phases

_Phases will be moved here as they are completed, with completion dates._
