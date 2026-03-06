# Project Plan — March Madness Bracket Prediction App

## Architecture Summary

| Component | Choice | Rationale |
|---|---|---|
| Framework | Next.js + TypeScript | SSR, API routes, single deployable unit |
| Auth & DB | Supabase (PostgreSQL) | Built-in auth, row-level security, generous free tier |
| Deployment | Railway or Render | Persistent server for simulation compute |
| Simulation | Server-side (API routes) | Reliable performance for 10K–100K bracket sims |
| Data Pipeline | Admin-managed ingestion | KenPom (CSV), Torvik (API), Evan Miya (manual) |
| AI Narrative | Claude API (server-side) | Prompt-engineered matchup analysis |
| Styling | Tailwind CSS | Utility-first, dark mode support, rapid iteration |
| Testing | Vitest + React Testing Library | Fast, co-located tests |

---

## Development Phases

### Phase 0: Project Scaffolding & Infrastructure
> Foundation — everything else builds on this.

- [ ] Initialize Next.js + TypeScript project (App Router)
- [ ] Configure Tailwind CSS with dark mode defaults
- [ ] Set up Supabase project (auth + database)
- [ ] Configure ESLint, Prettier
- [ ] Set up Vitest + React Testing Library
- [ ] Create base directory structure (`src/types/`, `src/lib/`, `src/components/`, `src/hooks/`, `src/app/api/`)
- [ ] Configure environment variables (`.env.local` template)
- [ ] Set up CI with GitHub Actions (lint + test on PR)
- [ ] Deploy initial skeleton to Railway/Render

**Parallelizable:** Supabase project setup can happen alongside Next.js scaffolding.

---

### Phase 1: Data Layer & Admin Pipeline
> Get real data flowing before building UI or simulation.

- [ ] Define TypeScript interfaces for all team data fields (see CLAUDE.md data table)
- [ ] Design Supabase schema: `teams`, `seasons`, `team_stats`, `coaches`, `tournament_sites`
- [ ] Build admin data import API route (CSV upload → parse → validate → insert)
- [ ] Build Torvik data fetcher (programmatic pull from barttorvik.com)
- [ ] Build data normalization layer (map KenPom/Torvik/Miya fields to unified schema)
- [ ] Create admin UI page for data management (upload, review, approve)
- [ ] Seed database with current season data
- [ ] Write unit tests for data validation and normalization

**Parallelizable:** Schema design, TypeScript types, and Torvik fetcher are independent.

---

### Phase 2: Core Probability Engine
> The mathematical heart of the application.

- [ ] Implement composite rating calculator (weighted average of KenPom/Torvik/Miya)
- [ ] Implement log5 logistic model for pairwise win probability
- [ ] Build global lever system — mean-adjusting levers:
  - Four Factors weights (8 sub-levers: offense/defense × 4 factors)
  - Roster Experience weight
  - Minutes Continuity weight
  - Coach Tournament Experience weight
- [ ] Build variance levers:
  - Pace/Tempo effect on distribution width
  - Three-Point Rate effect on distribution width
- [ ] Build per-matchup override system (inherits globals, allows override)
  - Injury/Availability adjustment
  - Site Proximity adjustment (with distance bucketing)
  - Recent Form/Momentum override
  - Rest/Schedule Density adjustment
- [ ] Write comprehensive unit tests for all probability calculations
- [ ] Validate against known matchup outcomes for sanity checking

**Parallelizable:** Mean levers, variance levers, and per-matchup overrides are independent once the base model exists.

---

### Phase 3: Monte Carlo Simulation Engine
> Full bracket simulation, server-side.

- [ ] Build simulation API endpoint (`POST /api/simulate`)
- [ ] Implement single-game outcome sampling (using probability + variance)
- [ ] Implement full bracket propagation (63 games, forward-propagating)
- [ ] Aggregate results: path probabilities, round-by-round survival, champion likelihood
- [ ] Apply lever effects to simulation parameters
- [ ] Optimize for performance (target: 50K sims in < 5 seconds)
- [ ] Add configurable simulation count (10K / 25K / 50K / 100K)
- [ ] Write integration tests for simulation pipeline
- [ ] Add progress reporting for long-running simulations

**Dependencies:** Requires Phase 2 (probability engine).

---

### Phase 4: Authentication & User Management
> User accounts, bracket persistence, saved configurations.

- [ ] Integrate Supabase Auth with Next.js (middleware, session handling)
- [ ] Build sign-up / sign-in pages (email + OAuth providers)
- [ ] Design schema for user data: `user_brackets`, `user_lever_configs`, `user_settings`
- [ ] Implement bracket save/load API routes
- [ ] Implement lever configuration save/load
- [ ] Set up Supabase Row Level Security (RLS) policies
- [ ] Build user profile/settings page
- [ ] Write auth integration tests

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

_Empty — items will be added here as they surface during development._

---

## Completed Phases

_Phases will be moved here as they are completed, with completion dates._
