/**
 * Design token constants for JavaScript contexts.
 *
 * These mirror the CSS custom properties defined in `globals.css`.
 * Use these in components that pass colors as JS strings (e.g. Recharts
 * SVG props) instead of hardcoding hex values.
 *
 * IMPORTANT: Keep these in sync with `src/app/globals.css :root`.
 */

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

export const BG_PRIMARY = "#0a0a0f";
export const BG_SECONDARY = "#12121a";
export const BG_SURFACE = "#1a1a26";
export const BG_ELEVATED = "#222233";

// ---------------------------------------------------------------------------
// Borders
// ---------------------------------------------------------------------------

export const BORDER_SUBTLE = "#2a2a3d";
export const BORDER_DEFAULT = "#3a3a52";
export const BORDER_PRIMARY = "#3a3a52";

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const TEXT_PRIMARY = "#e8e8ed";
export const TEXT_SECONDARY = "#9898a8";
export const TEXT_MUTED = "#9090a3";

// ---------------------------------------------------------------------------
// Accents
// ---------------------------------------------------------------------------

export const ACCENT_PRIMARY = "#4a90d9";
export const ACCENT_SUCCESS = "#34d399";
export const ACCENT_WARNING = "#f59e0b";
export const ACCENT_DANGER = "#ef4444";
export const ACCENT_INFO = "#818cf8";

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Monospace font stack — matches `--font-mono` in globals.css. */
export const FONT_MONO =
  '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace';
