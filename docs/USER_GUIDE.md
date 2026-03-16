# User Guide — March Madness Bracket Predictor

---

## Getting Started

### Creating an Account

1. Navigate to the app and click **Sign Up** in the top-right corner.
2. Enter your email address and create a password, or use a social login provider (Google, GitHub).
3. If using email, check your inbox for a confirmation link and click it to activate your account.
4. Once signed in, you can save brackets, customize lever configurations, and generate AI narratives.

### Setting Up Your Contest

When you first open the bracket view, you'll see a **pool size dropdown** in the header bar. Select the option that matches your contest:

| Pool Size          | Strategy                                      |
| ------------------ | --------------------------------------------- |
| Small (≤20)        | Focus on picking the most probable outcomes   |
| Medium (50–200)    | Mix chalk with 1–2 strategic contrarian picks |
| Large (500+)       | Champion pick ownership becomes critical      |
| Very Large (100K+) | Optimize for low-ownership paths              |

This choice shapes how the app generates recommendations — from AI narrative advice to guidance panel warnings. You can change it anytime.

---

## Building Your Bracket: A Complete Walkthrough

This section walks through the process of building a bracket from start to finish, in the order that makes the most sense.

### Step 1: Browse the Bracket

When you first arrive, you'll see the full 64-team bracket laid out across the screen:

- **Left side:** East region (top) and South region (bottom), reading left to right
- **Center:** Final Four and National Championship
- **Right side:** West region (top) and Midwest region (bottom), reading right to left
- **On mobile:** A tabbed view lets you browse one region at a time (East, West, South, Midwest, Final 4)

Each team card shows:
- **Seed badge** (color-coded: blue for 1–4, indigo for 5–8, amber for 9–12, gray for 13–16)
- **Team name**
- **Win probability** for that specific game (e.g., "72%"), computed from the composite rating model
- **Probability bar** — a visual representation of the win probability
- **Ownership badge** — estimated public pick percentage (shown as "X% own")

Before you do anything else, spend a minute scanning the bracket. The probabilities and ownership badges are already telling you a story — where the model sees value, and where the public disagrees.

### Step 2: Dive Into a Matchup

Click any matchup to open the **Matchup View** — a full-screen deep dive into that game. This is your film room. Here's what you'll find:

**Probability Display** at the top shows the win probability for each team in large type, along with an estimated point spread. Below that, a breakdown table shows exactly how each factor contributes to the probability — composite ratings, four factors, experience, pace effects, and any overrides you've applied.

**Team Profile Cards** sit side by side, each showing:
- Efficiency ratings (offensive, defensive, and adjusted) from all three rating systems
- Four Factors: Effective FG%, Turnover Rate, Offensive Rebound Rate, Free Throw Rate
- Shooting splits (3P%, 2P%, FT%)
- Tempo, roster experience, minutes continuity, average height, bench minutes, and coaching data

**Stat Comparison** shows 15+ metrics grouped by category with advantage coloring — green highlights which team leads in each stat, so you can quickly see where each team has an edge.

**Distribution Chart** shows a histogram of simulated margin-of-victory outcomes, split at zero. The shape tells you about variance: a tall, narrow distribution means predictable outcomes; a wide, flat distribution means anything could happen.

**AI Narrative Analysis** (click "Generate Analysis") produces a Claude-powered plain-language game breakdown. It covers the rating profile, stylistic matchup, key factors, how the game might play out, and closes with a recommendation that factors in your pool size. Narratives stream in real time, are cached per matchup, and are rate-limited to 10 per minute.

**Public Ownership & Leverage Analysis** sits between the probability display and team profiles. This section is the core of the game theory system:

