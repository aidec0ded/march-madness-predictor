# User Guide — March Madness Bracket Predictor

> This guide will be expanded as features are built. Sections marked [Coming Soon] are planned but not yet available.

---

## Getting Started

### Creating an Account

[Coming Soon]

### Setting Up Your Contest

When you first open the app, you'll select your contest pool size. This shapes how the app generates recommendations:

| Pool Size          | Strategy                                      |
| ------------------ | --------------------------------------------- |
| Small (≤20)        | Focus on picking the most probable outcomes   |
| Medium (50–200)    | Mix chalk with 1–2 strategic contrarian picks |
| Large (500+)       | Champion pick ownership becomes critical      |
| Very Large (100K+) | Optimize for low-ownership paths              |

You can change your pool size at any time from Settings.

---

## The Bracket View

[Coming Soon] — The main screen displaying all 64 teams, your picks, and simulation results.

---

## Making Picks

[Coming Soon] — How to select winners, advance teams, and build your bracket.

---

## Understanding Probabilities

### The Composite Model

The app blends three respected college basketball rating systems to calculate win probabilities:

1. **KenPom** — Adjusted efficiency margin
2. **Torvik** — Adjusted efficiency margin
3. **Evan Miya** — Bayesian Performance Rating

These are combined into a single composite rating, which is then converted into a win probability for each matchup using a logistic model.

### What the Percentages Mean

A team showing "72%" in a matchup means: across thousands of simulated outcomes, that team won approximately 72% of the time given the current model settings.

---

## Adjusting Levers

[Coming Soon] — How to use global and per-matchup levers to customize the model.

### Global Levers

[Coming Soon]

### Per-Matchup Overrides

[Coming Soon]

---

## The Matchup View

[Coming Soon] — Deep-dive analysis for individual games.

---

## AI Analysis

[Coming Soon] — AI-generated matchup narratives powered by Claude.

---

## Contextual Guidance

[Coming Soon] — Warnings and insights the app surfaces as you build your bracket.

---

## Backtesting

[Coming Soon] — How to test the model against historical tournament results.

---

## FAQ

**Q: How often is the data updated?**
A: Team data is loaded from end-of-regular-season snapshots and is not updated mid-tournament. The admin manages data updates.

**Q: Can I use my own data?**
A: [Coming Soon] — We plan to support user-provided data overrides.

**Q: Is this free?**
A: [TBD]

---

## Glossary

| Term         | Definition                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| AdjEM        | Adjusted Efficiency Margin — points scored/allowed per 100 possessions, adjusted for opponent strength |
| BPR          | Bayesian Performance Rating (Evan Miya)                                                                |
| Brier Score  | Metric for evaluating probability calibration — lower is better                                        |
| Four Factors | Dean Oliver's four key basketball stats: eFG%, TO%, ORB%, FTR                                          |
| Log5         | Method for computing win probability from two teams' ratings                                           |
| Monte Carlo  | Simulation technique that runs thousands of random trials to estimate probabilities                    |
| Ownership    | Estimated percentage of contest participants picking a given team                                      |
