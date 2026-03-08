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
- [ ] Deploy initial skeleton to Railway/Render

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
- [ ] Validate against known matchup outcomes for sanity checking (deferred to Phase 10 backtesting)

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
- [ ] Optimize for performance (target: 50K sims in < 5 seconds) — deferred to Phase 11
- [ ] Add progress reporting for long-running simulations — deferred to Phase 11

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
- [ ] Write auth integration tests — deferred to post-UI when end-to-end flows can be tested

**Parallelizable with Phase 2 and Phase 3** — auth is independent of the engine.

---

### Phase 5: Bracket View UI

> The primary screen — data-dense, dark, smooth.

- [ ] Build 64-team bracket layout component (responsive, all four regions + Final Four)
- [ ] Build team card component (name, seed, probability bars)
- [ ] Implement interactive bracket picking (click to advance team)
- [ ] Build global lever panel (collapsible sidebar/drawer)
- [ ] Build simulation trigger button with loading/progress state
- [ ] Display simulation results overlay (champion probabilities, round survival)
- [ ] Implement dark mode theme system (Baseball Savant inspired)
- [ ] Add visual indicators for matchups with per-matchup overrides
- [ ] Responsive design (desktop primary, tablet secondary)

**Dependencies:** Requires Phase 2 (lever system), Phase 3 (simulation results to display), Phase 4 (save/load).

---

### Phase 6: Matchup View UI

> Deep-dive "film room" for individual games.

- [ ] Build team statistical profile card component
- [ ] Build side-by-side comparison layout
- [ ] Build per-matchup lever override panel (shows inherited defaults, allows override)
- [ ] Display win probability before and after overrides
- [ ] Build Monte Carlo distribution visualization (histogram/density chart)
- [ ] Navigation: bracket view ↔ matchup view with context preservation
- [ ] Charting library integration (Recharts, Nivo, or D3)

**Dependencies:** Requires Phase 5 (bracket navigation context).

---

### Phase 7: Game Theory / Contest Mode

> Strategic layer — pool size shapes recommendations.

- [ ] Build pool size selection UI (session start or settings)
- [ ] Implement ownership model:
  - Heuristic based on seed, conference, media profile, historical over-pick patterns
  - Store ownership estimates per team per round
- [ ] Build strategy recommendation engine:
  - Small pool: maximize probability
  - Medium pool: 1–2 contrarian picks
  - Large pool: champion ownership weighting
  - Very large pool: low-ownership path optimization
- [ ] Display ownership estimates alongside win probabilities in bracket view
- [ ] Feed contest context into AI narrative recommendations (Phase 9)

**Parallelizable with Phase 6 and Phase 8.**

---

### Phase 8: Contextual Guidance System

> Proactive warnings and insights without restricting choice.

- [ ] Build guidance rules engine:
  - Upset volume warning (vs. historical base rates)
  - Chalk concentration warning (vs. ownership model)
  - Variance mismatch note (high-variance teams advancing deep)
  - Lever conflict detection (lever weights vs. team profiles)
  - Recency divergence flag (recent form vs. season composite)
  - Pace/tempo explanation (variance compression)
- [ ] Build guidance display component (non-intrusive banners or sidebar notes)
- [ ] Trigger re-evaluation on bracket changes and lever adjustments
- [ ] Write unit tests for each guidance rule

**Parallelizable with Phase 7.**

---

### Phase 9: AI Matchup Narrative

> Claude-powered analysis in the matchup view.

- [ ] Build Claude API integration (Next.js API route, server-side only)
- [ ] Engineer prompt template:
  - Structured team data payload
  - Data dictionary for field interpretation
  - Reasoning instructions for interaction effects
  - 1–2 example outputs for style/structure
  - Constraints (no speculation, must recommend)
- [ ] Build narrative display component in matchup view
- [ ] Add generation trigger (button, not auto-generate)
- [ ] Implement response caching (avoid re-generating for same data)
- [ ] Rate limiting / cost controls
- [ ] Incorporate contest mode context into prompt

**Dependencies:** Requires Phase 6 (matchup view to display in), Phase 7 (contest context for prompt).

---

### Phase 10: Backtesting Module

> Model validation and lever tuning against history.

- [ ] Source and format historical data (2002–present, as available)
- [ ] Build historical data import pipeline
- [ ] Build backtest runner: simulate historical tournament → compare to actual results
- [ ] Implement Brier Score calculator
- [ ] Build naive seed-based baseline for comparison
- [ ] Build lever tuning interface: adjust weights → re-run → compare scores
- [ ] Implement train/test split management (recommended: hold out 2021–2024)
- [ ] Flag 2021 as anomalous (COVID bubble)
- [ ] Build results visualization (Brier score over years, calibration plots)

**Largely independent — can be developed in parallel with Phases 7–9.**

---

### Phase 11: Polish, Performance & Production

> Ship it.

- [ ] Performance audit: bundle size, API response times, simulation speed
- [ ] Lazy loading for heavy components (charts, matchup view)
- [ ] Error boundaries and graceful failure handling
- [ ] Accessibility audit (ARIA, keyboard navigation, color contrast)
- [ ] SEO / Open Graph tags for shared bracket URLs
- [ ] Production environment configuration
- [ ] Custom domain setup
- [ ] Monitoring and logging
- [ ] Final documentation pass

---

## Backlog

> Items discovered during development. Will be prioritized and scheduled after the initial build.

### Claude Code Skills (create once sufficient context exists)

- [ ] `/simulate-matchup` — Pull two teams' data, run probability model, output structured matchup breakdown
- [ ] `/generate-narrative` — Build AI narrative prompt from matchup data (data block, interpretation instructions, output)
- [ ] `/backtest-year [year]` — Full backtesting workflow: load archived data, simulate, Brier Score, seed baseline comparison
- [ ] `/add-team-data` — Structured team data ingestion with schema validation
- [ ] `/audit-bracket` — Run guidance system against current bracket state, surface all warnings
- [ ] `/component [name]` — Component scaffolding with design system context (dark mode, Baseball Savant, TS types)

> These skills should be created as the corresponding features are built — not before. Each skill needs real types, working code, and ideally 2–3 example outputs to be grounded properly.

---

## Completed Phases

_Phases will be moved here as they are completed, with completion dates._