- **Ownership bar** shows estimated public pick percentage for each team, color-coded relative to win probability: **green** if a team is under-owned (ownership < win probability), **amber** if over-owned (ownership > win probability), and **gray** if roughly equal. You can click **Override** to enter real ownership data from your contest (ESPN, Yahoo, etc.) — overrides show a "CUSTOM" badge and dashed border.
- **Leverage scores** show the ratio of win probability to ownership (winProb ÷ ownership). A score above 1.0× means the team is under-owned relative to their chances — contrarian value. Below 1.0× means over-owned. Leverage is color-coded: **green** when it exceeds the contrarian threshold for your pool size, **amber** when it falls below the symmetric inverse.
- **Edge callouts** appear when the model detects an actionable contrarian edge — when the underdog in a matchup has higher leverage than the favorite, exceeds a minimum win probability floor, and clears a round-adjusted threshold. Edge indicators are labeled "Strategic Edge" or "Strong Edge" with a plain-language explanation. These are pool-size-aware: larger pools surface edges more aggressively, while small pools suppress them (in small pools, raw probability maximization is optimal).
- **Explanatory text** at the bottom adapts to the matchup: it describes the edge when one exists, notes when both teams are under- or over-owned, or provides a generic explanation of the leverage formula.

The leverage system uses round-aware thresholds — later rounds (Elite 8, Final Four, Championship) lower the bar to surface more edges, since differentiation in later rounds carries more scoring weight. The system also enforces a probability floor per pool size so it won't recommend extreme longshots.

**Ownership Explainer** (click "How is ownership estimated?") reveals the four-factor methodology: seed baseline, round decay (×0.85 per round), conference profile (+4 percentage points for power conferences), and rating strength adjustment (±5 points based on over/underperformance vs. seed expectation).

Use the matchup view to understand *why* the model favors one team, and to decide whether you agree. Press **Escape** or click **Back to Bracket** to return.

### Step 3: Make Your Picks

Back in the bracket view, click a team card to select the winner of that matchup. The winning team advances to the next round's slot automatically.

A few things to know:
- **Cascading invalidation:** If you change a pick in an earlier round, any downstream picks involving the previously selected team are automatically cleared. This prevents impossible brackets.
- **Work through one round at a time.** Starting with the Round of 64 gives you 32 picks to make before running your first simulation. You don't need to use the matchup view for every game — use it for the close calls, the games where the probabilities are near 50/50 or where you have specific knowledge.
- **Trust the numbers for blowouts, dig deeper for toss-ups.** When the model gives a team 85%+, clicking them without further analysis is usually fine. When the model says 52/48, that's your signal to open the matchup view and look at the matchup-specific data.

### Step 4: Adjust Per-Matchup Overrides (When Needed)

For games where you have specific information the model doesn't capture, open the matchup view and scroll to the **Per-Matchup Override Panel**. Five sections let you fine-tune:

**Injury / Availability** (range: -5 to 0 per team)
Adjust downward for missing players. Calibration: role player = -0.5 to -1.0, starter = -2.0 to -3.5, star player = -3.5 to -5.0.

**Recent Form / Momentum** (range: -5 to +5 per team)
Override for teams on hot streaks or skids. Calibration: hot streak = +1.0 to +3.0, skid = -1.0 to -3.0, complete collapse = ±3.0 to ±5.0.

**Rest / Schedule Density** (range: -3 to +3 per team)
Adjust for rest advantages or fatigue. Calibration: extra rest = +0.5 to +1.5, conference tournament finals = -0.5 to -1.5, heavy tournament load = -1.5 to -3.0.

**Bench Depth** (range: 0 to 2, lever weight)
Weight for bench depth advantage. Calibration: 0 = off, 0.5–1.0 = moderate emphasis, 1.5–2.0 = heavy emphasis.

**Pace Adjustment** (range: 0 to 2, lever weight)
Weight for pace mismatch impact on variance. Calibration: 0 = off, 0.5–1.0 = moderate, 1.5–2.0 = heavy.

All override changes are reflected immediately in the probability display. Matchups with active overrides show an **orange dot indicator** in the bracket view so you can track which games you've manually adjusted.

### Step 5: Run Your First Simulation

Once you've made picks through at least the first round, click **Run Simulation** in the header bar. Here's what happens:

