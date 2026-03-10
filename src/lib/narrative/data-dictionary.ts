/**
 * Data dictionary for the AI matchup narrative prompt.
 *
 * Provides plain-language explanations for every stat field,
 * their baselines, and interaction effects the model should look for.
 * This is injected into the system message so the AI knows how to
 * interpret and synthesize the structured data.
 */

export const DATA_DICTIONARY = `## Data Dictionary

### Efficiency Ratings
All efficiency metrics are per-100-possessions, adjusted for opponent strength (schedule-adjusted).

- **AdjOE** (Adjusted Offensive Efficiency): Points scored per 100 possessions. D-1 average ≈ 100.0. Elite offenses are 115+.
- **AdjDE** (Adjusted Defensive Efficiency): Points allowed per 100 possessions. Lower is better. D-1 average ≈ 100.0. Elite defenses are below 90.
- **AdjEM** (Adjusted Efficiency Margin): AdjOE minus AdjDE. The single best predictor of team quality. D-1 average = 0. Top-10 teams are +20 or better.
- **BPR** (Bayesian Performance Rating): Evan Miya's adjusted efficiency metric. Comparable to AdjEM in interpretation.

Multiple ratings (KenPom, Torvik, Evan Miya) are blended into a composite with configurable weights.

### Four Factors (Dean Oliver)
The four most important statistical categories for predicting wins. Each has an offensive and defensive version.

- **eFG%** (Effective FG%): Field goal percentage adjusted for the extra value of threes. Formula: (FGM + 0.5 × 3PM) / FGA. D-1 avg offense ≈ 50%. Elite: 54%+. Lower is better for defense.
- **TO%** (Turnover Rate): Turnovers per possession. D-1 avg ≈ 19%. Lower is better for offense, higher is better for defense. Key interaction: high TO% offense vs. high TO%-forcing defense compounds the effect.
- **ORB%** (Offensive Rebound Rate): Percentage of available offensive rebounds grabbed. D-1 avg ≈ 28%. Higher is better for offense. Key interaction: good ORB% can compensate for poor shooting.
- **FT Rate** (Free Throw Rate): FTA/FGA ratio. Measures ability to get to the foul line. D-1 avg ≈ 32%. Higher is better for offense. Key interaction: aggressive drivers + poor defensive discipline = lots of free throws.

### Shooting
- **3PT%**: Three-point field goal percentage. D-1 avg ≈ 34%. Elite: 37%+. High variance metric — can shift significantly game to game.
- **3PT Rate** (3PA/FGA): Share of shots taken from three. Measures reliance on the three-pointer. D-1 avg ≈ 38%. Higher rate → more volatile outcomes. Key interaction: high 3PT rate + average 3PT% = boom/bust team.
- **FT%**: Free throw percentage. D-1 avg ≈ 71%. Important in close games and high-foul-rate matchups.
- **Def 3PT%**: Opponent three-point percentage allowed. Lower is better. Somewhat luck-dependent over small samples but meaningful over a full season.
- **Def 3PT Rate**: Opponent three-point attempt rate. Lower means the defense forces teams inside. Higher means the defense concedes open threes.

### Tempo & Pace
- **Adj Tempo**: Possessions per 40 minutes, adjusted for opponent. D-1 avg ≈ 68. Fast teams: 72+. Slow teams: <64.
  - **Key interaction with variance**: Slower pace → fewer possessions → less mean-reversion within a game → tighter outcome distribution → favors the underdog in a mismatch. Fast pace → more possessions → outcomes regress to true talent → favors the better team.
- **Avg Poss Length (Off/Def)**: Average possession length in seconds. Longer = more deliberate, shorter = transition-heavy.

### Roster & Experience
- **Experience**: Minutes-weighted years of D-1 experience. D-1 avg ≈ 2.0 years. Tournament-tested lineups: 2.5+. Young teams: <1.5. Historical edge in March: about 0.75 efficiency points per year of experience.
- **Minutes Continuity**: Percentage of minutes returning from prior season. D-1 avg ≈ 55%. High continuity: 70%+. New rosters: <40%. Indicates how well-established rotations and chemistry are.
- **Bench Minutes %**: Share of minutes played by non-starters. D-1 avg ≈ 30%. Deep benches: 35%+. Star-dependent: <25%. Relevant for foul trouble resilience and second-half endurance.
- **Avg Height**: Average player height in inches. Taller teams have advantages in rebounding and interior scoring. Key interaction: height + ORB% alignment (or mismatch).

### Coaching & Style
- **2-Foul Participation**: Rate at which a coach keeps a player with 2 fouls in the game (vs. benching until halftime). Range: 0-1. Higher = more aggressive foul management. Can indicate coaching confidence and willingness to accept risk.
- **Coach Tournament Record**: Wins/Games in the NCAA tournament. Indicates experience with tournament-specific pressure, adjustments, and short-preparation matchups.
- **Final Fours / Championships**: Elite postseason pedigree. Coaches with F4 experience have demonstrated the ability to prepare teams for neutral-site, one-and-done pressure.

### Evan Miya Metrics
- **Opponent Adjustment**: Measures how a team's performance scales relative to competition level. Positive = team "plays up" against strong opponents (overperforms vs. quality). Negative = team "plays down" (underperforms vs. weaker opponents). A high seed with strong opponent adjust is less upset-prone in early rounds. A high seed with negative opponent adjust is more vulnerable to upsets than ratings suggest.
- **Pace Adjustment**: How a team performs in faster vs. slower games relative to their typical pace. Positive = better in faster games. Key interaction: when two teams with a tempo mismatch meet, the team with pace adjustment aligned to the expected game pace has an edge.
- **Kill Shots (10-0 Runs)**: Number of 10-0 scoring runs a team produces (and allows) per game. Teams with high kill shots per game are "closers" — they can manufacture decisive momentum swings. High kill shots allowed indicates vulnerability to opponent runs. Kill shots margin (made minus allowed) is a proxy for composure and ability to control game flow. Key interaction: high kill shot margin in a close game makes a team more dangerous as they can flip momentum when it matters.

### Matchup Context
- **Win Probability**: Output of the composite model after all lever adjustments. Range: 0-1.
- **Point Spread**: Estimated margin of victory derived from the adjusted rating differential. Negative = Team A favored.
- **Variance Multipliers**: Tempo and 3PT rate effects on outcome distribution width. >1.0 = wider distribution (more volatile), <1.0 = narrower (more predictable).

### Per-Matchup Overrides
- **Injury Adjustment**: Manual efficiency point deduction for roster availability issues. Range: -10 to 0.
- **Site Proximity**: Distance-based advantage. Buckets: true_home (+3.0), regional_advantage (+1.5), neutral (0), moderate_travel (-0.5), significant_travel (-1.0).
- **Recent Form**: Manual override for momentum/trajectory. Range: -5.0 to +5.0 efficiency points.
- **Rest Adjustment**: Days of rest / schedule density. Range: -3.0 to +3.0 efficiency points.

### Interaction Effects to Watch For
1. **Slow pace + defensive mismatch**: When a slow-paced team faces a superior opponent, the reduced possessions compress the outcome distribution, making upsets more likely.
2. **High 3PT rate + average shooting**: Teams heavily reliant on threes with merely average percentages are boom/bust. They can beat anyone on a hot night or lose to anyone when cold.
3. **Experience + high-pressure round**: Experience advantages compound in later rounds where pressure and preparation time are factors.
4. **Rebounding dominance + poor shooting**: A team that shoots poorly but dominates the offensive glass gets more second chances, partially compensating for shooting woes.
5. **Coach tournament pedigree + short prep**: Coaches with extensive tournament experience may have edges in the 1-2 day preparation windows between tournament games.
6. **FT rate mismatch + aggressive play**: When one team gets to the line frequently against a defense that fouls a lot, free throws become a significant scoring channel.
7. **Opponent adjust + seed mismatch**: A high seed with negative opponent adjustment is more vulnerable to upsets than raw ratings suggest — they may not elevate their play against a motivated underdog.
8. **Kill shots + close game projection**: When the model projects a close game (spread < 5), teams with high kill shot margins have a meaningful edge — they can manufacture the decisive run that flips the outcome.
`;
