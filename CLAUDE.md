# March Madness Bracket Prediction App

## Overview

A web application for building, simulating, and strategizing NCAA March Madness bracket predictions. The app uses Monte Carlo simulation to generate win probabilities, surfaces contextual guidance based on bracket construction choices, and incorporates game theory recommendations based on contest pool size. It is intended to be deployed as a shareable web app.

### Design Philosophy

The gold standard for UI/UX reference is **Baseball Savant** — dark mode by default, extremely smooth navigation, fast performance, and data-dense without feeling cluttered. Every interaction should feel responsive and intentional. Data should be the star of the experience.

---

## Core Features

### 1. Probability Model

The base win probability model is built from a composite of three established adjusted efficiency rating systems:

- **KenPom Adjusted Efficiency Margin (AdjEM)**
- **Torvik Adjusted Efficiency Margin (AdjEM)**
- **Evan Miya Bayesian Performance Rating (BPR)**

The composite weights of these three ratings should be configurable. Win probabilities are derived from rating differentials using a log5-style logistic model. This base probability is then modified by the lever and variance adjustment layers described below.

---

### 2. Lever System

Levers allow users to adjust how much weight specific factors carry in the probability calculation beyond raw efficiency ratings. There are two categories of levers:

#### Global Levers (bracket-wide)
Applied uniformly across all matchups. Controlled from the main bracket view. These affect the **mean** win probability:

- **Four Factors weights** — offensive and defensive versions are weighted separately:
  - Effective Field Goal % (offense and defense)
  - Turnover Rate (offense and defense)
  - Offensive Rebounding Rate (offense and defense)
  - Free Throw Rate (offense and defense)
- **Roster Experience** — KenPom's minutes-weighted D-1 experience metric
- **Minutes Continuity** — rotation continuity from prior season
- **Coach Tournament Experience** — configurable weight for a coach's prior tournament track record

The following levers primarily affect the **variance (width)** of the Monte Carlo outcome distribution rather than the mean:

- **Pace / Tempo** — slower pace compresses outcomes, increasing upset probability for mismatched teams
- **Three-Point Rate** — high-volume 3-point teams introduce boom/bust variance; affects distribution width

#### Per-Matchup Overrides (matchup-specific)
Accessible from the individual matchup view. All global lever values are inherited as defaults and can be overridden for a specific game. Additionally, per-matchup controls include:

- **Injury / Availability** — manual downward adjustment for roster availability issues
- **Site Proximity** — distance-based advantage derived from each team's campus location relative to the game site (bucketed: true home regional, regional advantage, neutral, moderate travel, significant travel)
- **Recent Form / Momentum** — manual override for teams whose recent trajectory diverges significantly from season-long ratings
- **Rest / Schedule Density** — adjustment for days of rest, particularly relevant after deep conference tournament runs

Each lever in the UI is accompanied by a plain-language explanation of what the metric measures, when it is worth adjusting, and how it mechanically affects probability outcomes.

---

### 3. Bracket View

The primary screen of the application. Displays the full 64-team bracket with:

- Each team's path probabilities — likelihood of reaching each round
- Global lever sliders accessible from this view
- Visual indicators on matchups where per-matchup overrides have been applied
- Overall simulation summary (e.g., most likely champion, round-by-round survival probabilities for all teams)

---

### 4. Matchup View

Accessed by clicking any matchup in the bracket. A dedicated "film room" for a specific game containing:

- Both teams' full statistical profiles (efficiency ratings, Four Factors, tempo, experience metrics, 2-Foul Participation, bench minutes, average height, etc.)
- Side-by-side comparison of all relevant data fields
- Per-matchup lever overrides (inherited from global defaults, adjustable independently)
- Win probability output for this specific matchup, before and after overrides
- Monte Carlo distribution visualization showing the spread of simulated outcomes for this game
- AI-generated narrative analysis (see Section 6)

---

### 5. Monte Carlo Simulation Engine

- Runs 10,000–100,000 simulations of the full bracket
- Each simulation propagates results forward — downstream matchup probabilities reflect the probability of each team even being present
- Lever adjustments affect either the mean probability, the variance of the outcome distribution, or both, depending on the lever type
- Simulation is triggered explicitly (e.g., a "Simulate" button) rather than recalculating live on every slider change
- Outputs both full-bracket path probabilities and per-matchup win probabilities

---

### 6. AI Matchup Narrative

Available in the matchup view. Calls an AI model to generate a plain-language breakdown of the matchup synthesizing all available data for that game. The narrative:

- Is grounded strictly in the structured data provided — it does not speculate beyond what the data supports
- Synthesizes interaction effects between data points (e.g., slow pace + defensive efficiency advantage = compressed variance favoring underdog)
- Includes coaching tendency signals where data supports them (e.g., 2-Foul Participation as a proxy for foul management philosophy)
- Describes how the game might plausibly play out based on stylistic contrasts
- Closes with a recommendation that incorporates both the simulation output and the pool context (ownership estimates, contest size)

The AI prompt is constructed from:
1. Structured data for both teams in a consistent, labeled format
2. A data dictionary explaining how to interpret each field
3. Explicit reasoning instructions for how to weigh fields in combination and what interactions to look for
4. One or two example outputs demonstrating the desired narrative style and structure
5. Explicit constraints on what the model should not do (no speculation beyond the data, no hedging without a recommendation)

---

### 7. Contextual Guidance & Warnings

The app surfaces proactive guidance to help users make better bracket decisions without restricting their choices. Examples:

