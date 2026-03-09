export default function BracketLoading() {
  return (
    <div style={{ padding: "24px" }}>
      {/* Header bar placeholder */}
      <div
        style={{
          height: "48px",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "8px",
          marginBottom: "32px",
        }}
        className="skeleton-pulse"
      />

      {/* Matchup slots grid: two rows of 4 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 200px)",
          gap: "16px",
          justifyContent: "center",
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-pulse"
            style={{
              width: "200px",
              height: "80px",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
