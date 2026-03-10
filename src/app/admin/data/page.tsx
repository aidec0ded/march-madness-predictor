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
    csvSummary?: { main: number; offense: number; defense: number; misc: number; height: number };
    mergeWarnings?: string[];
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

interface CommitResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    teamsUpserted: number;
    teamSeasonsUpserted: number;
    nameMappingsUpserted: number;
    errors: string[];
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
// KenPom Panel — Multi-file upload
// ---------------------------------------------------------------------------

type KenPomSlotKey = "main" | "offense" | "defense" | "misc" | "height";

interface FileSlot {
  key: KenPomSlotKey;
  label: string;
  required: boolean;
  description: string;
}

const KENPOM_FILE_SLOTS: FileSlot[] = [
  { key: "main", label: "Main Summary", required: true, description: "Core KenPom CSV (AdjOE, AdjDE, AdjEM, Tempo)" },
  { key: "offense", label: "Offense", required: false, description: "Four Factors offense CSV" },
  { key: "defense", label: "Defense", required: false, description: "Four Factors defense CSV" },
  { key: "misc", label: "Misc", required: false, description: "Misc stats CSV (3PT%, FT%, DFP, etc.)" },
  { key: "height", label: "Height/Roster", required: false, description: "Height, experience, bench, continuity CSV" },
];

function KenPomFileSlot({
  slot,
  content,
  fileName,
  onFile,
}: {
  slot: FileSlot;
  content: string;
  fileName: string;
  onFile: (content: string, name: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loaded = content.length > 0;

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        onFile((e.target?.result as string) || "", file.name);
      };
      reader.readAsText(file);
    },
    [onFile]
  );

  return (
    <div
      className="rounded-lg border p-3 cursor-pointer transition-colors"
      style={{
        borderColor: isDragging
          ? "var(--accent-primary)"
          : loaded
          ? "var(--accent-success)"
          : "var(--border-default)",
        backgroundColor: isDragging
          ? "rgba(74, 144, 217, 0.06)"
          : "var(--bg-elevated)",
        borderStyle: loaded ? "solid" : "dashed",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          // Reset so re-selecting same file triggers onChange
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: loaded
                ? "var(--accent-success)"
                : "var(--text-muted)",
            }}
          />
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {slot.label}
            {slot.required && (
              <span
                className="ml-1 text-xs"
                style={{ color: "var(--accent-danger)" }}
              >
                *
              </span>
            )}
          </span>
        </div>
        <span
          className="text-xs flex-shrink-0"
          style={{ color: loaded ? "var(--accent-success)" : "var(--text-muted)" }}
        >
          {loaded ? "Loaded" : "Not loaded"}
        </span>
      </div>
      {loaded && fileName && (
        <div
          className="mt-1 text-xs font-mono truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {fileName}
        </div>
      )}
      {!loaded && (
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {slot.description}
        </div>
      )}
    </div>
  );
}