1. The button shows **"Simulating... XX%"** with a progress bar as it runs 10,000 full-bracket simulations.
2. Each simulation plays out all 63 games from the Round of 64 through the National Championship, propagating your picks forward through each round.
3. When complete, the button briefly shows **"Done"** in green, then returns to idle.

**What the simulation adds beyond per-game probabilities:**

Before simulation, the probability percentages on team cards reflect pairwise win probabilities — how likely Team A is to beat Team B in a head-to-head matchup. This is computed directly from the ratings model.

After simulation, the probabilities become **path probabilities** — how likely each team is to reach each round, accounting for the fact that they have to beat every team on their path, and accounting for uncertainty about who those opponents will be. This is fundamentally different: a team might have a 70% chance in any single game but only a 15% chance of winning four straight games to make the Final Four.

Hover over any team card after simulation to see its **path probability** (chance of advancing past this round) and **championship probability** (chance of winning it all).

### Step 6: Review Your Results

Click the **Results** button in the header bar to open the Simulation Results Overlay. It shows three panels:

- **Most Likely Champion** — The team with the highest probability of winning the National Championship, with their win percentage in large green text.
- **Top 10 Championship Contenders** — A ranked table showing each team's seed and championship probability with visual probability bars.
- **Upset Rates by Round** — How often upsets occurred across all simulations (useful for calibrating your upset selections).
- **Metadata** — Simulation count and execution time.

If you change any picks, levers, or overrides after running a simulation, a **stale results banner** appears: "Results may be outdated — re-run simulation to reflect your latest changes." The simulate button also changes to **"Re-run Simulation"** with an amber warning dot.

### Step 7: Check the Guidance Panel

Click **Guidance** (or **Guide** on mobile) to open the Guidance Panel. This surfaces proactive warnings and insights based on your current bracket:

- **⚠ Upset Volume Warning** — Flags if you've selected more first-round upsets than is historically typical (~4 per year), noting the compounding risk.
- **⚖ Chalk Concentration Warning** — Flags if your bracket is heavily correlated with consensus picks, which hurts differentiation in large pools.
- **↔ Variance Mismatch** — Flags high-variance teams (heavy 3-point shooting, fast pace) picked to advance deep, noting fragility.
- **⚡ Lever Conflict** — Flags when your lever weights contradict your picks (e.g., high experience weight but picking a freshman-heavy team).
- **⬆ Recency Divergence** — Flags teams whose recent form significantly diverges from season-long ratings — a signal worth investigating.
- **⏱ Tempo Explanation** — Contextual note when slow-paced underdogs are involved, explaining how pace compression affects upset probability.

Each message shows a **severity level** (HIGH in red, WARN in amber, INFO in blue) and can be individually dismissed. A count badge on the button shows how many active messages exist. You can show dismissed messages again if needed.

All guidance is informational — you always have final control over your picks.

### Step 8: Adjust Global Levers (If Needed)

Click **Levers** in the header bar to open the lever drawer. This is where you express a broader opinion about what matters in this year's tournament.

**Most users should build their bracket first with default lever settings, run a simulation, and then consider adjustments.** Think of global levers as a philosophy statement — you're telling the model what you believe matters more or less than the baseline configuration.

The lever drawer has six collapsible sections:

1. **Composite Weights** — Adjust the relative weight of KenPom, Torvik, and Evan Miya ratings. Weights auto-normalize to sum to 1.0. If you trust one system's methodology more, increase its weight.

2. **Four Factors** — Eight sliders: offense and defense versions of Effective FG%, Turnover Rate, Offensive Rebound Rate, and Free Throw Rate. These affect the *mean* win probability. Higher weight = that factor matters more in determining who wins.

3. **Experience & Coaching** — Roster experience, minutes continuity, coach tournament experience, and opponent adjustment. These also affect the mean probability. Increasing experience weight benefits veteran-heavy teams.

4. **Location & Travel** — Site proximity weight. Higher values increase the advantage for teams playing closer to their campus.

5. **Schedule & Luck** — Strength of schedule and luck regression weights. SoS weight amplifies the benefit of playing a tougher schedule. Luck regression reduces the credit given to teams that benefited from statistical luck during the season.

