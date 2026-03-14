import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "User Guide",
  description:
    "Learn how to use BracketLab — bracket building, Monte Carlo simulation, levers, AI analysis, and more.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="guide-section">
      <h2 className="guide-h2">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="guide-subsection">
      <h3 className="guide-h3">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GuidePage() {
  return (
    <main id="main-content" className="guide-page">
      {/* Header */}
      <div className="guide-header">
        <h1 className="guide-title">User Guide</h1>
        <p className="guide-subtitle">
          Everything you need to build smarter brackets with BracketLab.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="guide-toc" aria-label="Table of contents">
        <h2 className="guide-toc__title">Contents</h2>
        <ol className="guide-toc__list">
          <li><a href="#getting-started">Getting Started</a></li>
          <li><a href="#walkthrough">Building Your Bracket: A Complete Walkthrough</a></li>
          <li><a href="#probabilities">How the Probabilities Work</a></li>
          <li><a href="#backtesting">Backtesting</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#glossary">Glossary</a></li>
        </ol>
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Getting Started */}
      {/* ----------------------------------------------------------------- */}
      <Section id="getting-started" title="Getting Started">
        <SubSection title="Creating an Account">
          <ol className="guide-ol">
            <li>Click <strong>Sign Up</strong> in the navigation bar.</li>
            <li>Enter your email and create a password, or use a social login provider (Google, GitHub).</li>
            <li>If using email, check your inbox for a confirmation link and click it to activate your account.</li>
            <li>Once signed in, you can save brackets, customize lever configurations, and generate AI narratives.</li>
          </ol>
        </SubSection>

        <SubSection title="Setting Up Your Contest">
          <p>
            When you first open the bracket view, you&rsquo;ll see a <strong>pool size dropdown</strong> in
            the header bar. Select the option that matches your contest:
          </p>
          <div className="guide-table-wrap">
            <table className="guide-table">
              <thead>
                <tr>
                  <th>Pool Size</th>
                  <th>Strategy</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Small (&le;20)</td><td>Focus on picking the most probable outcomes</td></tr>
                <tr><td>Medium (50&ndash;200)</td><td>Mix chalk with 1&ndash;2 strategic contrarian picks</td></tr>
                <tr><td>Large (500+)</td><td>Champion pick ownership becomes critical</td></tr>
                <tr><td>Very Large (100K+)</td><td>Optimize for low-ownership paths</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            This choice shapes how the app generates recommendations &mdash; from AI narrative
            advice to guidance panel warnings. You can change it anytime.
          </p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Building Your Bracket: A Complete Walkthrough */}
      {/* ----------------------------------------------------------------- */}
      <Section id="walkthrough" title="Building Your Bracket: A Complete Walkthrough">
        <p>
          This section walks through the process of building a bracket from start to finish,
          in the order that makes the most sense.
        </p>

        {/* Step 1 */}
        <SubSection title="Step 1: Browse the Bracket">
          <p>When you first arrive, you&rsquo;ll see the full 64-team bracket laid out across the screen:</p>
          <ul className="guide-ul">
            <li><strong>Left side:</strong> East region (top) and South region (bottom), reading left to right</li>
            <li><strong>Center:</strong> Final Four and National Championship</li>
            <li><strong>Right side:</strong> West region (top) and Midwest region (bottom), reading right to left</li>
            <li><strong>On mobile:</strong> A tabbed view lets you browse one region at a time (East, West, South, Midwest, Final 4)</li>
          </ul>
          <p>Each team card shows:</p>
          <ul className="guide-ul">
            <li><strong>Seed badge</strong> &mdash; Color-coded: blue for 1&ndash;4, indigo for 5&ndash;8, amber for 9&ndash;12, gray for 13&ndash;16</li>
            <li><strong>Team name</strong></li>
            <li><strong>Win probability</strong> for that specific game (e.g., &ldquo;72%&rdquo;), computed from the composite rating model</li>
            <li><strong>Probability bar</strong> &mdash; A visual representation of the win probability</li>
            <li>
              <strong>Ownership badge</strong> &mdash; Estimated public pick percentage, color-coded:
              <ul className="guide-ul guide-ul--nested">
                <li><strong>Amber (&ge;60%):</strong> Over-owned chalk &mdash; most people are picking this team</li>
                <li><strong>Gray (30&ndash;59%):</strong> Neutral ownership</li>
                <li><strong>Green (&lt;30%):</strong> Contrarian value &mdash; fewer people are picking this team</li>
              </ul>
            </li>
          </ul>
          <p>
            Before you do anything else, spend a minute scanning the bracket. The probabilities
            and ownership badges are already telling you a story &mdash; where the model sees
            value, and where the public disagrees.
          </p>
        </SubSection>

        {/* Step 2 */}
        <SubSection title="Step 2: Dive Into a Matchup">
          <p>
            Click any matchup to open the <strong>Matchup View</strong> &mdash; a full-screen
            deep dive into that game. This is your film room. Here&rsquo;s what you&rsquo;ll find:
          </p>
          <p>
            <strong>Probability Display</strong> at the top shows the win probability for each team
            in large type, along with an estimated point spread. Below that, a breakdown table shows
            exactly how each factor contributes to the probability &mdash; composite ratings, four
            factors, experience, pace effects, and any overrides you&rsquo;ve applied.
          </p>
          <p><strong>Team Profile Cards</strong> sit side by side, each showing:</p>
          <ul className="guide-ul">
            <li>Efficiency ratings (offensive, defensive, and adjusted) from all three rating systems</li>
            <li>Four Factors: Effective FG%, Turnover Rate, Offensive Rebound Rate, Free Throw Rate</li>
            <li>Shooting splits (3P%, 2P%, FT%)</li>
            <li>Tempo, roster experience, minutes continuity, average height, bench minutes, and coaching data</li>
          </ul>
          <p>
            <strong>Stat Comparison</strong> shows 15+ metrics grouped by category with advantage
            coloring &mdash; green highlights which team leads in each stat, so you can quickly
            see where each team has an edge.
          </p>
          <p>
            <strong>Distribution Chart</strong> shows a histogram of simulated margin-of-victory
            outcomes, split at zero. The shape tells you about variance: a tall, narrow distribution
            means predictable outcomes; a wide, flat distribution means anything could happen.
          </p>
          <p>
            <strong>AI Narrative Analysis</strong> (click &ldquo;Generate Analysis&rdquo;) produces a
            Claude-powered plain-language game breakdown. It covers the rating profile, stylistic
            matchup, key factors, how the game might play out, and closes with a recommendation
            that factors in your pool size. Narratives stream in real time, are cached per matchup,
            and are rate-limited to 10 per minute.
          </p>
          <p>
            <strong>Ownership Explainer</strong> (click &ldquo;How is ownership estimated?&rdquo;)
            reveals the four-factor methodology: seed baseline, round decay (&times;0.85 per round),
            conference profile (+4 percentage points for power conferences), and rating strength
            adjustment (&plusmn;5 points based on over/underperformance vs. seed expectation).
          </p>
          <p>
            Use the matchup view to understand <em>why</em> the model favors one team, and to
            decide whether you agree. Press <strong>Escape</strong> or click <strong>Back to
            Bracket</strong> to return.
          </p>
        </SubSection>

        {/* Step 3 */}
        <SubSection title="Step 3: Make Your Picks">
          <p>
            Back in the bracket view, click a team card to select the winner of that matchup.
            The winning team advances to the next round&rsquo;s slot automatically.
          </p>
          <p>A few things to know:</p>
          <ul className="guide-ul">
            <li>
              <strong>Cascading invalidation:</strong> If you change a pick in an earlier round,
              any downstream picks involving the previously selected team are automatically cleared.
              This prevents impossible brackets.
            </li>
            <li>
              <strong>Work through one round at a time.</strong> Starting with the Round of 64
              gives you 32 picks to make before running your first simulation. You don&rsquo;t
              need to use the matchup view for every game &mdash; use it for the close calls,
              the games where the probabilities are near 50/50 or where you have specific knowledge.
            </li>
            <li>
              <strong>Trust the numbers for blowouts, dig deeper for toss-ups.</strong> When the
              model gives a team 85%+, clicking them without further analysis is usually fine.
              When the model says 52/48, that&rsquo;s your signal to open the matchup view and
              look at the matchup-specific data.
            </li>
          </ul>
        </SubSection>

        {/* Step 4 */}
        <SubSection title="Step 4: Adjust Per-Matchup Overrides (When Needed)">
          <p>
            For games where you have specific information the model doesn&rsquo;t capture, open
            the matchup view and scroll to the <strong>Per-Matchup Override Panel</strong>. Five
            sections let you fine-tune:
          </p>
          <p>
            <strong>Injury / Availability</strong> (range: -5 to 0 per team)<br />
            Adjust downward for missing players. Calibration: role player = -0.5 to -1.0,
            starter = -2.0 to -3.5, star player = -3.5 to -5.0.
          </p>
          <p>
            <strong>Recent Form / Momentum</strong> (range: -5 to +5 per team)<br />
            Override for teams on hot streaks or skids. Calibration: hot streak = +1.0 to +3.0,
            skid = -1.0 to -3.0, complete collapse = &plusmn;3.0 to &plusmn;5.0.
          </p>
          <p>
            <strong>Rest / Schedule Density</strong> (range: -3 to +3 per team)<br />
            Adjust for rest advantages or fatigue. Calibration: extra rest = +0.5 to +1.5,
            conference tournament finals = -0.5 to -1.5, heavy tournament load = -1.5 to -3.0.
          </p>
          <p>
            <strong>Bench Depth</strong> (range: 0 to 2, lever weight)<br />
            Weight for bench depth advantage. Calibration: 0 = off, 0.5&ndash;1.0 = moderate
            emphasis, 1.5&ndash;2.0 = heavy emphasis.
          </p>
          <p>
            <strong>Pace Adjustment</strong> (range: 0 to 2, lever weight)<br />
            Weight for pace mismatch impact on variance. Calibration: 0 = off,
            0.5&ndash;1.0 = moderate, 1.5&ndash;2.0 = heavy.
          </p>
          <p>
            All override changes are reflected immediately in the probability display. Matchups
            with active overrides show an <strong>orange dot indicator</strong> in the bracket
            view so you can track which games you&rsquo;ve manually adjusted.
          </p>
        </SubSection>

        {/* Step 5 */}
        <SubSection title="Step 5: Run Your First Simulation">
          <p>
            Once you&rsquo;ve made picks through at least the first round, click <strong>Run
            Simulation</strong> in the header bar. Here&rsquo;s what happens:
          </p>
          <ol className="guide-ol">
            <li>
              The button shows <strong>&ldquo;Simulating... XX%&rdquo;</strong> with a progress
              bar as it runs 10,000 full-bracket simulations.
            </li>
            <li>
              Each simulation plays out all 63 games from the Round of 64 through the National
              Championship, propagating results forward through each round.
            </li>
            <li>
              When complete, the button briefly shows <strong>&ldquo;Done&rdquo;</strong> in green,
              then returns to idle.
            </li>
          </ol>
          <p><strong>What the simulation adds beyond per-game probabilities:</strong></p>
          <p>
            Before simulation, the probability percentages on team cards reflect pairwise win
            probabilities &mdash; how likely Team A is to beat Team B in a head-to-head matchup.
            This is computed directly from the ratings model.
          </p>
          <p>
            After simulation, the probabilities become <strong>path probabilities</strong> &mdash;
            how likely each team is to reach each round, accounting for the fact that they have to
            beat every team on their path, and accounting for uncertainty about who those opponents
            will be. This is fundamentally different: a team might have a 70% chance in any single
            game but only a 15% chance of winning four straight games to make the Final Four.
          </p>
          <p>
            Hover over any team card after simulation to see its <strong>path probability</strong>{" "}
            (chance of advancing past this round) and <strong>championship probability</strong>{" "}
            (chance of winning it all).
          </p>
        </SubSection>

        {/* Step 6 */}
        <SubSection title="Step 6: Review Your Results">
          <p>
            Click the <strong>Results</strong> button in the header bar to open the Simulation
            Results Overlay. It shows:
          </p>
          <ul className="guide-ul">
            <li>
              <strong>Most Likely Champion</strong> &mdash; The team with the highest probability
              of winning the National Championship, with their win percentage in large green text.
            </li>
            <li>
              <strong>Top 10 Championship Contenders</strong> &mdash; A ranked table showing each
              team&rsquo;s seed and championship probability with visual probability bars.
            </li>
            <li>
              <strong>Upset Rates by Round</strong> &mdash; How often upsets occurred across all
              simulations (useful for calibrating your upset selections).
            </li>
            <li><strong>Metadata</strong> &mdash; Simulation count and execution time.</li>
          </ul>
          <p>
            If you change any picks, levers, or overrides after running a simulation, a{" "}
            <strong>stale results banner</strong> appears: &ldquo;Results may be outdated &mdash;
            re-run simulation to reflect your latest changes.&rdquo; The simulate button also
            changes to <strong>&ldquo;Re-run Simulation&rdquo;</strong> with an amber warning dot.
          </p>
        </SubSection>

        {/* Step 7 */}
        <SubSection title="Step 7: Check the Guidance Panel">
          <p>
            Click <strong>Guidance</strong> (or <strong>Guide</strong> on mobile) to open the
            Guidance Panel. This surfaces proactive warnings and insights based on your current bracket:
          </p>
          <ul className="guide-ul">
            <li>
              <strong>&#x26A0; Upset Volume Warning</strong> &mdash; Flags if you&rsquo;ve selected
              more first-round upsets than is historically typical (~4 per year), noting the
              compounding risk.
            </li>
            <li>
              <strong>&#x2696; Chalk Concentration Warning</strong> &mdash; Flags if your bracket
              is heavily correlated with consensus picks, which hurts differentiation in large pools.
            </li>
            <li>
              <strong>&#x2194; Variance Mismatch</strong> &mdash; Flags high-variance teams (heavy
              3-point shooting, fast pace) picked to advance deep, noting fragility.
            </li>
            <li>
              <strong>&#x26A1; Lever Conflict</strong> &mdash; Flags when your lever weights
              contradict your picks (e.g., high experience weight but picking a freshman-heavy team).
            </li>
            <li>
              <strong>&#x2B06; Recency Divergence</strong> &mdash; Flags teams whose recent form
              significantly diverges from season-long ratings &mdash; a signal worth investigating.
            </li>
            <li>
              <strong>&#x23F1; Tempo Explanation</strong> &mdash; Contextual note when slow-paced
              underdogs are involved, explaining how pace compression affects upset probability.
            </li>
          </ul>
          <p>
            Each message shows a <strong>severity level</strong> (HIGH in red, WARN in amber,
            INFO in blue) and can be individually dismissed. A count badge on the button shows
            how many active messages exist. You can show dismissed messages again if needed.
          </p>
          <p>All guidance is informational &mdash; you always have final control over your picks.</p>
        </SubSection>

        {/* Step 8 */}
        <SubSection title="Step 8: Adjust Global Levers (If Needed)">
          <p>
            Click <strong>Levers</strong> in the header bar to open the lever drawer. This is where
            you express a broader opinion about what matters in this year&rsquo;s tournament.
          </p>
          <p>
            <strong>
              Most users should build their bracket first with default lever settings, run a
              simulation, and then consider adjustments.
            </strong>{" "}
            Think of global levers as a philosophy statement &mdash; you&rsquo;re telling the model
            what you believe matters more or less than the baseline configuration.
          </p>
          <p>The lever drawer has six collapsible sections:</p>
          <ol className="guide-ol">
            <li>
              <strong>Composite Weights</strong> &mdash; Adjust the relative weight of KenPom,
              Torvik, and Evan Miya ratings. Weights auto-normalize to sum to 1.0. If you trust
              one system&rsquo;s methodology more, increase its weight.
            </li>
            <li>
              <strong>Four Factors</strong> &mdash; Eight sliders: offense and defense versions of
              Effective FG%, Turnover Rate, Offensive Rebound Rate, and Free Throw Rate. These
              affect the <em>mean</em> win probability. Higher weight = that factor matters more
              in determining who wins.
            </li>
            <li>
              <strong>Experience &amp; Coaching</strong> &mdash; Roster experience, minutes
              continuity, coach tournament experience, and opponent adjustment. These also affect
              the mean probability. Increasing experience weight benefits veteran-heavy teams.
            </li>
            <li>
              <strong>Location &amp; Travel</strong> &mdash; Site proximity weight. Higher values
              increase the advantage for teams playing closer to their campus.
            </li>
            <li>
              <strong>Schedule &amp; Luck</strong> &mdash; Strength of schedule and luck regression
              weights. SoS weight amplifies the benefit of playing a tougher schedule. Luck
              regression reduces the credit given to teams that benefited from statistical luck
              during the season.
            </li>
            <li>
              <strong>Variance</strong> &mdash; Pace/tempo and three-point rate variance weights.
              These affect the <em>width</em> of the outcome distribution rather than the mean.
              Higher pace variance means fast-paced games have more unpredictable outcomes (favoring
              underdogs). Higher three-point variance means teams that live by the three will have
              more volatile results.
            </li>
          </ol>
          <p>
            Use <strong>Reset to Defaults</strong> at the bottom to restore the baseline configuration.
          </p>
          <p><strong>When should you adjust levers?</strong></p>
          <ul className="guide-ul">
            <li>
              When you believe the model is systematically over- or under-valuing something (e.g.,
              &ldquo;Experience matters more this year because the field has several elite
              senior-led teams&rdquo;)
            </li>
            <li>
              When you want to run a &ldquo;what if&rdquo; scenario (e.g., &ldquo;What if tempo
              matters twice as much?&rdquo;)
            </li>
            <li>After backtesting reveals that certain lever configurations are more predictive</li>
          </ul>
        </SubSection>

        {/* Step 9 */}
        <SubSection title="Step 9: Iterate">
          <p>Bracket building is iterative. A typical workflow:</p>
          <ol className="guide-ol">
            <li>Pick through one round &rarr; Run simulation &rarr; Check results and guidance</li>
            <li>Adjust picks based on what you learn &rarr; Pick the next round &rarr; Simulate again</li>
            <li>If you have specific matchup knowledge, apply per-matchup overrides</li>
            <li>Once your bracket is mostly complete, review guidance for any warnings you should address</li>
            <li>Consider adjusting global levers if you have a thesis about what matters this year</li>
            <li>Run a final simulation at higher count (50,000+) for your finished bracket</li>
            <li>Save your bracket</li>
          </ol>
        </SubSection>

        {/* Saving */}
        <SubSection title="Saving Your Work">
          <p>
            Click <strong>Save</strong> in the header bar to persist your bracket. Saved brackets
            include your picks, lever settings, overrides, and the latest simulation snapshot.
            You can save multiple named brackets to compare strategies.
          </p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* How the Probabilities Work */}
      {/* ----------------------------------------------------------------- */}
      <Section id="probabilities" title="How the Probabilities Work">
        <SubSection title="Before Simulation: Pairwise Win Probability">
          <p>
            Every matchup displays a win probability computed from the <strong>composite
            rating model</strong>. Here&rsquo;s how it works:
          </p>
          <p>
            <strong>Step 1: Composite Rating.</strong> Three rating systems are blended into a
            single composite rating for each team:
          </p>
          <ul className="guide-ul">
            <li>
              <strong>KenPom Adjusted Efficiency Margin (AdjEM)</strong> &mdash; Points scored
              minus points allowed per 100 possessions, adjusted for opponent strength
            </li>
            <li>
              <strong>Torvik Adjusted Efficiency Margin (AdjEM)</strong> &mdash; Similar methodology
              with different opponent adjustments
            </li>
            <li>
              <strong>Evan Miya Bayesian Performance Rating (BPR)</strong> &mdash; Bayesian
              approach that regresses toward priors, handling small sample sizes differently
            </li>
          </ul>
          <p>
            The composite weight defaults to roughly equal but is configurable via the Composite
            Weights levers. The composite rating is:{" "}
            <code>composite = w&#x2081; &times; KenPom + w&#x2082; &times; Torvik + w&#x2083; &times; EvanMiya</code>{" "}
            where the weights sum to 1.0.
          </p>
          <p>
            <strong>Step 2: Rating Differential.</strong> For any matchup, the base differential
            is: <code>diff = compositeA - compositeB</code>. A positive differential means Team A
            is favored.
          </p>
          <p>
            <strong>Step 3: Lever Adjustments.</strong> Each enabled lever applies an additive
            adjustment to the differential based on the data for both teams:
          </p>
          <ul className="guide-ul">
            <li>
              <strong>Mean adjustments</strong> (Four Factors, experience, continuity, coaching,
              SoS, luck regression, site proximity) shift the differential up or down, moving the
              probability toward one team.
            </li>
            <li>
              <strong>Variance adjustments</strong> (pace, three-point rate) modify how spread out
              the outcome distribution is, which affects upset probability without changing who&rsquo;s
              favored.
            </li>
          </ul>
          <p>
            The adjusted differential incorporates all lever contributions:{" "}
            <code>adjustedDiff = baseDiff + &Sigma;(leverAdjustments)</code>.
          </p>
          <p>
            <strong>Step 4: Logistic Conversion.</strong> The adjusted differential is converted
            to a win probability using a logistic function:{" "}
            <code>P(A wins) = 1 / (1 + e<sup>-K &times; adjustedDiff</sup>)</code>{" "}
            where K is the logistic scaling parameter. This produces a number between 0 and 1
            &mdash; the win probability shown on team cards.
          </p>
          <p><strong>What lever adjustments actually do, mathematically:</strong></p>
          <p>
            When you increase a lever&rsquo;s weight (say, Roster Experience from 0.5 to 1.5),
            you&rsquo;re tripling the contribution of experience differences to the rating
            differential. If Team A has significantly more experience than Team B, a higher
            experience weight will push the differential further in Team A&rsquo;s favor, increasing
            their win probability. For variance levers (pace, three-point rate), higher weight
            widens the outcome distribution, which benefits the underdog &mdash; when outcomes
            are more random, the weaker team has a better chance.
          </p>
        </SubSection>

        <SubSection title="After Simulation: Path Probabilities">
          <p>
            Running a simulation adds a fundamentally different layer of analysis. The Monte Carlo engine:
          </p>
          <ol className="guide-ol">
            <li>
              <strong>Runs 10,000&ndash;100,000 independent bracket simulations.</strong> Each
              simulation plays out all 63 games from Round of 64 through the National Championship.
            </li>
            <li>
              <strong>Each game outcome is sampled randomly</strong> based on the win probability.
              If Team A has a 65% chance, they win in roughly 65% of simulations.
            </li>
            <li>
              <strong>Results propagate forward.</strong> Later-round matchups depend on who won
              earlier, so the simulation captures the cascading uncertainty of a tournament bracket.
            </li>
            <li>
              <strong>Results are aggregated</strong> across all simulations to produce path
              probabilities.
            </li>
          </ol>
          <p>
            <strong>Path probabilities vs. pairwise probabilities:</strong> A team might have a
            70% chance in each individual game, but their probability of winning four straight to
            make the Final Four is much lower (0.70&#x2074; &asymp; 24%). Path probabilities
            capture this compounding effect and also account for uncertainty about future opponents.
          </p>
          <p>
            <strong>Performance:</strong> The engine uses a fast matchup resolver (returning only
            the probability number, skipping diagnostic data construction) and a matchup cache
            (deduplicating repeated team pairings across simulations). With 64 teams, at most
            ~2,016 unique pairings exist, so the cache reduces millions of probability
            computations to Map lookups. This targets under 5 seconds for 50,000 simulations.
          </p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Backtesting */}
      {/* ----------------------------------------------------------------- */}
      <Section id="backtesting" title="Backtesting">
        <SubSection title="What It Does">
          <p>
            The <Link href="/backtest">backtest page</Link> lets you run the probability model
            against historical tournament results (2008&ndash;2024) to evaluate how well calibrated
            the model is. This is valuable for two reasons: validating that the model produces
            reasonable probabilities, and finding lever configurations that have historically been
            more predictive.
          </p>
        </SubSection>

        <SubSection title="How to Use It">
          <ol className="guide-ol">
            <li>Navigate to <Link href="/backtest">Backtest</Link> from the app navigation.</li>
            <li>
              <strong>Select years</strong> using the chip selector. The recommended split is:
              <ul className="guide-ul guide-ul--nested">
                <li><strong>Training set (2008&ndash;2019):</strong> Tune lever weights against these seasons.</li>
                <li><strong>Test set (2021&ndash;2024):</strong> Evaluate on these unseen seasons to guard against overfitting.</li>
              </ul>
            </li>
            <li>Optionally <strong>adjust lever weights</strong> in the Lever Tuning Panel on the left side. This uses the same lever structure as the main bracket, letting you test different configurations.</li>
            <li>Click <strong>Run Backtest</strong> to evaluate. A loading overlay shows progress.</li>
          </ol>
        </SubSection>

        <SubSection title="Reading the Results">
          <p>
            <strong>Brier Score</strong> is the primary metric &mdash; it measures how well your
            predicted probabilities match actual outcomes. The scale runs from 0 (perfect
            predictions) to 1 (maximally wrong). For reference:
          </p>
          <ul className="guide-ul">
            <li><strong>Below 0.200:</strong> Good calibration</li>
            <li><strong>0.200&ndash;0.250:</strong> Decent</li>
            <li><strong>Above 0.250:</strong> Room for improvement</li>
          </ul>
          <p>
            The Brier Score rewards calibrated confidence: saying &ldquo;70%&rdquo; when a team
            wins 70% of the time is better than saying &ldquo;90%&rdquo; even if the team usually wins.
          </p>
          <p>
            <strong>Model vs. Baseline</strong> compares your model&rsquo;s Brier Score against
            a naive seed-only baseline (where win probability is assigned purely based on historical
            seed matchup outcomes). The <strong>improvement percentage</strong> shows how much
            better (or worse) the composite model performs vs. just using seeds.
          </p>
          <p>
            <strong>Brier Score Chart</strong> shows the year-by-year comparison, making it easy
            to spot years where the model struggles or excels. Consistently beating the baseline
            means the model adds value beyond seed-based intuition.
          </p>
          <p><strong>Calibration Plot</strong> is a scatter plot where:</p>
          <ul className="guide-ul">
            <li>X-axis = predicted probability</li>
            <li>Y-axis = actual win rate in that probability bin</li>
            <li>The diagonal line represents perfect calibration</li>
            <li>Points above the diagonal: the model was under-confident (teams won more often than predicted)</li>
            <li>Points below the diagonal: the model was over-confident (teams won less often than predicted)</li>
            <li>Point size corresponds to the number of predictions in each bin, so larger dots represent more data</li>
          </ul>
          <p>
            <strong>Results Table</strong> provides a per-year breakdown with game counts, Brier
            Scores, and improvement percentages.
          </p>
        </SubSection>

        <SubSection title="Train vs. Test: Why It Matters">
          <p>
            If you tune lever weights to minimize Brier Score on the training set (2008&ndash;2019),
            the model will naturally perform well on those years &mdash; it&rsquo;s been &ldquo;fitted&rdquo;
            to them. The test set (2021&ndash;2024) tells you whether that configuration generalizes
            to unseen tournaments. If performance drops dramatically on the test set, you&rsquo;ve
            likely overfit.
          </p>
          <p>
            A good sign is when the lever configuration that works best on the training set also
            performs reasonably well on the test set.
          </p>
        </SubSection>

        <SubSection title="The 2021 Anomaly">
          <p>
            The 2021 tournament was played entirely in Indianapolis due to COVID-19 &mdash; all
            games at neutral-site venues in one city. This eliminated home-crowd effects, travel
            fatigue, and site proximity advantages. The 2021 results are flagged as anomalous
            because they may not reflect normal tournament dynamics. Consider the 2021 results
            separately when evaluating model performance.
          </p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* FAQ */}
      {/* ----------------------------------------------------------------- */}
      <Section id="faq" title="FAQ">
        <dl className="guide-faq">
          <dt>How often is the data updated?</dt>
          <dd>
            Team data is loaded from end-of-regular-season snapshots and is not updated
            mid-tournament. This is intentional &mdash; the model evaluates what teams looked
            like over the full season rather than reacting to tournament noise.
          </dd>

          <dt>Can I save multiple brackets?</dt>
          <dd>
            Yes. Sign in to save and load named bracket configurations. Each saved bracket
            preserves your picks, lever settings, overrides, and simulation snapshot.
          </dd>

          <dt>How many simulations should I run?</dt>
          <dd>
            10,000 is fast and good for exploration while you&rsquo;re iterating on your bracket.
            Use 50,000 or 100,000 for your final bracket to get more stable path probabilities.
            More simulations narrow the variance of the estimates.
          </dd>

          <dt>Do I need to adjust levers?</dt>
          <dd>
            No. The default lever configuration is designed to be reasonable out of the box. Levers
            are there for users who have a specific thesis about what matters in a given year&rsquo;s
            tournament, or who want to explore how different assumptions change the bracket.
          </dd>

          <dt>When should I use per-matchup overrides vs. global levers?</dt>
          <dd>
            Use <strong>global levers</strong> when you believe a factor is systematically more or
            less important across all games (e.g., &ldquo;Experience matters more this year&rdquo;).
            Use <strong>per-matchup overrides</strong> when you have game-specific knowledge the
            model can&rsquo;t capture (e.g., a key player is injured, a team is on a 10-game
            winning streak, or a team is playing a de facto home game).
          </dd>

          <dt>What does the ownership badge mean?</dt>
          <dd>
            The ownership badge shows an estimated percentage of contest participants who will pick
            that team to advance. It&rsquo;s derived from seed position, round depth, conference
            profile, and rating strength. In large pools, picking a low-ownership team that wins is
            more valuable than picking a high-ownership team that wins, because fewer competitors
            benefit from the same pick.
          </dd>

          <dt>Why did my downstream picks disappear?</dt>
          <dd>
            Cascading invalidation. If you change a pick in an earlier round, any later-round picks
            that depended on the old winner are automatically cleared. This prevents impossible
            brackets where a team advances past a round they lost in.
          </dd>

          <dt>Is this free?</dt>
          <dd>
            The app is free to use. AI narrative generation is powered by Claude and requires an
            API key configured by the administrator.
          </dd>
        </dl>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Glossary */}
      {/* ----------------------------------------------------------------- */}
      <Section id="glossary" title="Glossary">
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Definition</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>AdjEM</td><td>Adjusted Efficiency Margin &mdash; points scored/allowed per 100 possessions, adjusted for opponent strength</td></tr>
              <tr><td>BPR</td><td>Bayesian Performance Rating (Evan Miya) &mdash; rating system that regresses toward Bayesian priors</td></tr>
              <tr><td>Brier Score</td><td>Metric for evaluating probability calibration &mdash; lower is better (0 = perfect, 1 = worst)</td></tr>
              <tr><td>Calibration</td><td>How well predicted probabilities match actual observed win rates across many games</td></tr>
              <tr><td>Composite Rating</td><td>Weighted blend of KenPom, Torvik, and Evan Miya ratings into a single team strength number</td></tr>
              <tr><td>Four Factors</td><td>Dean Oliver&rsquo;s four key basketball stats: eFG%, TO%, ORB%, FTR</td></tr>
              <tr><td>Log5 / Logistic</td><td>Method for converting a rating differential into a win probability using the logistic function</td></tr>
              <tr><td>Monte Carlo</td><td>Simulation technique that runs thousands of random trials to estimate probabilities</td></tr>
              <tr><td>Ownership</td><td>Estimated percentage of contest participants picking a given team to advance</td></tr>
              <tr><td>Path Probability</td><td>Probability of a team reaching a specific round, accounting for all games on their path</td></tr>
              <tr><td>Pairwise Prob.</td><td>Probability of one team beating another in a single head-to-head game</td></tr>
              <tr><td>Variance Lever</td><td>A lever that affects the width of the outcome distribution rather than the mean (pace, 3-point rate)</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
