"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POOL_SIZE_OPTIONS = [
  { value: "small", label: "Small (\u226420 people)" },
  { value: "medium", label: "Medium (50\u2013200 people)" },
  { value: "large", label: "Large (500+ people)" },
  { value: "very_large", label: "Very Large (100,000+ people)" },
] as const;

const SIM_COUNT_OPTIONS = [10_000, 25_000, 50_000, 100_000] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsData {
  pool_size_bucket: string;
  simulation_count: number;
  preferences: Record<string, unknown>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [poolSize, setPoolSize] = useState("medium");
  const [simCount, setSimCount] = useState(10_000);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch current settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const { settings } = (await res.json()) as {
            settings: SettingsData;
          };
          setPoolSize(settings.pool_size_bucket);
          setSimCount(settings.simulation_count);
        } else if (res.status === 401) {
          setErrorMessage("You must be signed in to view settings.");
        }
      } catch {
        setErrorMessage("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pool_size_bucket: poolSize,
          simulation_count: simCount,
        }),
      });

      if (res.ok) {
        setSaveStatus("saved");
        // Reset status after a brief delay
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else if (res.status === 401) {
        setErrorMessage("You must be signed in to save settings.");
        setSaveStatus("error");
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to save settings.");
        setSaveStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setSaveStatus("error");
    }
  }, [poolSize, simCount]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Configure your bracket prediction preferences and contest strategy.
        </p>
      </div>

      {loading ? (
        <div
          className="text-sm py-12 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Loading settings...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pool Size Bucket */}
          <div
            className="rounded-xl border p-5"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <label
              className="block text-sm font-semibold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Contest Pool Size
            </label>
            <p
              className="text-xs mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              How many people are in your bracket contest? This shapes how the
              app recommends picks, balancing chalk vs. contrarian strategies.
            </p>
            <select
              value={poolSize}
              onChange={(e) => setPoolSize(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-1"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {POOL_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Strategy hint based on pool size */}
            <div
              className="mt-3 rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: "rgba(74, 144, 217, 0.06)",
                border: "1px solid rgba(74, 144, 217, 0.15)",
                color: "var(--accent-primary)",
              }}
            >
              {poolSize === "small" &&
                "Small pool: Focus on picking the most likely outcomes. Differentiation matters less."}
              {poolSize === "medium" &&
                "Medium pool: Consider 1\u20132 strategically contrarian picks while keeping chalk elsewhere."}
              {poolSize === "large" &&
                "Large pool: Champion pick ownership is key. Look for low-ownership, defensible picks."}
              {poolSize === "very_large" &&
                "Very large pool: This is lottery-style strategy. Maximize low-ownership paths for the best expected value."}
            </div>
          </div>

          {/* Simulation Count */}
          <div
            className="rounded-xl border p-5"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <label
              className="block text-sm font-semibold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Simulation Count
            </label>
            <p
              className="text-xs mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Number of Monte Carlo simulations to run per bracket. Higher counts
              yield more stable probabilities but take longer to compute.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SIM_COUNT_OPTIONS.map((count) => {
                const isSelected = simCount === count;
                return (
                  <button
                    key={count}
                    onClick={() => setSimCount(count)}
                    className="rounded-lg px-3 py-2.5 text-sm font-mono font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--accent-primary)"
                        : "var(--bg-elevated)",
                      color: isSelected ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
                    }}
                  >
                    {count.toLocaleString()}
                  </button>
                );
              })}
            </div>
            <div
              className="mt-2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {simCount <= 10_000 && "Fast (~1s). Good for quick exploration."}
              {simCount === 25_000 &&
                "Balanced (~2s). Good default for most users."}
              {simCount === 50_000 &&
                "Precise (~4s). Recommended for final bracket decisions."}
              {simCount >= 100_000 &&
                "Maximum precision (~8s). Best for thorough analysis."}
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                color: "var(--accent-danger)",
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "#fff",
              }}
            >
              {saveStatus === "saving" ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </button>

            {saveStatus === "saved" && (
              <span
                className="text-sm font-medium"
                style={{ color: "var(--accent-success)" }}
              >
                Saved successfully
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
