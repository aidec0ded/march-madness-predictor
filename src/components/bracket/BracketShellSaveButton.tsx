"use client";

import { useState, useCallback } from "react";
import { useBracketPersistence } from "@/hooks/useBracketPersistence";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";

/**
 * Save button rendered inside BracketProvider.
 *
 * Uses useBracketPersistence to save the current bracket.
 * Shows save state feedback (saving, saved, error).
 * Disabled when user is not authenticated or bracket has no unsaved changes.
 */
export function SaveButton() {
  const { saveBracket, isDirty, isAuthenticated } = useBracketPersistence();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = useCallback(async () => {
    if (!isAuthenticated || saveState === "saving") return;

    setSaveState("saving");
    try {
      await saveBracket();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [isAuthenticated, saveState, saveBracket]);

  let label: string;
  let color: string;
  let bgColor: string;

  switch (saveState) {
    case "saving":
      label = "Saving...";
      color = "var(--text-muted)";
      bgColor = "transparent";
      break;
    case "saved":
      label = "Saved";
      color = "var(--accent-success)";
      bgColor = "rgba(52, 211, 153, 0.1)";
      break;
    case "error":
      label = "Save Failed";
      color = "var(--accent-danger)";
      bgColor = "rgba(239, 68, 68, 0.1)";
      break;
    default:
      label = "Save";
      color = isAuthenticated && isDirty ? "var(--text-primary)" : "var(--text-muted)";
      bgColor = "transparent";
      break;
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={!isAuthenticated || saveState === "saving"}
      title={!isAuthenticated ? "Sign in to save brackets" : undefined}
      style={{
        padding: isMobile ? "6px 10px" : "8px 14px",
        fontSize: isMobile ? "0.75rem" : "0.8125rem",
        fontWeight: 600,
        color,
        backgroundColor: bgColor,
        border: "1px solid var(--border-primary)",
        borderRadius: "6px",
        cursor: !isAuthenticated || saveState === "saving" ? "not-allowed" : "pointer",
        opacity: !isAuthenticated ? 0.5 : 1,
        transition: "all 0.15s ease",
      }}
    >
      {label}
      {isDirty && saveState === "idle" && isAuthenticated && (
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "var(--accent-warning)",
            marginLeft: "6px",
            verticalAlign: "middle",
          }}
        />
      )}
    </button>
  );
}
