export default function BacktestLoading() {
  return (
    <div style={{ padding: "24px" }}>
      {/* Header bar placeholder */}
      <div
        className="skeleton-pulse"
        style={{
          height: "48px",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "8px",
          marginBottom: "32px",
        }}
      />

      {/* Two skeleton chart areas side by side */}
      <div
        style={{
          display: "flex",
          gap: "24px",
        }}
      >
        <div
          className="skeleton-pulse"
          style={{
            flex: 1,
            height: "300px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
          }}
        />
        <div
          className="skeleton-pulse"
          style={{
            flex: 1,
            height: "300px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
          }}
        />
      </div>

      <style jsx>{`
        .skeleton-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
