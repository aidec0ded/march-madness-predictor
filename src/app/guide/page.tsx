import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "User Guide",
  description:
    "Learn how to use Predict the Madness — bracket building, Monte Carlo simulation, levers, AI analysis, and more.",
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
          Everything you need to build smarter brackets with Predict the Madness.
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="guide-toc" aria-label="Table of contents">
        <h2 className="guide-toc__title">Contents</h2>
        <ol className="guide-toc__list">
          <li><a href="#getting-started">Getting Started</a></li>
          <li><a href="#bracket-view">The Bracket View</a></li>
          <li><a href="#making-picks">Making Picks</a></li>
          <li><a href="#probabilities">Understanding Probabilities</a></li>
          <li><a href="#levers">Adjusting Levers</a></li>
          <li><a href="#matchup-view">The Matchup View</a></li>
          <li><a href="#ai-analysis">AI Analysis</a></li>
          <li><a href="#guidance">Contextual Guidance</a></li>
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
          <p>When you first open the bracket, select your contest pool size. This shapes how recommendations are surfaced:</p>
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
          <p>You can change your pool size at any time from the header bar dropdown or from <Link href="/settings">Settings</Link>.</p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Bracket View */}
      {/* ----------------------------------------------------------------- */}
      <Section id="bracket-view" title="The Bracket View">
        <p>
          The bracket view is the primary screen of the application. It displays the full 64-team
          tournament across four regions plus the Final Four.
        </p>
        <SubSection title="Key Elements">
          <ul className="guide-ul">
            <li><strong>Team cards</strong> &mdash; Each team shows its seed, name, and a probability bar indicating win likelihood for that game.</li>
            <li><strong>Ownership badges</strong> &mdash; Small badges showing estimated public pick ownership, color-coded by level.</li>
            <li><strong>Override indicators</strong> &mdash; Orange dots on matchups where per-matchup overrides have been applied.</li>
            <li><strong>Header bar</strong> &mdash; Contains the pool size selector, Simulate button, and toggles for Levers, Results, and Guidance panels.</li>
          </ul>
        </SubSection>
        <SubSection title="Navigation">
          <ul className="guide-ul">
            <li>Click any matchup to open the detailed Matchup View.</li>
            <li>Click the <strong>Simulate</strong> button to run Monte Carlo simulations and see updated probabilities.</li>
          </ul>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Making Picks */}
      {/* ----------------------------------------------------------------- */}
      <Section id="making-picks" title="Making Picks">
        <ol className="guide-ol">
          <li><strong>Click a team card</strong> in any Round of 64 matchup to select the winner.</li>
          <li>The winning team automatically advances to the next round&rsquo;s slot.</li>
          <li>Continue picking winners through each round until you reach the National Championship.</li>
          <li><strong>Cascading invalidation</strong> &mdash; If you change a pick in an earlier round, any downstream picks involving the previously selected team are automatically cleared.</li>
        </ol>
        <p>Your bracket is auto-saved to your account (if signed in). You can also manually save named bracket configurations.</p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Understanding Probabilities */}
      {/* ----------------------------------------------------------------- */}
      <Section id="probabilities" title="Understanding Probabilities">
        <SubSection title="The Composite Model">
          <p>The app blends three respected college basketball rating systems:</p>
          <ol className="guide-ol">
            <li><strong>KenPom</strong> &mdash; Adjusted efficiency margin</li>
            <li><strong>Torvik</strong> &mdash; Adjusted efficiency margin</li>
            <li><strong>Evan Miya</strong> &mdash; Bayesian Performance Rating</li>
          </ol>
          <p>These are combined into a single composite rating, then converted into a win probability using a logistic model.</p>
        </SubSection>
        <SubSection title="What the Percentages Mean">
          <p>
            A team showing &ldquo;72%&rdquo; means: across thousands of simulated outcomes, that team won
            approximately 72% of the time given the current model settings.
          </p>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Levers */}
      {/* ----------------------------------------------------------------- */}
      <Section id="levers" title="Adjusting Levers">
        <p>Levers let you customize how much weight specific factors carry in the probability model.</p>

        <SubSection title="Global Levers">
          <p>Accessible from the <strong>Levers</strong> toggle in the bracket header. These apply across all matchups:</p>
          <ul className="guide-ul">
            <li><strong>Composite Weights</strong> &mdash; Adjust the relative weight of KenPom, Torvik, and Evan Miya ratings.</li>
            <li><strong>Four Factors</strong> &mdash; Tune offense and defense weights for eFG%, TO%, ORB%, and FT Rate (8 sliders).</li>
            <li><strong>Roster Experience</strong> &mdash; Weight for minutes-weighted D-1 experience.</li>
            <li><strong>Minutes Continuity</strong> &mdash; Weight for rotation continuity from prior season.</li>
            <li><strong>Coach Tournament Experience</strong> &mdash; Weight for coach&rsquo;s prior tournament track record.</li>
            <li><strong>Pace/Tempo</strong> &mdash; Affects distribution width (slower pace compresses outcomes, increasing upset probability).</li>
            <li><strong>Three-Point Rate</strong> &mdash; Affects distribution width (high-volume 3PT shooting introduces boom/bust variance).</li>
          </ul>
        </SubSection>

        <SubSection title="Per-Matchup Overrides">
          <p>Accessible from the Matchup View. All global lever values are inherited and can be overridden:</p>
          <ul className="guide-ul">
            <li><strong>Injury/Availability</strong> &mdash; Downward adjustment for roster availability issues.</li>
            <li><strong>Site Proximity</strong> &mdash; Distance-based advantage (true home regional, regional advantage, neutral, moderate travel, significant travel).</li>
            <li><strong>Recent Form/Momentum</strong> &mdash; Override for teams whose recent trajectory diverges from season-long ratings.</li>
            <li><strong>Rest/Schedule Density</strong> &mdash; Adjustment for days of rest after conference tournament runs.</li>
          </ul>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Matchup View */}
      {/* ----------------------------------------------------------------- */}
      <Section id="matchup-view" title="The Matchup View">
        <p>Click any matchup in the bracket to open the full-screen Matchup View &mdash; your &ldquo;film room&rdquo; for analyzing a specific game.</p>
        <SubSection title="Contents">
          <ul className="guide-ul">
            <li><strong>Probability Display</strong> &mdash; Large win probability numbers, point spread, and a breakdown of how each lever contributes.</li>
            <li><strong>Team Profile Cards</strong> &mdash; Side-by-side cards showing efficiency ratings, four factors, shooting splits, tempo, experience, and coaching data.</li>
            <li><strong>Stat Comparison</strong> &mdash; 15 metrics grouped by category with advantage coloring and field rankings (e.g., &ldquo;11th&rdquo;).</li>
            <li><strong>Distribution Chart</strong> &mdash; Histogram of simulated margin-of-victory outcomes.</li>
            <li><strong>AI Narrative Analysis</strong> &mdash; Claude-powered plain-language game breakdown.</li>
            <li><strong>Override Panel</strong> &mdash; Per-matchup lever sliders.</li>
          </ul>
        </SubSection>
        <SubSection title="Controls">
          <ul className="guide-ul">
            <li>Press <strong>Escape</strong> or click <strong>Back to Bracket</strong> to close.</li>
            <li>Override changes are reflected immediately in the probability display.</li>
          </ul>
        </SubSection>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* AI Analysis */}
      {/* ----------------------------------------------------------------- */}
      <Section id="ai-analysis" title="AI Analysis">
        <p>Each matchup includes an AI-generated narrative analysis powered by Claude. To use it:</p>
        <ol className="guide-ol">
          <li>Open any matchup where both teams are determined.</li>
          <li>Click <strong>Generate Analysis</strong> in the Narrative panel.</li>
          <li>The narrative streams in real time and covers:</li>
        </ol>
        <ul className="guide-ul guide-ul--nested">
          <li><strong>Rating Profile</strong> &mdash; How the teams compare on raw efficiency.</li>
          <li><strong>Stylistic Matchup</strong> &mdash; How their playing styles interact.</li>
          <li><strong>Key Factors</strong> &mdash; The most impactful data points for this specific game.</li>
          <li><strong>How This Game Plays Out</strong> &mdash; A plausible game flow based on the data.</li>
          <li><strong>Recommendation</strong> &mdash; A pick recommendation incorporating win probability and pool strategy.</li>
        </ul>
        <p>Narratives are cached per matchup. Regenerate only if you change overrides or lever settings.</p>
        <p className="guide-note">Rate limit: 10 narratives per minute per user.</p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Guidance */}
      {/* ----------------------------------------------------------------- */}
      <Section id="guidance" title="Contextual Guidance">
        <p>The <strong>Guidance</strong> panel surfaces proactive warnings and insights as you build your bracket:</p>
        <ul className="guide-ul">
          <li><strong>Upset Volume Warning</strong> &mdash; Flags if you&rsquo;ve selected more first-round upsets than is historically typical (~4 per year).</li>
          <li><strong>Chalk Concentration Warning</strong> &mdash; Flags heavily consensus-correlated brackets, reducing differentiation in large pools.</li>
          <li><strong>Variance Mismatch Note</strong> &mdash; Flags high-variance teams (heavy 3PT shooting) picked to advance deep.</li>
          <li><strong>Lever Conflict Detection</strong> &mdash; Flags when lever weights contradict your picks.</li>
          <li><strong>Recency Divergence Flag</strong> &mdash; Flags teams whose recent form significantly diverges from season-long ratings.</li>
          <li><strong>Pace/Tempo Explanation</strong> &mdash; Contextual note for slow-paced underdogs explaining variance compression.</li>
        </ul>
        <p>All guidance is informational &mdash; you always have final control over your picks.</p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* Backtesting */}
      {/* ----------------------------------------------------------------- */}
      <Section id="backtesting" title="Backtesting">
        <p>
          The <Link href="/backtest">Backtest</Link> page lets you validate the model against historical tournament results (2008&ndash;2024).
        </p>
        <SubSection title="How to Use">
          <ol className="guide-ol">
            <li>Navigate to <Link href="/backtest">Backtest</Link> from the navigation.</li>
            <li>Select a year range (training set: 2008&ndash;2019, test set: 2021&ndash;2024).</li>
            <li>Optionally adjust lever weights to test different configurations.</li>
            <li>Click <strong>Run Backtest</strong> to evaluate the model.</li>
          </ol>
        </SubSection>
        <SubSection title="Results">
          <ul className="guide-ul">
            <li><strong>Brier Score</strong> &mdash; Primary metric for probability calibration (lower is better), compared against a seed-based baseline.</li>
            <li><strong>Brier Score Chart</strong> &mdash; Year-by-year comparison between your model and the baseline.</li>
            <li><strong>Calibration Plot</strong> &mdash; Shows how well predicted probabilities match actual win rates.</li>
            <li><strong>Results Table</strong> &mdash; Detailed per-year breakdown with game counts and scores.</li>
          </ul>
        </SubSection>
        <p className="guide-note">Note: 2021 is flagged as anomalous due to the COVID bubble (all games played in Indianapolis).</p>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* FAQ */}
      {/* ----------------------------------------------------------------- */}
      <Section id="faq" title="FAQ">
        <dl className="guide-faq">
          <dt>How often is the data updated?</dt>
          <dd>Team data is loaded from end-of-regular-season snapshots and is not updated mid-tournament.</dd>

          <dt>Can I save multiple brackets?</dt>
          <dd>Yes. Sign in to save and load named bracket configurations.</dd>

          <dt>How many simulations should I run?</dt>
          <dd>10,000 is fast and good for exploration. Use 50,000 or 100,000 for final bracket decisions &mdash; more simulations produce more stable probabilities.</dd>

          <dt>Is this free?</dt>
          <dd>The app is free to use. AI narrative generation requires an Anthropic API key configured by the administrator.</dd>
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
              <tr><td>BPR</td><td>Bayesian Performance Rating (Evan Miya)</td></tr>
              <tr><td>Brier Score</td><td>Metric for evaluating probability calibration &mdash; lower is better</td></tr>
              <tr><td>Four Factors</td><td>Dean Oliver&rsquo;s four key basketball stats: eFG%, TO%, ORB%, FTR</td></tr>
              <tr><td>Log5</td><td>Method for computing win probability from two teams&rsquo; ratings</td></tr>
              <tr><td>Monte Carlo</td><td>Simulation technique that runs thousands of random trials to estimate probabilities</td></tr>
              <tr><td>Ownership</td><td>Estimated percentage of contest participants picking a given team</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
