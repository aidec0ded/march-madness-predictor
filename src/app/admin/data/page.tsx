"use client";

import { useState, useCallback, useRef } from "react";
import type { ValidationError } from "@/types/data-import";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceStatus = "idle" | "loading" | "success" | "error";

interface ImportResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    season: number;
    source: string;
    teamCount: number;
    fetchWarnings?: string[];
    validation: {
      valid: boolean;
      errors: ValidationError[];
      validRowCount: number;
      totalRowCount: number;
      normalizationErrorCount: number;
    };
    teams: Array<Record<string, unknown>>;
  };
}

// ---------------------------------------------------------------------------
// Season options
// ---------------------------------------------------------------------------

const SEASON_OPTIONS: number[] = [];
for (let y = 2026; y >= 2015; y--) {
  SEASON_OPTIONS.push(y);
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SourceStatus }) {
  const config: Record<
    SourceStatus,
    { label: string; color: string; dot: string }
  > = {
    idle: {
      label: "Not Loaded",
      color: "var(--text-muted)",
      dot: "var(--text-muted)",
    },
    loading: {
      label: "Loading...",
      color: "var(--accent-warning)",
      dot: "var(--accent-warning)",
    },
    success: {
      label: "Loaded",
      color: "var(--accent-success)",
      dot: "var(--accent-success)",
    },
    error: {
      label: "Error",
      color: "var(--accent-danger)",
      dot: "var(--accent-danger)",
    },
  };

  const c = config[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: c.dot }}
      />
      <span style={{ color: c.color }}>{c.label}</span>
    </span>
  );
}

function SeasonSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        Season
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded px-2 py-1 text-sm font-mono cursor-pointer focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        {SEASON_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y - 1}&ndash;{String(y).slice(-2)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ErrorList({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      className="mt-3 rounded-lg overflow-hidden border"
      style={{
        borderColor: "var(--accent-danger)",
        backgroundColor: "rgba(239, 68, 68, 0.06)",
      }}
    >
      <div
        className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b"
        style={{
          color: "var(--accent-danger)",
          borderColor: "rgba(239, 68, 68, 0.15)",
        }}
      >
        Validation Errors ({errors.length})
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {errors.map((err, i) => (
          <div
            key={i}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: "rgba(239, 68, 68, 0.04)",
            }}
          >
            <span style={{ color: "var(--accent-danger)" }}>Row {err.row}</span>
            {" / "}
            <span style={{ color: "var(--accent-warning)" }}>{err.field}</span>
            {": "}
            {err.message}
            {err.value !== undefined && (
              <span style={{ color: "var(--text-muted)" }}>
                {" "}
                (got: {JSON.stringify(err.value)})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({ teams }: { teams: Array<Record<string, unknown>> }) {
  if (!teams || teams.length === 0) return null;

  const preview = teams.slice(0, 5);

  // Pick a set of key stat columns to display
  const columns: { key: string; label: string }[] = [
    { key: "teamId", label: "Team" },
    { key: "adjOE", label: "AdjO" },
    { key: "adjDE", label: "AdjD" },
    { key: "adjEM", label: "AdjEM" },
  ];

  // Try to determine which fields exist
  const hasField = (key: string) =>
    preview.some(
      (t) => t[key] !== undefined && t[key] !== null && t[key] !== ""
    );

  const visibleColumns = columns.filter((col) => hasField(col.key));

  // Fallback: show first few string/number keys
  if (visibleColumns.length <= 1) {
    const sampleKeys = Object.keys(preview[0] || {}).slice(0, 6);
    return (
      <div className="mt-3 overflow-x-auto">
        <div
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Preview (first {preview.length} teams)
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr>
              {sampleKeys.map((key) => (
                <th
                  key={key}
                  className="text-left px-2 py-1.5 border-b"
                  style={{
                    color: "var(--text-muted)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i}>
                {sampleKeys.map((key) => (
                  <td
                    key={key}
                    className="px-2 py-1 border-b"
                    style={{
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    {row[key] !== undefined && row[key] !== null
                      ? typeof row[key] === "number"
                        ? (row[key] as number).toFixed(1)
                        : String(row[key])
                      : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <div
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Preview (first {preview.length} teams)
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className="text-left px-2 py-1.5 border-b"
                style={{
                  color: "var(--text-muted)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i}>
              {visibleColumns.map((col) => (
                <td
                  key={col.key}
                  className="px-2 py-1 border-b"
                  style={{
                    color: "var(--text-secondary)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {row[col.key] !== undefined && row[col.key] !== null
                    ? typeof row[col.key] === "number"
                      ? (row[col.key] as number).toFixed(1)
                      : String(row[col.key])
                    : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      style={{ color: "var(--accent-primary)" }}
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
  );
}

function PanelCard({
  title,
  status,
  children,
}: {
  title: string;
  status: SourceStatus;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KenPom Panel
// ---------------------------------------------------------------------------

function KenPomPanel({ adminKey }: { adminKey: string }) {
  const [season, setSeason] = useState(2026);
  const [csvContent, setCsvContent] = useState("");
  const [status, setStatus] = useState<SourceStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent((e.target?.result as string) || "");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!csvContent.trim()) return;
    setStatus("loading");
    setResult(null);

    try {
      const resp = await fetch("/api/admin/import/kenpom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ season, csvContent }),
      });

      const data: ImportResult = await resp.json();
      setResult(data);
      setStatus(data.success ? "success" : "error");
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      setStatus("error");
    }
  };

  return (
    <PanelCard title="KenPom Import" status={status}>
      <div className="space-y-4">
        <SeasonSelector value={season} onChange={setSeason} />

        {/* Drop zone / file upload */}
        <div
          className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
          style={{
            borderColor: isDragging
              ? "var(--accent-primary)"
              : "var(--border-default)",
            backgroundColor: isDragging
              ? "rgba(74, 144, 217, 0.06)"
              : "var(--bg-elevated)",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div
            className="text-sm mb-1"
            style={{
              color: isDragging
                ? "var(--accent-primary)"
                : "var(--text-secondary)",
            }}
          >
            {csvContent
              ? "CSV loaded - click or drop to replace"
              : "Drop CSV file here or click to browse"}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Accepts .csv or .txt files
          </div>
        </div>

        {/* Or paste directly */}
        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Or paste CSV content
          </label>
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={6}
            placeholder="Team,Conf,AdjEM,AdjO,AdjD,AdjT,..."
            className="w-full rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              minHeight: "100px",
            }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !csvContent.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
          }}
        >
          {status === "loading" && <Spinner />}
          Validate & Preview
        </button>

        {/* Result */}
        {result && (
          <div className="mt-2">
            {result.success && result.data ? (
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span style={{ color: "var(--accent-success)" }}>
                    {result.data.teamCount} teams processed
                  </span>
                  {result.data.validation.valid ? (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(52, 211, 153, 0.12)",
                        color: "var(--accent-success)",
                      }}
                    >
                      All valid
                    </span>
                  ) : (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        color: "var(--accent-danger)",
                      }}
                    >
                      {result.data.validation.errors.length} error
                      {result.data.validation.errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <PreviewTable teams={result.data.teams} />
                <ErrorList errors={result.data.validation.errors} />
              </div>
            ) : (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-danger)",
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                }}
              >
                {result.error || "Import failed."}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Torvik Panel
// ---------------------------------------------------------------------------

function TorvikPanel({ adminKey }: { adminKey: string }) {
  const [season, setSeason] = useState(2026);
  const [status, setStatus] = useState<SourceStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFetch = async () => {
    setStatus("loading");
    setResult(null);

    try {
      const resp = await fetch("/api/admin/import/torvik", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ season }),
      });

      const data: ImportResult = await resp.json();
      setResult(data);
      setStatus(data.success ? "success" : "error");
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      setStatus("error");
    }
  };

  return (
    <PanelCard title="Torvik Import" status={status}>
      <div className="space-y-4">
        <SeasonSelector value={season} onChange={setSeason} />

        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.06)",
            border: "1px solid rgba(245, 158, 11, 0.15)",
            color: "var(--accent-warning)",
          }}
        >
          Note: Torvik has a 10-second crawl delay. The fetch may take a moment.
        </div>

        <button
          onClick={handleFetch}
          disabled={status === "loading"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
          }}
        >
          {status === "loading" && <Spinner />}
          {status === "loading"
            ? "Fetching from Torvik..."
            : "Fetch from Torvik"}
        </button>

        {/* Result */}
        {result && (
          <div className="mt-2">
            {result.success && result.data ? (
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span style={{ color: "var(--accent-success)" }}>
                    {result.data.teamCount} teams fetched
                  </span>
                  {result.data.validation.valid ? (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(52, 211, 153, 0.12)",
                        color: "var(--accent-success)",
                      }}
                    >
                      All valid
                    </span>
                  ) : (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        color: "var(--accent-danger)",
                      }}
                    >
                      {result.data.validation.errors.length} error
                      {result.data.validation.errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {result.data.fetchWarnings &&
                  result.data.fetchWarnings.length > 0 && (
                    <div
                      className="mt-2 rounded-lg px-3 py-2 text-xs"
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.06)",
                        color: "var(--accent-warning)",
                      }}
                    >
                      {result.data.fetchWarnings.length} warning
                      {result.data.fetchWarnings.length !== 1 ? "s" : ""}:{" "}
                      {result.data.fetchWarnings.join("; ")}
                    </div>
                  )}
                <PreviewTable teams={result.data.teams} />
                <ErrorList errors={result.data.validation.errors} />
              </div>
            ) : (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-danger)",
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                }}
              >
                {result.error || "Fetch failed."}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Evan Miya Panel
// ---------------------------------------------------------------------------

function EvanMiyaPanel({ adminKey }: { adminKey: string }) {
  const [season, setSeason] = useState(2026);
  const [jsonContent, setJsonContent] = useState("");
  const [status, setStatus] = useState<SourceStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setParseError(null);

    // Try to parse JSON
    let entries: unknown;
    try {
      entries = JSON.parse(jsonContent);
    } catch {
      setParseError(
        'Invalid JSON. Expected an array of objects: [{ "team": "...", "bpr": "...", "obpr": "...", "dbpr": "..." }]'
      );
      return;
    }

    if (!Array.isArray(entries)) {
      setParseError("JSON must be an array of objects.");
      return;
    }

    if (entries.length === 0) {
      setParseError("Array must not be empty.");
      return;
    }

    setStatus("loading");
    setResult(null);

    try {
      const resp = await fetch("/api/admin/import/evanmiya", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ season, entries }),
      });

      const data: ImportResult = await resp.json();
      setResult(data);
      setStatus(data.success ? "success" : "error");
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      setStatus("error");
    }
  };

  return (
    <PanelCard title="Evan Miya Import" status={status}>
      <div className="space-y-4">
        <SeasonSelector value={season} onChange={setSeason} />

        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Paste JSON entries
          </label>
          <textarea
            value={jsonContent}
            onChange={(e) => {
              setJsonContent(e.target.value);
              setParseError(null);
            }}
            rows={8}
            placeholder={`[\n  { "team": "Connecticut", "bpr": "31.2", "obpr": "121.5", "dbpr": "90.3" },\n  { "team": "Houston", "bpr": "28.7", "obpr": "115.1", "dbpr": "86.4" }\n]`}
            className="w-full rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--bg-elevated)",
              border: `1px solid ${parseError ? "var(--accent-danger)" : "var(--border-default)"}`,
              color: "var(--text-primary)",
              minHeight: "120px",
            }}
          />
          {parseError && (
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--accent-danger)" }}
            >
              {parseError}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !jsonContent.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
          }}
        >
          {status === "loading" && <Spinner />}
          Validate & Import
        </button>

        {/* Result */}
        {result && (
          <div className="mt-2">
            {result.success && result.data ? (
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span style={{ color: "var(--accent-success)" }}>
                    {result.data.teamCount} teams processed
                  </span>
                  {result.data.validation.valid ? (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(52, 211, 153, 0.12)",
                        color: "var(--accent-success)",
                      }}
                    >
                      All valid
                    </span>
                  ) : (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        color: "var(--accent-danger)",
                      }}
                    >
                      {result.data.validation.errors.length} error
                      {result.data.validation.errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <PreviewTable teams={result.data.teams} />
                <ErrorList errors={result.data.validation.errors} />
              </div>
            ) : (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-danger)",
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                }}
              >
                {result.error || "Import failed."}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminDataPage() {
  const [adminKey, setAdminKey] = useState("");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page title */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Data Management
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Upload, fetch, and validate team data from KenPom, Torvik, and Evan
          Miya.
        </p>
      </div>

      {/* Admin API key */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label
            className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
            style={{ color: "var(--text-muted)" }}
          >
            Admin API Key
          </label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter your admin key"
            className="flex-1 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1"
            style={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              maxWidth: "400px",
            }}
          />
          {adminKey && (
            <span
              className="text-xs"
              style={{ color: "var(--accent-success)" }}
            >
              Key set
            </span>
          )}
        </div>
        {!adminKey && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Required for all import operations. Sent as the{" "}
            <code
              className="px-1 py-0.5 rounded text-xs"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            >
              x-admin-key
            </code>{" "}
            header.
          </p>
        )}
      </div>

      {/* Import panels grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <KenPomPanel adminKey={adminKey} />
        <TorvikPanel adminKey={adminKey} />
        <EvanMiyaPanel adminKey={adminKey} />
      </div>
    </div>
  );
}
