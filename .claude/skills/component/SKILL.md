---
name: component
description: Create React components following project conventions (dark mode, CSS variables, TypeScript, Tailwind + styled-jsx). Use when building new UI components for the bracket app.
argument-hint: <ComponentName> [--dir=bracket|ui|levers|matchup]
---

# Component Creation Skill

Create a React component named `$ARGUMENTS` following all project conventions.

## Before Writing Code

1. **Read type files** to understand available data structures:
   - `src/types/team.ts` — TeamSeason, Team, TournamentEntry, Seed, Region
   - `src/types/engine.ts` — GlobalLevers, MatchupOverrides, CompositeWeights
   - `src/types/bracket-ui.ts` — BracketState, BracketAction, MatchupDisplayData
   - `src/types/simulation.ts` — SimulationResult, TeamSimulationResult
2. **Search for similar components** in `src/components/` to avoid duplication
3. **Check existing hooks** in `src/hooks/` for state access patterns

## File Placement

Place the component based on its purpose:

| Directory | When to use |
|-----------|------------|
| `src/components/ui/` | Generic reusable primitives (buttons, inputs, tooltips) |
| `src/components/bracket/` | Bracket display components (team cards, matchup views) |
| `src/components/levers/` | Lever/slider control components |
| `src/components/matchup/` | Matchup detail view components |
| `src/components/providers/` | React context providers |

Override with `--dir=` argument if provided.

## File Structure (follow exactly)

```tsx
"use client";
// ↑ ONLY include if the component uses hooks, event handlers, or browser APIs.
// Omit for purely presentational components.

import { useState, useCallback, memo } from "react";
import type { TeamSeason } from "@/types/team";
// ↑ Always use `import type` for type-only imports

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComponentNameProps {
  /** Description of this prop */
  propName: string;
  /** Optional prop with default */
  size?: "sm" | "md" | "lg";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper function description */
function helperFunction(): string {
  return "value";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Brief description of what this component does.
 *
 * Additional context: dimensions, CSS variables used, special behaviors.
 */
export function ComponentName({ propName, size = "md" }: ComponentNameProps) {
  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

### Section Dividers

Use this exact format for section headers:
```
// ---------------------------------------------------------------------------
// Section Name
// ---------------------------------------------------------------------------
```

## Styling Rules (CRITICAL)

This project uses THREE styling methods. Follow these rules exactly:

### 1. Tailwind — for layout and spacing ONLY
```tsx
className="flex items-center gap-2 px-2 py-1.5 rounded"
className="text-xs font-semibold font-mono tabular-nums"
className="w-full h-1.5 rounded-full"
```

### 2. Inline styles with CSS variables — for ALL colors and theming
```tsx
style={{ color: "var(--text-primary)" }}
style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
style={{ borderLeft: "2px solid var(--accent-primary)" }}
```

### 3. styled-jsx — for complex selectors, pseudo-elements, animations
```tsx
<style jsx>{`
  .my-component {
    color: var(--text-primary);
  }
  .my-component:hover {
    background-color: var(--bg-elevated);
  }
`}</style>
```

### ⛔ NEVER do these:
- **Never hardcode colors**: No `bg-blue-500`, no `text-gray-300`, no `#4a90d9`
- **Never use Tailwind color utilities**: No `text-red-500`, no `border-blue-600`
- **Never use CSS-in-JS libraries**: No styled-components, no emotion

### CSS Variable Palette

```
Backgrounds:
  --bg-primary:   #0a0a0f  (darkest, page background)
  --bg-secondary: #12121a  (secondary areas)
  --bg-surface:   #1a1a26  (cards, panels)
  --bg-elevated:  #222233  (hover states, active elements)

Borders:
  --border-subtle:  #2a2a3d  (subtle dividers)
  --border-default: #3a3a52  (standard borders)
  --border-primary: #4a4a66  (emphasized borders)

Text:
  --text-primary:   #e8e8ed  (main text, headings)
  --text-secondary: #9898a8  (secondary text, descriptions)
  --text-muted:     #6a6a7d  (hints, placeholders, disabled)

Accents:
  --accent-primary: #4a90d9  (blue — buttons, links, selections)
  --accent-success: #34d399  (green — success states, positive values)
  --accent-warning: #f59e0b  (amber — warnings, mid-range values)
  --accent-danger:  #ef4444  (red — errors, danger, low values)
  --accent-info:    #818cf8  (indigo — informational)

Transitions:
  --transition-fast:   150ms ease
  --transition-normal: 250ms ease
```