6. **Variance** — Pace/tempo and three-point rate variance weights. These affect the *width* of the outcome distribution rather than the mean. Higher pace variance means fast-paced games have more unpredictable outcomes (favoring underdogs). Higher three-point variance means teams that live by the three will have more volatile results.

Use **Reset to Defaults** at the bottom to restore the baseline configuration.

**When should you adjust levers?**
- When you believe the model is systematically over- or under-valuing something (e.g., "Experience matters more this year because the field has several elite senior-led teams")
- When you want to run a "what if" scenario (e.g., "What if tempo matters twice as much?")
- After backtesting reveals that certain lever configurations are more predictive

### Step 9: Iterate

Bracket building is iterative. A typical workflow:

1. Pick through one round → Run simulation → Check results and guidance
2. Adjust picks based on what you learn → Pick the next round → Simulate again
3. If you have specific matchup knowledge, apply per-matchup overrides
4. Once your bracket is mostly complete, review guidance for any warnings you should address
5. Consider adjusting global levers if you have a thesis about what matters this year
6. Run a final simulation at higher count (50,000+) for your finished bracket
7. Save your bracket

### Saving Your Work

Click **Save** in the header bar to persist your bracket. Saved brackets include your picks, lever settings, overrides, and the latest simulation snapshot. You can save multiple named brackets to compare strategies.

---

## How the Probabilities Work

### Before Simulation: Pairwise Win Probability

Every matchup displays a win probability computed from the **composite rating model**. Here's how it works:

**Step 1: Composite Rating.** Three rating systems are blended into a single composite rating for each team:

- **KenPom Adjusted Efficiency Margin (AdjEM)** — Points scored minus points allowed per 100 possessions, adjusted for opponent strength
- **Torvik Adjusted Efficiency Margin (AdjEM)** — Similar methodology with different opponent adjustments
- **Evan Miya Bayesian Performance Rating (BPR)** — Bayesian approach that regresses toward priors, handling small sample sizes differently

The composite weight defaults to roughly equal but is configurable via the Composite Weights levers. The composite rating is: `composite = w₁ × KenPom + w₂ × Torvik + w₃ × EvanMiya` where the weights sum to 1.0.

**Step 2: Rating Differential.** For any matchup, the base differential is: `diff = compositeA - compositeB`. A positive differential means Team A is favored.

**Step 3: Lever Adjustments.** Each enabled lever applies an additive adjustment to the differential based on the data for both teams:

- **Mean adjustments** (Four Factors, experience, continuity, coaching, SoS, luck regression, site proximity) shift the differential up or down, moving the probability toward one team.
- **Variance adjustments** (pace, three-point rate) modify how spread out the outcome distribution is, which affects upset probability without changing who's favored.

The adjusted differential incorporates all lever contributions: `adjustedDiff = baseDiff + Σ(leverAdjustments)`.

**Step 4: Logistic Conversion.** The adjusted differential is converted to a win probability using a logistic function: `P(A wins) = 1 / (1 + e^(-K × adjustedDiff))` where K is the logistic scaling parameter. This produces a number between 0 and 1 — the win probability shown on team cards.

**What lever adjustments actually do, mathematically:**

When you increase a lever's weight (say, Roster Experience from 0.5 to 1.5), you're tripling the contribution of experience differences to the rating differential. If Team A has significantly more experience than Team B, a higher experience weight will push the differential further in Team A's favor, increasing their win probability. For variance levers (pace, three-point rate), higher weight widens the outcome distribution, which benefits the underdog — when outcomes are more random, the weaker team has a better chance.

### After Simulation: Path Probabilities

Running a simulation adds a fundamentally different layer of analysis. The Monte Carlo engine:

1. **Runs 10,000–100,000 independent bracket simulations.** Each simulation plays out all 63 games from Round of 64 through the National Championship.
2. **Each game outcome is sampled randomly** based on the win probability. If Team A has a 65% chance, they win in roughly 65% of simulations.
3. **Results propagate forward.** Later-round matchups depend on who won earlier, so the simulation captures the cascading uncertainty of a tournament bracket.
4. **Results are aggregated** across all simulations to produce path probabilities.