function KenPomPreviewTable({ teams }: { teams: Array<Record<string, unknown>> }) {
  if (!teams || teams.length === 0) return null;

  const preview = teams.slice(0, 5);

  // Helper to safely extract nested values
  const getValue = (team: Record<string, unknown>, path: string): unknown => {
    const parts = path.split(".");
    let current: unknown = team;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  const columns: { path: string; label: string; format?: "number" }[] = [
    { path: "team.name", label: "Team" },
    { path: "ratings.kenpom.adjOE", label: "AdjOE", format: "number" },
    { path: "ratings.kenpom.adjDE", label: "AdjDE", format: "number" },
    { path: "ratings.kenpom.adjEM", label: "AdjEM", format: "number" },
    { path: "adjTempo", label: "Tempo", format: "number" },
    { path: "experience", label: "Exp", format: "number" },
    { path: "minutesContinuity", label: "Cont", format: "number" },
    { path: "benchMinutesPct", label: "Bench", format: "number" },
    { path: "avgHeight", label: "Height", format: "number" },
    { path: "twoFoulParticipation", label: "2-Foul", format: "number" },
  ];

  // Only show columns that have at least one non-empty value
  const visibleColumns = columns.filter((col) =>
    preview.some((t) => {
      const v = getValue(t, col.path);
      return v !== undefined && v !== null && v !== "";
    })
  );

  if (visibleColumns.length === 0) {
    // Fallback to flat keys
    const sampleKeys = Object.keys(preview[0] || {}).slice(0, 8);
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
                key={col.path}
                className="text-left px-2 py-1.5 border-b whitespace-nowrap"
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
              {visibleColumns.map((col) => {
                const val = getValue(row, col.path);
                let display = "-";
                if (val !== undefined && val !== null && val !== "") {
                  if (col.format === "number" && typeof val === "number") {
                    display = val.toFixed(1);
                  } else {
                    display = String(val);
                  }
                }
                return (
                  <td
                    key={col.path}
                    className="px-2 py-1 border-b whitespace-nowrap"
                    style={{
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KenPomPanel({ adminKey }: { adminKey: string }) {
  const [season, setSeason] = useState(2026);
  const [status, setStatus] = useState<SourceStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [commitStatus, setCommitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  // File slot state: content and file names
  const [files, setFiles] = useState<Record<KenPomSlotKey, string>>({
    main: "",
    offense: "",
    defense: "",
    misc: "",
    height: "",
  });
  const [fileNames, setFileNames] = useState<Record<KenPomSlotKey, string>>({
    main: "",
    offense: "",
    defense: "",
    misc: "",
    height: "",
  });

  const setSlotFile = useCallback((key: KenPomSlotKey, content: string, name: string) => {
    setFiles((prev) => ({ ...prev, [key]: content }));
    setFileNames((prev) => ({ ...prev, [key]: name }));
    // Reset validation & commit state when files change
    setResult(null);
    setCommitResult(null);
    setCommitStatus("idle");
    setStatus("idle");
  }, []);

  const mainLoaded = files.main.trim().length > 0;

  const handleValidate = async () => {
    if (!mainLoaded) return;
    setStatus("loading");
    setResult(null);
    setCommitResult(null);
    setCommitStatus("idle");

    try {
      const body: Record<string, unknown> = { season, csvContent: files.main };
      if (files.offense.trim()) body.offenseCsv = files.offense;
      if (files.defense.trim()) body.defenseCsv = files.defense;
      if (files.misc.trim()) body.miscCsv = files.misc;
      if (files.height.trim()) body.heightCsv = files.height;

      const resp = await fetch("/api/admin/import/kenpom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify(body),
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

  const handleCommit = async () => {
    if (!result?.data?.teams) return;
    setCommitStatus("loading");
    setCommitResult(null);

    try {
      const resp = await fetch("/api/admin/import/kenpom/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ season, teams: result.data.teams }),
      });

      const data: CommitResult = await resp.json();
      setCommitResult(data);
      setCommitStatus(data.success ? "success" : "error");
    } catch (err) {
      setCommitResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      setCommitStatus("error");
    }
  };

  const canCommit =
    result?.success &&
    result.data?.validation?.valid &&
    commitStatus !== "success";

  return (
    <PanelCard title="KenPom Import" status={status}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SeasonSelector value={season} onChange={setSeason} />
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--accent-danger)" }}>*</span> = required
          </div>
        </div>

        {/* File upload slots grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {KENPOM_FILE_SLOTS.map((slot) => (
            <KenPomFileSlot
              key={slot.key}
              slot={slot}
              content={files[slot.key]}
              fileName={fileNames[slot.key]}
              onFile={(content, name) => setSlotFile(slot.key, content, name)}
            />
          ))}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={status === "loading" || !mainLoaded}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "#fff",
            }}
          >
            {status === "loading" && <Spinner />}
            Validate & Preview
          </button>

          {canCommit && (
            <button
              onClick={handleCommit}
              disabled={commitStatus === "loading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-success)",
                color: "#fff",
              }}
            >
              {commitStatus === "loading" && <Spinner />}
              {commitStatus === "loading"
                ? "Saving..."
                : "Confirm & Save to Database"}
            </button>
          )}
        </div>

        {/* Validation result */}
        {result && (
          <div className="mt-2">
            {result.success && result.data ? (
              <div className="space-y-3">
                {/* Status summary */}
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

                {/* CSV Summary bar */}
                {result.data.csvSummary && (
                  <div
                    className="rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <span
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      CSV Rows:
                    </span>
                    {(
                      [
                        ["Main", result.data.csvSummary.main],
                        ["Offense", result.data.csvSummary.offense],
                        ["Defense", result.data.csvSummary.defense],
                        ["Misc", result.data.csvSummary.misc],
                        ["Height", result.data.csvSummary.height],
                      ] as [string, number][]
                    ).map(([label, count]) => (
                      <span key={label} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}:</span>{" "}
                        <span
                          style={{
                            color:
                              count > 0
                                ? "var(--accent-success)"
                                : "var(--text-muted)",
                          }}
                        >
                          {count > 0 ? count : "--"}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Merge warnings */}
                {result.data.mergeWarnings && result.data.mergeWarnings.length > 0 && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.06)",
                      border: "1px solid rgba(245, 158, 11, 0.15)",
                      color: "var(--accent-warning)",
                    }}
                  >
                    <span className="font-semibold">
                      {result.data.mergeWarnings.length} merge warning
                      {result.data.mergeWarnings.length !== 1 ? "s" : ""}:
                    </span>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {result.data.mergeWarnings.slice(0, 10).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {result.data.mergeWarnings.length > 10 && (
                        <li>...and {result.data.mergeWarnings.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview table */}
                <KenPomPreviewTable teams={result.data.teams} />

                {/* Errors */}
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

        {/* Commit result */}
        {commitResult && (
          <div className="mt-2">
            {commitResult.success && commitResult.data ? (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-success)",
                  backgroundColor: "rgba(52, 211, 153, 0.08)",
                  border: "1px solid rgba(52, 211, 153, 0.2)",
                }}
              >
                <div className="font-semibold mb-1">
                  {commitResult.data.teamSeasonsUpserted} teams saved to database
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {commitResult.data.teamsUpserted} team records |{" "}
                  {commitResult.data.teamSeasonsUpserted} season records |{" "}
                  {commitResult.data.nameMappingsUpserted} name mappings
                  {commitResult.data.errors.length > 0 && (
                    <span style={{ color: "var(--accent-warning)" }}>
                      {" "}| {commitResult.data.errors.length} warning(s)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-danger)",
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                }}
              >
                {commitResult.error || "Save failed."}
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

function EvanMiyaPreviewTable({ teams }: { teams: Array<Record<string, unknown>> }) {
  if (!teams || teams.length === 0) return null;

  const preview = teams.slice(0, 5);

  const getValue = (team: Record<string, unknown>, path: string): unknown => {
    const parts = path.split(".");
    let current: unknown = team;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  const columns: { path: string; label: string; format?: "number" }[] = [
    { path: "team.name", label: "Team" },
    { path: "ratings.evanmiya.adjOE", label: "OBPR", format: "number" },
    { path: "ratings.evanmiya.adjDE", label: "DBPR", format: "number" },
    { path: "ratings.evanmiya.adjEM", label: "BPR", format: "number" },
    { path: "evanmiyaOpponentAdjust", label: "OppAdj", format: "number" },
    { path: "evanmiyaPaceAdjust", label: "PaceAdj", format: "number" },
    { path: "evanmiyaKillShotsPerGame", label: "KS/G", format: "number" },
    { path: "evanmiyaKillShotsAllowedPerGame", label: "KSA/G", format: "number" },
    { path: "evanmiyaKillShotsMargin", label: "KS±", format: "number" },
  ];

  const visibleColumns = columns.filter((col) =>
    preview.some((t) => {
      const v = getValue(t, col.path);
      return v !== undefined && v !== null && v !== "";
    })
  );

  if (visibleColumns.length === 0) return null;

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
                key={col.path}
                className="text-left px-2 py-1.5 border-b whitespace-nowrap"
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
              {visibleColumns.map((col) => {
                const val = getValue(row, col.path);
                let display = "-";
                if (val !== undefined && val !== null && val !== "") {
                  if (col.format === "number" && typeof val === "number") {
                    display = val.toFixed(1);
                  } else {
                    display = String(val);
                  }
                }
                return (
                  <td
                    key={col.path}
                    className="px-2 py-1 border-b whitespace-nowrap"
                    style={{
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvanMiyaPanel({ adminKey }: { adminKey: string }) {
  const [season, setSeason] = useState(2026);
  const [csvContent, setCsvContent] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [status, setStatus] = useState<SourceStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [commitStatus, setCommitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileLoaded = csvContent.trim().length > 0;

  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent((e.target?.result as string) || "");
      setCsvFileName(file.name);
      // Reset validation & commit state when file changes
      setResult(null);
      setCommitResult(null);
      setCommitStatus("idle");
      setStatus("idle");
    };
    reader.readAsText(file);
  }, []);

  const handleValidate = async () => {
    if (!fileLoaded) return;
    setStatus("loading");
    setResult(null);
    setCommitResult(null);
    setCommitStatus("idle");

    try {
      const resp = await fetch("/api/admin/import/evanmiya", {
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

  const handleCommit = async () => {
    if (!result?.data?.teams) return;
    setCommitStatus("loading");
    setCommitResult(null);

    try {
      const resp = await fetch("/api/admin/import/evanmiya/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ season, teams: result.data.teams }),
      });

      const data: CommitResult = await resp.json();
      setCommitResult(data);
      setCommitStatus(data.success ? "success" : "error");
    } catch (err) {
      setCommitResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      setCommitStatus("error");
    }
  };

  const canCommit =
    result?.success &&
    result.data?.validation?.valid &&
    commitStatus !== "success";

  return (
    <PanelCard title="Evan Miya Import" status={status}>
      <div className="space-y-4">
        <SeasonSelector value={season} onChange={setSeason} />

        {/* CSV file upload */}
        <div
          className="rounded-lg border p-3 cursor-pointer transition-colors"
          style={{
            borderColor: isDragging
              ? "var(--accent-primary)"
              : fileLoaded
              ? "var(--accent-success)"
              : "var(--border-default)",
            backgroundColor: isDragging
              ? "rgba(74, 144, 217, 0.06)"
              : "var(--bg-elevated)",
            borderStyle: fileLoaded ? "solid" : "dashed",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) readFile(file);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: fileLoaded
                    ? "var(--accent-success)"
                    : "var(--text-muted)",
                }}
              />
              <span
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                Evan Miya CSV
                <span
                  className="ml-1 text-xs"
                  style={{ color: "var(--accent-danger)" }}
                >
                  *
                </span>
              </span>
            </div>
            <span
              className="text-xs flex-shrink-0"
              style={{ color: fileLoaded ? "var(--accent-success)" : "var(--text-muted)" }}
            >
              {fileLoaded ? "Loaded" : "Not loaded"}
            </span>
          </div>
          {fileLoaded && csvFileName && (
            <div
              className="mt-1 text-xs font-mono truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {csvFileName}
            </div>
          )}
          {!fileLoaded && (
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              BPR ratings, opponent/pace adjustments, kill shots
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={status === "loading" || !fileLoaded}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "#fff",
            }}
          >
            {status === "loading" && <Spinner />}
            Validate & Preview
          </button>

          {canCommit && (
            <button
              onClick={handleCommit}
              disabled={commitStatus === "loading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-success)",
                color: "#fff",
              }}
            >
              {commitStatus === "loading" && <Spinner />}
              {commitStatus === "loading"
                ? "Saving..."
                : "Confirm & Save to Database"}
            </button>
          )}
        </div>

        {/* Validation result */}
        {result && (
          <div className="mt-2">
            {result.success && result.data ? (
              <div className="space-y-3">
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

                <EvanMiyaPreviewTable teams={result.data.teams} />
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

        {/* Commit result */}
        {commitResult && (
          <div className="mt-2">
            {commitResult.success && commitResult.data ? (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-success)",
                  backgroundColor: "rgba(52, 211, 153, 0.08)",
                  border: "1px solid rgba(52, 211, 153, 0.2)",
                }}
              >
                <div className="font-semibold mb-1">
                  {commitResult.data.teamSeasonsUpserted} teams saved to database
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {commitResult.data.teamsUpserted} team records |{" "}
                  {commitResult.data.teamSeasonsUpserted} season records |{" "}
                  {commitResult.data.nameMappingsUpserted} name mappings
                  {commitResult.data.errors.length > 0 && (
                    <span style={{ color: "var(--accent-warning)" }}>
                      {" "}| {commitResult.data.errors.length} warning(s)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  color: "var(--accent-danger)",
                  backgroundColor: "rgba(239, 68, 68, 0.06)",
                }}
              >
                {commitResult.error || "Save failed."}
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

      {/* KenPom - full width */}
      <div className="mb-6">
        <KenPomPanel adminKey={adminKey} />
      </div>

      {/* Other sources - 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TorvikPanel adminKey={adminKey} />
        <EvanMiyaPanel adminKey={adminKey} />
      </div>
    </div>
  );
}