## Type Conventions

- **Always** use `import type { ... }` for types (not `import { ... }`)
- **Props interface**: Named `ComponentNameProps`, JSDoc comment on every prop
- **Reference existing types** from `src/types/` — never redefine types that already exist
- **Use discriminated unions** for variant props:
  ```tsx
  type Variant = "default" | "compact" | "expanded";
  ```

## State Access

If the component needs bracket/simulation state:
```tsx
import { useBracket } from "@/hooks/useBracket";

// Inside component:
const { state, dispatch } = useBracket();
```

Available actions (from `BracketAction` union type):
```
ADVANCE_TEAM:           { type: "ADVANCE_TEAM"; gameId: string; teamId: string }
RESET_PICK:             { type: "RESET_PICK"; gameId: string }
SET_GLOBAL_LEVERS:      { type: "SET_GLOBAL_LEVERS"; levers: Partial<GlobalLevers> }
SET_MATCHUP_OVERRIDE:   { type: "SET_MATCHUP_OVERRIDE"; gameId: string; overrides: MatchupOverrides }
REMOVE_MATCHUP_OVERRIDE:{ type: "REMOVE_MATCHUP_OVERRIDE"; gameId: string }
SET_SIMULATION_RESULT:  { type: "SET_SIMULATION_RESULT"; result: SimulationResult }
SET_SIMULATING:         { type: "SET_SIMULATING"; isSimulating: boolean }
LOAD_BRACKET:           { type: "LOAD_BRACKET"; bracket: SavedBracketData }
CLEAR_BRACKET:          { type: "CLEAR_BRACKET" }
MARK_SAVED:             { type: "MARK_SAVED"; bracketId: string }
```

⚠️ Use the exact property names above. Common mistake: using `payload` instead of `levers` for `SET_GLOBAL_LEVERS`.

## Performance

- **`memo()`** — Wrap components rendered many times (e.g., team cards in the bracket — 128+ instances):
  ```tsx
  export const TeamCard = memo(function TeamCard({ ... }: TeamCardProps) { ... });
  ```
- **`useCallback`** — Always wrap handlers passed to child components
- **`useId()`** — For generating unique IDs (SSR-safe, never use `Math.random()`)

## Accessibility

- `aria-label` on icon-only buttons
- `aria-hidden="true"` on decorative SVGs/icons
- `role="status"` on loading indicators
- `role="dialog"` + `aria-modal="true"` on modals/drawers
- `htmlFor={id}` on `<label>` elements
- Use `<button>` for clickable elements (not `<div onClick>`)

## Test File

Create a co-located test file at the same path with `.test.tsx` suffix:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ComponentName } from "./ComponentName";

describe("ComponentName", () => {
  it("renders correctly", () => {
    render(<ComponentName propName="value" />);
    expect(screen.getByText("expected text")).toBeInTheDocument();
  });

  it("handles interaction", () => {
    // Test user-visible behavior, not implementation details
  });
});
```

**Testing rules:**
- Test what the user sees, not internal state
- Use `screen.getByText()`, `screen.getByRole()`, `screen.getByLabelText()`
- If the component needs BracketProvider context, wrap in a test provider

## After Creating Files

1. Run `npx tsc --noEmit` to verify TypeScript compiles
2. Run `npx vitest run` to verify tests pass
3. Suggest where in the app this component should be integrated

## Design Reference

The app follows **Baseball Savant** UX principles:
- Dark mode by default
- Data-dense without feeling cluttered
- Smooth transitions on all interactive elements
- Fast, intentional interactions — every element serves a purpose
- Monospace `font-mono tabular-nums` for numeric data
