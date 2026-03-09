import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "12px",
      }}
    >
      <LoadingSpinner size={32} />
      <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
        Loading...
      </span>
    </div>
  );
}