**Path probabilities vs. pairwise probabilities:** A team might have a 70% chance in each individual game, but their probability of winning four straight to make the Final Four is much lower (0.70⁴ ≈ 24%). Path probabilities capture this compounding effect and also account for uncertainty about future opponents.

**Performance:** The engine uses a fast matchup resolver (returning only the probability number, skipping diagnostic data construction) and a matchup cache (deduplicating repeated team pairings across simulations). With 64 teams, at most ~2,016 unique pairings exist, so the cache reduces millions of probability computations to Map lookups. This targets under 5 seconds for 50,000 simulations.

---

## Backtesting

### What It Does

The backtest page (`/backtest`) lets you run the probability model against historical tournament results (2008–2024) to evaluate how well calibrated the model is. This is valuable for two reasons: validating that the model produces reasonable probabilities, and finding lever configurations that have historically been more predictive.

### How to Use It

1. Navigate to `/backtest` from the app navigation.
2. **Select years** using the chip selector. The recommended split is:
   - **Training set (2008–2019):** Tune lever weights against these seasons.
   - **Test set (2021–2024):** Evaluate on these unseen seasons to guard against overfitting.
3. Optionally **adjust lever weights** in the Lever Tuning Panel on the left side. This uses the same lever structure as the main bracket, letting you test different configurations.
4. Click **Run Backtest** to evaluate. A loading overlay shows progress.

### Reading the Results

**Brier Score** is the primary metric — it measures how well your predicted probabilities match actual outcomes. The scale runs from 0 (perfect predictions) to 1 (maximally wrong). For reference:
- **Below 0.200:** Good calibration
- **0.200–0.250:** Decent
- **Above 0.250:** Room for improvement

The Brier Score rewards calibrated confidence: saying "70%" when a team wins 70% of the time is better than saying "90%" even if the team usually wins.

**Model vs. Baseline** compares your model's Brier Score against a naive seed-only baseline (where win probability is assigned purely based on historical seed matchup outcomes). The **improvement percentage** shows how much better (or worse) the composite model performs vs. just using seeds.

**Brier Score Chart** shows the year-by-year comparison, making it easy to spot years where the model struggles or excels. Consistently beating the baseline means the model adds value beyond seed-based intuition.

**Calibration Plot** is a scatter plot where:
- X-axis = predicted probability
- Y-axis = actual win rate in that probability bin
- The diagonal line represents perfect calibration
- Points above the diagonal: the model was under-confident (teams won more often than predicted)
- Points below the diagonal: the model was over-confident (teams won less often than predicted)
- Point size corresponds to the number of predictions in each bin, so larger dots represent more data

**Results Table** provides a per-year breakdown with game counts, Brier Scores, and improvement percentages.

### Train vs. Test: Why It Matters

If you tune lever weights to minimize Brier Score on the training set (2008–2019), the model will naturally perform well on those years — it's been "fitted" to them. The test set (2021–2024) tells you whether that configuration generalizes to unseen tournaments. If performance drops dramatically on the test set, you've likely overfit.

A good sign is when the lever configuration that works best on the training set also performs reasonably well on the test set.

### The 2021 Anomaly

The 2021 tournament was played entirely in Indianapolis due to COVID-19 — all games at neutral-site venues in one city. This eliminated home-crowd effects, travel fatigue, and site proximity advantages. The 2021 results are flagged as anomalous because they may not reflect normal tournament dynamics. Consider the 2021 results separately when evaluating model performance.

---

## FAQ

**Q: How often is the data updated?**
A: Team data is loaded from end-of-regular-season snapshots and is not updated mid-tournament. This is intentional — the model evaluates what teams looked like over the full season rather than reacting to tournament noise.

**Q: Can I save multiple brackets?**
A: Yes. Sign in to save and load named bracket configurations. Each saved bracket preserves your picks, lever settings, overrides, and simulation snapshot.

