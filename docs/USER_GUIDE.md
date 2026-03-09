# User Guide — March Madness Bracket Predictor

---

## Getting Started

### Creating an Account

1. Navigate to the app and click **Sign Up** in the top-right corner.
2. Enter your email address and create a password, or use a social login provider (Google, GitHub).
3. If using email, check your inbox for a confirmation link and click it to activate your account.
4. Once signed in, you can save brackets, customize lever configurations, and generate AI narratives.

### Setting Up Your Contest

When you first open the app, you'll select your contest pool size. This shapes how the app generates recommendations:

| Pool Size          | Strategy                                      |
| ------------------ | --------------------------------------------- |
| Small (≤20)        | Focus on picking the most probable outcomes   |
| Medium (50–200)    | Mix chalk with 1–2 strategic contrarian picks |
| Large (500+)       | Champion pick ownership becomes critical      |
| Very Large (100K+) | Optimize for low-ownership paths              |

You can change your pool size at any time from the header bar dropdown or from Settings.

---

## The Bracket View

The bracket view is the primary screen of the application. It displays the full 64-team NCAA tournament bracket across four regions plus the Final Four.

**Key elements:**
- **Team cards** — Each team shows its seed, name, and a probability bar indicating win likelihood for that game.
- **Ownership badges** — Small badges showing estimated public pick ownership for each team, color-coded by level.
- **Override indicators** — Orange dots on matchups where per-matchup overrides have been applied.
- **Header bar** — Contains the pool size selector, Simulate button, and toggles for Levers, Results, and Guidance panels.

**Navigation:**
- Click any matchup to open the detailed Matchup View.
- Click the Simulate button to run Monte Carlo simulations and see updated probabilities.

---

## Making Picks

1. **Click a team card** in any Round of 64 matchup to select the winner.
2. The winning team automatically advances to the next round's slot.
3. Continue picking winners through each round until you reach the National Championship.
4. **Cascading invalidation** — If you change a pick in an earlier round, any downstream picks involving the previously selected team are automatically cleared.

Your bracket is auto-saved to your account (if signed in). You can also manually save named bracket configurations.

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

Levers let you customize how much weight specific factors carry in the probability model. There are two categories:

### Global Levers

Accessible from the **Levers** toggle in the bracket header. These apply across all matchups:

- **Composite Weights** — Adjust the relative weight of KenPom, Torvik, and Evan Miya ratings. Weights auto-normalize to sum to 1.0.
- **Four Factors** — Tune offense and defense weights for Effective FG%, Turnover Rate, Offensive Rebound Rate, and Free Throw Rate (8 sliders total).
- **Roster Experience** — Weight for minutes-weighted D-1 experience.
- **Minutes Continuity** — Weight for rotation continuity from prior season.
- **Coach Tournament Experience** — Weight for a coach's prior tournament track record.
- **Pace/Tempo** — Affects distribution width (slower pace compresses outcomes, increasing upset probability).
- **Three-Point Rate** — Affects distribution width (high-volume 3-point shooting introduces boom/bust variance).

### Per-Matchup Overrides

Accessible from the Matchup View. All global lever values are inherited and can be overridden for a specific game:

- **Injury/Availability** — Downward adjustment for roster availability issues.
- **Site Proximity** — Distance-based advantage (true home regional, regional advantage, neutral, moderate travel, significant travel).
- **Recent Form/Momentum** — Override for teams whose recent trajectory diverges from season-long ratings.
- **Rest/Schedule Density** — Adjustment for days of rest after conference tournament runs.

---

## The Matchup View

Click any matchup in the bracket to open the full-screen Matchup View. This is your "film room" for analyzing a specific game.

**Contents:**
- **Probability Display** — Large win probability numbers for both teams, point spread, and a detailed breakdown table showing how each lever contributes.
- **Team Profile Cards** — Side-by-side cards showing efficiency ratings, four factors, shooting splits, tempo, experience, and coaching data.
- **Stat Comparison** — 15 metrics grouped by category with advantage coloring to quickly spot which team has the edge in each area.
- **Distribution Chart** — Histogram of simulated margin-of-victory outcomes, color-split at 0 to show each team's win scenarios.
- **AI Narrative Analysis** — Claude-powered plain-language game breakdown (see below).
- **Override Panel** — Per-matchup lever sliders to fine-tune this specific game's probability.

**Controls:**
- Press **Escape** or click **Back to Bracket** to close.
- All override changes are reflected immediately in the probability display.

---

## AI Analysis

Each matchup includes an AI-generated narrative analysis powered by Claude. To use it:

1. Open any matchup where both teams are determined.
2. Click **Generate Analysis** in the Narrative panel.
3. The narrative streams in real time and covers:
   - **Rating Profile** — How the teams compare on raw efficiency.
   - **Stylistic Matchup** — How their playing styles interact.
   - **Key Factors** — The most impactful data points for this specific game.
   - **How This Game Plays Out** — A plausible game flow based on the data.
   - **Recommendation** — A pick recommendation incorporating both win probability and pool strategy context.

Narratives are cached per matchup — regenerate only if you change overrides or lever settings.

**Rate limit:** 10 narratives per minute per user.

---

## Contextual Guidance

The **Guidance** panel (toggle in the bracket header) surfaces proactive warnings and insights as you build your bracket:

- **Upset Volume Warning** — Flags if you've selected more first-round upsets than is historically typical (~4 per year).
- **Chalk Concentration Warning** — Flags if your bracket is heavily correlated with consensus picks, reducing differentiation in large pools.
- **Variance Mismatch Note** — Flags high-variance teams (heavy 3-point shooting) picked to advance deep.
- **Lever Conflict Detection** — Flags when your lever weights contradict your picks (e.g., high experience weight but picking a freshman-heavy team).
- **Recency Divergence Flag** — Flags teams whose recent form significantly diverges from season-long ratings.
- **Pace/Tempo Explanation** — Contextual note when slow-paced underdogs are involved, explaining the variance compression effect.

All guidance is informational — you always have final control over your picks.

---

## Backtesting

The **Backtest** page (`/backtest`) lets you validate the model against historical tournament results (2008–2024).

**How to use:**
1. Navigate to `/backtest` from the app navigation.
2. Select a year range (training set: 2008–2019, test set: 2021–2024).
3. Optionally adjust lever weights to test different configurations.
4. Click **Run Backtest** to evaluate the model.

**Results include:**
- **Brier Score** — Primary metric for probability calibration (lower is better). Compared against a naive seed-based baseline.
- **Brier Score Chart** — Year-by-year Brier Score comparison between your model and the baseline.
- **Calibration Plot** — Shows how well predicted probabilities match actual win rates across probability bins.
- **Results Table** — Detailed per-year breakdown with game counts and scores.

**Note:** 2021 is flagged as anomalous due to the COVID bubble (all games played in Indianapolis).

---

## FAQ

**Q: How often is the data updated?**
A: Team data is loaded from end-of-regular-season snapshots and is not updated mid-tournament. The admin manages data updates.

**Q: Can I save multiple brackets?**
A: Yes. Sign in to save and load named bracket configurations.

**Q: How many simulations should I run?**
A: 10,000 is fast and good for exploration. Use 50,000 or 100,000 for final bracket decisions — more simulations produce more stable probabilities.

**Q: Is this free?**
A: The app is free to use. AI narrative generation requires an Anthropic API key configured by the administrator.

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