- **Upset volume warning** — flags if the user has selected more first-round upsets than is historically typical, noting the compounding risk to early-round bracket survival
- **Chalk concentration warning** — flags if the bracket is heavily correlated with popular consensus picks, noting the implication for large contests
- **Variance mismatch note** — if a high-pace or high-3-point-rate team is selected to advance deep, surfaces the fragility of that pick
- **Lever conflict detection** — if the experience lever is weighted heavily but the user picks a freshman-heavy team to advance, surfaces the tension
- **Recency divergence flag** — if a team's recent form rating diverges significantly from their season-long composite, surfaces it as a meaningful signal worth considering
- **Pace/tempo explanation** — contextual note when slow-paced teams are involved explaining the variance-compression effect on upset probability

Guidance is informational, not restrictive. The user always has final control.

---

### 8. Game Theory / Contest Mode

At the start of a session, the user specifies their contest pool size (or selects a bucket). This context shapes how recommendations are surfaced throughout the app:

- **Small pool (≤20 people)** — emphasis on raw probability maximization; differentiation matters less
- **Medium pool (50–200 people)** — guidance toward 1–2 strategically contrarian picks while maintaining chalk elsewhere
- **Large pool (500+)** — champion pick ownership becomes a primary consideration; low-ownership + defensible picks are surfaced
- **Very large pool (100,000+)** — framed as a lottery-style strategy; pure expected-score maximization is de-emphasized in favor of low-ownership paths

The app includes an **ownership model** — a heuristic estimate of how heavily the field will pick each team to advance, based on seed, conference, media profile, and historical over-pick patterns. This ownership estimate is shown alongside win probability in the bracket view and incorporated into AI narrative recommendations.

---

### 9. Backtesting Module

Allows the user to replay historical tournaments (2002–present, subject to data availability) using archived end-of-regular-season ratings and evaluate model performance. Features:

- Select a year and run the simulation against actual tournament results
- Evaluate using **Brier Score** as the primary metric (rewards calibrated probabilities)
- Comparison against a naive seed-based baseline
- Lever weight tuning: adjust lever weights and re-run to explore what configuration would have been most predictive
- Years held out as a test set (recommended: 2021–2024) to guard against overfitting when tuning lever weights
- 2021 tournament flagged as anomalous due to COVID-related conditions

---

## Data Inputs

The following data fields are used per team. All fields should be sourced from end-of-regular-season snapshots, not updated mid-tournament:

| Field | Source |
|---|---|
| Adjusted Offensive Efficiency | KenPom / Torvik / Evan Miya |
| Adjusted Defensive Efficiency | KenPom / Torvik / Evan Miya |
| Adjusted Tempo | KenPom |
| Avg. Possession Length (Off / Def) | KenPom |
| Effective FG% (Off / Def) | KenPom |
| Turnover % (Off / Def) | KenPom |
| Offensive Rebound % (Off / Def) | KenPom |
| FTA/FGA (Off / Def) | KenPom |
| 3P% (Off / Def) | KenPom |
| 3PA/FGA (Off / Def) | KenPom |
| FT% (Off / Def) | KenPom |
| Bench Minutes % | KenPom |
| D-1 Experience (minutes-weighted) | KenPom |
| Minutes Continuity | KenPom |
| Average Height | KenPom |
| 2-Foul Participation | KenPom |
| Coach tournament record / experience | Curated |
| Campus-to-site distance | Derived |

---

## Technology Preferences

- **Frontend**: React + TypeScript
- **Deployment**: Web app, publicly shareable URL
- **Design**: Dark mode default, smooth transitions, data-dense but uncluttered. Baseball Savant is the UX reference.
- **AI Narrative**: Anthropic Claude API

---

## Architecture Decisions

- **Framework**: Next.js (React + TypeScript) — server-side rendering, API routes for simulation and Claude calls
- **Auth & Database**: Supabase (PostgreSQL + built-in auth with email/OAuth)
- **Deployment**: Railway or Render (persistent server for simulation compute)
- **Simulation**: Server-side Monte Carlo via API routes
- **Data Pipeline**: Admin-managed ingestion from KenPom, Torvik, and Evan Miya into Supabase
- **AI Narrative**: Claude API called from Next.js API routes (API key server-side only)

---

## Development Workflow

Every development step follows this process:

1. **Branch** — Create a new feature branch from `main`
2. **Code** — Implement the feature on that branch
3. **Test** — Run all relevant tests and verify functionality
4. **Document** — Update all documentation:
   - `CLAUDE.md` (this file) — project spec and architecture
   - `PROJECT_PLAN.md` — mark phases/tasks complete, update backlog
   - `docs/PRD.md` — product requirements
   - `docs/USER_GUIDE.md` — end-user documentation
   - `README.md` — setup instructions and overview
5. **Commit & Push** — Commit with a descriptive message and push to GitHub

### Parallel Development

When multiple steps are independent, deploy subagents to execute them in parallel on separate branches. Once all branches pass tests, merge them into `main` before updating documentation.

### Backlog Discipline

When ideas or improvements surface during development, add them to the **Backlog** section in `PROJECT_PLAN.md` rather than addressing them immediately. Stay focused on the current phase.

### Key Conventions

- All team data types live in `src/types/`
- Probability/simulation engine code lives in `src/lib/engine/`
- Supabase client and helpers live in `src/lib/supabase/`
- API routes live in `src/app/api/`
- UI components live in `src/components/`
- Reusable hooks live in `src/hooks/`
- Test files are co-located with source files using `.test.ts` / `.test.tsx` suffix