**Q: How many simulations should I run?**
A: 10,000 is fast and good for exploration while you're iterating on your bracket. Use 50,000 or 100,000 for your final bracket to get more stable path probabilities. More simulations narrow the variance of the estimates.

**Q: Do I need to adjust levers?**
A: No. The default lever configuration is designed to be reasonable out of the box. Levers are there for users who have a specific thesis about what matters in a given year's tournament, or who want to explore how different assumptions change the bracket.

**Q: When should I use per-matchup overrides vs. global levers?**
A: Use **global levers** when you believe a factor is systematically more or less important across all games (e.g., "Experience matters more this year"). Use **per-matchup overrides** when you have game-specific knowledge the model can't capture (e.g., a key player is injured, a team is on a 10-game winning streak, or a team is playing a de facto home game).

**Q: What does the ownership badge mean?**
A: The ownership badge shows an estimated percentage of contest participants who will pick that team to advance. It's derived from seed position, round depth, conference profile, and rating strength. In large pools, picking a low-ownership team that wins is more valuable than picking a high-ownership team that wins, because fewer competitors benefit from the same pick.

**Q: What is the leverage score?**
A: Leverage = win probability ÷ ownership. A score of 1.5× means the team's win probability is 50% higher than their public ownership — they're under-valued by the field. Scores above 1.0× indicate contrarian value (green), below 1.0× indicate over-ownership (amber). The leverage score is the key input for the edge analysis system.

**Q: When do edge callouts appear?**
A: Edge callouts appear when three conditions are met: (1) the underdog has higher leverage than the favorite, (2) the underdog's win probability exceeds a minimum floor for your pool size, and (3) the leverage exceeds a round-adjusted threshold. Later rounds have lower thresholds because differentiation there is more impactful. In small pools, edges are suppressed because raw probability maximization is the optimal strategy.

**Q: Can I enter my own ownership numbers?**
A: Yes. In the matchup view, click "Override" next to the ownership bar. Enter the actual ownership percentage from your contest platform (ESPN, Yahoo, etc.) and click "Save." Custom ownership shows a "CUSTOM" badge. Click "Reset" to return to the model's estimate. Ownership overrides only affect strategy recommendations — they don't change win probabilities or simulation results.

**Q: Why did my downstream picks disappear?**
A: Cascading invalidation. If you change a pick in an earlier round, any later-round picks that depended on the old winner are automatically cleared. This prevents impossible brackets where a team advances past a round they lost in.

**Q: Is this free?**
A: The app is free to use. AI narrative generation is powered by Claude and requires an API key configured by the administrator.

---

## Glossary

| Term             | Definition                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| AdjEM            | Adjusted Efficiency Margin — points scored/allowed per 100 possessions, adjusted for opponent strength |
| BPR              | Bayesian Performance Rating (Evan Miya) — rating system that regresses toward Bayesian priors          |
| Brier Score      | Metric for evaluating probability calibration — lower is better (0 = perfect, 1 = worst)               |
| Calibration      | How well predicted probabilities match actual observed win rates across many games                      |
| Composite Rating | Weighted blend of KenPom, Torvik, and Evan Miya ratings into a single team strength number             |
| Four Factors     | Dean Oliver's four key basketball stats: eFG%, TO%, ORB%, FTR                                          |
| Log5 / Logistic  | Method for converting a rating differential into a win probability using the logistic function          |
| Monte Carlo      | Simulation technique that runs thousands of random trials to estimate probabilities                    |
| Leverage Score   | Win probability divided by ownership — values above 1.0 indicate the team is under-owned (contrarian value) |
| Ownership        | Estimated percentage of contest participants picking a given team to advance                            |
| Path Probability | Probability of a team reaching a specific round, accounting for all games on their path                |
| Pairwise Prob.   | Probability of one team beating another in a single head-to-head game                                  |
| Variance Lever   | A lever that affects the width of the outcome distribution rather than the mean (pace, 3-point rate)   |
