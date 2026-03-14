import Link from "next/link";

function BracketOverlay() {
  return (
    <div className="bracket-overlay" aria-hidden="true">
      <svg
        viewBox="0 0 800 500"
        width="900"
        height="560"
        fill="none"
        style={{ opacity: 0.04 }}
      >
        {/* Left side — 8 teams converging through 3 rounds */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const y = 30 + i * 56;
          return (
            <line
              key={`l1-${i}`}
              x1={40}
              y1={y}
              x2={120}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1.5}
            />
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const y1 = 30 + i * 112;
          const y2 = y1 + 56;
          const mid = (y1 + y2) / 2;
          return (
            <g key={`l2-${i}`}>
              <line x1={120} y1={y1} x2={120} y2={y2} stroke="var(--border-subtle)" strokeWidth={1.5} />
              <line x1={120} y1={mid} x2={200} y2={mid} stroke="var(--border-subtle)" strokeWidth={1.5} />
            </g>
          );
        })}
        {[0, 1].map((i) => {
          const y1 = 58 + i * 224;
          const y2 = y1 + 112;
          const mid = (y1 + y2) / 2;
          return (
            <g key={`l3-${i}`}>
              <line x1={200} y1={y1} x2={200} y2={y2} stroke="var(--border-subtle)" strokeWidth={1.5} />
              <line x1={200} y1={mid} x2={300} y2={mid} stroke="var(--border-subtle)" strokeWidth={1.5} />
            </g>
          );
        })}
        <line x1={300} y1={114} x2={300} y2={338} stroke="var(--border-subtle)" strokeWidth={1.5} />
        <line x1={300} y1={226} x2={380} y2={250} stroke="var(--border-subtle)" strokeWidth={1.5} />

        {/* Right side — mirror */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const y = 30 + i * 56;
          return (
            <line
              key={`r1-${i}`}
              x1={760}
              y1={y}
              x2={680}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth={1.5}
            />
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const y1 = 30 + i * 112;
          const y2 = y1 + 56;
          const mid = (y1 + y2) / 2;
          return (
            <g key={`r2-${i}`}>
              <line x1={680} y1={y1} x2={680} y2={y2} stroke="var(--border-subtle)" strokeWidth={1.5} />
              <line x1={680} y1={mid} x2={600} y2={mid} stroke="var(--border-subtle)" strokeWidth={1.5} />
            </g>
          );
        })}
        {[0, 1].map((i) => {
          const y1 = 58 + i * 224;
          const y2 = y1 + 112;
          const mid = (y1 + y2) / 2;
          return (
            <g key={`r3-${i}`}>
              <line x1={600} y1={y1} x2={600} y2={y2} stroke="var(--border-subtle)" strokeWidth={1.5} />
              <line x1={600} y1={mid} x2={500} y2={mid} stroke="var(--border-subtle)" strokeWidth={1.5} />
            </g>
          );
        })}
        <line x1={500} y1={114} x2={500} y2={338} stroke="var(--border-subtle)" strokeWidth={1.5} />
        <line x1={500} y1={226} x2={420} y2={250} stroke="var(--border-subtle)" strokeWidth={1.5} />

        {/* Championship */}
        <circle cx={400} cy={250} r={4} fill="var(--accent-primary)" opacity={0.5} />
      </svg>
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-8" />
      </svg>
    ),
    title: "Monte Carlo Engine",
    description:
      "Run 10,000 to 100,000 full-bracket simulations. Every pick propagates forward through the entire tournament to produce calibrated path probabilities.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-info)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    title: "Configurable Levers",
    description:
      "Tune Four Factors weights, roster experience, coach history, tempo effects, and more. Override any matchup with injury, site proximity, or momentum adjustments.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Contest Strategy",
    description:
      "Ownership estimates reveal how the public is picking. Game theory recommendations adapt to your pool size — from chalk for small pools to contrarian paths for large ones.",
  },
];

export default function Home() {
  return (
    <main id="main-content">
      {/* Hero */}
      <section className="hero-section">
        <BracketOverlay />
        <div className="hero-content">
          <h1
            style={{
              fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: 16,
            }}
          >
            The Bracket Lab
          </h1>
          <p
            style={{
              fontSize: "clamp(1rem, 2vw, 1.125rem)",
              color: "var(--text-secondary)",
              maxWidth: 540,
              margin: "0 auto 40px",
              lineHeight: 1.6,
            }}
          >
            Monte Carlo simulation meets college basketball. Build smarter
            brackets with composite ratings, configurable levers, and
            contest-aware strategy.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "center",
            }}
          >
            <Link href="/bracket" className="cta-primary">
              Build Your Bracket
            </Link>
            <Link href="/backtest" className="cta-secondary">
              Explore Backtest
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "80px 24px 100px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div style={{ marginBottom: 14 }}>{f.icon}</div>
              <h3
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "24px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <Link
          href="/admin/data"
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textDecoration: "none",
            fontFamily: "monospace",
          }}
        >
          Admin
        </Link>
      </footer>
    </main>
  );
}
