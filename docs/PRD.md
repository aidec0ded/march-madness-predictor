# Product Requirements Document — The Bracket Lab

## Document Info

| Field        | Value                           |
| ------------ | ------------------------------- |
| Product Name | The Bracket Lab                 |
| Domain       | thebracketlab.ai                |
| Version      | 0.1 (Draft)                     |
| Last Updated | 2026-03-14                      |
| Status       | In Development                  |

---

## 1. Product Overview

A web application that helps users build smarter NCAA March Madness bracket predictions by combining statistical models, Monte Carlo simulation, contextual guidance, and game theory strategy. Aimed at serious bracket contest participants who want a data-driven edge.

### 1.1 Target Users

- **Primary**: Bracket contest participants who want to go beyond gut picks — comfortable with data, willing to spend 30–60 minutes building a bracket
- **Secondary**: Analytics-curious college basketball fans who want to explore matchup data and probabilities
- **Tertiary**: Contest operators or content creators looking for a shareable analytical tool

### 1.2 Key Value Propositions

1. **Composite probability model** — blends three respected rating systems (KenPom, Torvik, Evan Miya) into calibrated win probabilities
2. **Configurable levers** — users tune what factors matter most, seeing how adjustments change outcomes
3. **Contest-aware strategy** — pool size shapes recommendations, surfacing contrarian picks when differentiation matters
4. **AI-powered narratives** — plain-language matchup breakdowns grounded in data, not speculation
5. **Backtesting** — validate model performance against 20+ years of tournament history

---

## 2. Functional Requirements

### 2.1 Core Probability Model

| Requirement                                      | Priority | Notes                                          |
| ------------------------------------------------ | -------- | ---------------------------------------------- |
| Composite rating from KenPom, Torvik, Evan Miya  | P0       | Configurable weights                           |
| Log5 logistic model for pairwise win probability | P0       | Standard approach                              |
| Global lever system (mean adjustments)           | P0       | Four Factors, experience, continuity, coaching |
| Variance levers (distribution width)             | P0       | Pace, 3-point rate                             |
| Per-matchup overrides                            | P1       | Injury, site proximity, form, rest             |

### 2.2 Monte Carlo Simulation

| Requirement                            | Priority | Notes               |
| -------------------------------------- | -------- | ------------------- |
| Server-side simulation (10K–100K runs) | P0       | API endpoint        |
| Full bracket propagation (63 games)    | P0       | Forward-propagating |
| Path probabilities per team per round  | P0       | Key output          |
| Configurable simulation count          | P1       | 10K/25K/50K/100K    |
| Progress reporting for long sims       | P2       | UX polish           |

### 2.3 Bracket View

| Requirement                     | Priority | Notes                     |
| ------------------------------- | -------- | ------------------------- |
| 64-team bracket display         | P0       | Four regions + Final Four |
| Interactive bracket picking     | P0       | Click to advance          |
| Team probability display        | P0       | Per-round survival        |
| Global lever panel              | P0       | Sidebar/drawer            |
| Simulation trigger + results    | P0       | Button with loading state |
| Override indicators on matchups | P1       | Visual cue                |

### 2.4 Matchup View

| Requirement                  | Priority | Notes                  |
| ---------------------------- | -------- | ---------------------- |
| Side-by-side team comparison | P0       | All stat fields        |
| Per-matchup lever overrides  | P0       | Inherited defaults     |
| Win probability display      | P0       | Before/after overrides |
| Distribution visualization   | P1       | Histogram or density   |
| AI narrative                 | P1       | Claude API             |

### 2.5 User Accounts

| Requirement                       | Priority | Notes            |
| --------------------------------- | -------- | ---------------- |
| Sign up / sign in (email + OAuth) | P0       | Supabase Auth    |
| Save/load brackets                | P0       | Per-user         |
| Save lever configurations         | P1       | Reusable presets |
| User settings/preferences         | P2       | Theme, defaults  |

### 2.6 Game Theory / Contest Mode

| Requirement                 | Priority | Notes                               |
| --------------------------- | -------- | ----------------------------------- |
| Pool size selection         | P1       | Buckets: small/med/large/very large |
| Ownership model (heuristic) | P1       | Seed, conference, media profile     |
| Strategy recommendations    | P1       | Varies by pool size                 |

### 2.7 Contextual Guidance

| Requirement                 | Priority | Notes                     |
| --------------------------- | -------- | ------------------------- |
| Upset volume warning        | P1       | vs. historical base rates |
| Chalk concentration warning | P1       | vs. ownership model       |
| Variance mismatch note      | P2       | High-variance deep runs   |
| Lever conflict detection    | P2       | Lever weights vs. picks   |

### 2.8 Backtesting

| Requirement                          | Priority | Notes                        |
| ------------------------------------ | -------- | ---------------------------- |
| Historical simulation (2002–present) | P2       | Subject to data availability |
| Brier Score evaluation               | P2       | Primary metric               |
| Seed-based baseline comparison       | P2       | Sanity check                 |
| Lever tuning interface               | P2       | Explore configurations       |

---

## 3. Non-Functional Requirements

| Requirement                 | Target                                      |
| --------------------------- | ------------------------------------------- |
| Simulation speed (50K sims) | < 5 seconds                                 |
| Page load time              | < 2 seconds                                 |
| Uptime                      | 99.5% during tournament season (March)      |
| Browser support             | Chrome, Firefox, Safari (latest 2 versions) |
| Mobile support              | Responsive, but desktop-first               |
| Dark mode                   | Default, with optional light mode           |

---

## 4. Technical Architecture

See `CLAUDE.md` — Architecture Decisions section.

---

## 5. Data Requirements

See `CLAUDE.md` — Data Inputs table.

---

## 6. Open Questions

- Exact sourcing method for Evan Miya BPR data — manual entry vs. partnership
- Ownership model calibration — need historical public pick data to validate heuristics
- Simulation count defaults — UX testing needed to find the right balance of speed vs. accuracy
- Mobile bracket UX — 64-team bracket on mobile is a significant design challenge

---

## 7. Success Metrics

- **Model calibration**: Brier Score competitive with public models (KenPom, 538 historical, Torvik)
- **User engagement**: Average session length > 15 minutes during tournament season
- **Bracket quality**: Users who follow model recommendations outperform random/chalk baselines
