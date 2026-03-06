export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1
          className="text-5xl font-bold tracking-tight mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          March Madness Predictor
        </h1>
        <p
          className="text-lg max-w-xl mx-auto mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          Monte Carlo simulation meets college basketball. Build smarter
          brackets with composite ratings, configurable levers, and
          contest-aware strategy.
        </p>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--accent-warning)" }}
          />
          In Development — Phase 0
        </div>
      </div>
    </main>
  );
}
