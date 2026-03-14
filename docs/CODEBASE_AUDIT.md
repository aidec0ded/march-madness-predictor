# Codebase Audit — March 2026

Comprehensive review of code quality, security, usability, and design coherence.

---

## Grades

| Category                 | Grade | Notes                                                        |
| ------------------------ | ----- | ------------------------------------------------------------ |
| Code Quality & Architecture | B+    | Well-organized, strong types, good hook patterns             |
| Security                 | B-    | Rate limiting + sanitizers present; gaps in picks, backtest, admin |
| Usability & Design       | B     | Dark mode palette cohesive; probability UX solid; minor bugs |
| Design System Coherence  | C+    | ~50% CSS Modules migration; large inline-style holdouts      |

---

## Code Quality & Architecture (B+)

**Strengths:**
- Clean `src/` layout with clear separation: `types/`, `lib/engine/`, `lib/supabase/`, `hooks/`, `components/`, `app/api/`
- Strong TypeScript types — `EngineConfig`, `GlobalLevers`, `BracketMatchup`, `SimulationResult` are well-defined with clear documentation
- React hooks used appropriately: `useBracket` (context), `useGameProbabilities` (derived computation), `useContestStrategy` (game theory), `useMediaQuery` (responsive)
- Memoization applied correctly with proper dependency arrays
- Structured logging via `logger` instead of raw `console.error` (mostly)
- Co-located test files with good coverage

**Weaknesses:**
- `fetchSimulationData()` logic duplicated across `simulate/route.ts`, `simulate/stream/route.ts`, and partially in `backtest/route.ts` (~100 lines of identical Supabase queries + transforms)
- `useGameProbabilities()` called independently in `BracketGrid`, `RegionBracket` (×4 regions), and `MobileBracketView` — 6× redundant computation of the same data
- `resolveEngineConfig()` function duplicated in simulate and backtest routes
- `BracketShell.tsx` has 3 identical inline style blocks for toggle buttons (~50 lines of duplication)
- Dead ternary in BracketShell: `{isMobile ? "Guide" : "Guide"}` — both branches identical

---

## Security (B-)

**Strengths:**
- Rate limiting on all public API routes via `createRateLimiter`
- `sanitizeEngineConfig()` and `sanitizeMatchupOverrides()` clamp all numeric values to safe ranges and strip unknown keys
- `createPublicClient()` uses anon key + RLS instead of admin service role key
- `safeApiError()` utility prevents DB schema details from leaking to clients
- Constant-time comparison for admin API key validation
- `isAdmin()` supports both Supabase Auth and API key fallback

**Gaps found:**
1. **`picks` object unsanitized** — Both simulate routes accept `picks: Record<string, string>` with only a `typeof === "object"` check. No cap on entry count, no key/value format validation. An attacker could send a massive object or inject arbitrary strings.
2. **Backtest route skips `sanitizeEngineConfig()`** — The backtest route passes `engineConfig` through as-is after a shallow type check, unlike the simulate routes which call the deep sanitizer.
3. **Admin routes have no middleware protection** — Admin routes rely on per-route `isAdmin()` calls. If a developer adds a new admin route and forgets the check, it's open. The middleware protects `/dashboard`, `/settings`, `/brackets` but not `/api/admin/*`.
4. **Admin import routes use `console.error` + leak `error.message`** — KenPom, Torvik, and Evan Miya import routes use `console.error` instead of structured `logger.error`, and return raw `error.message` to the client (e.g., `error instanceof Error ? error.message : "..."`).

---

## Usability & Design (B)

**Strengths:**
- Baseball Savant-inspired dark mode palette is cohesive and data-dense without clutter
- Bracket fork connectors with LTR/RTL support for the inward-folding bracket layout
- Hover tooltips showing spread classification + path probabilities
- Live probability preview updates as picks are made (before simulation)
- Staggered entry animations with `prefers-reduced-motion` support
- Blue/red probability duality (danger < 40%, warning 40-60%, primary > 60%)
- Competitiveness heat (amber border + glow on close matchups)

**Issues found:**
1. **`probability * 5` hack** in `SimulationResultsOverlay` — Championship probability bars use `entry.probability * 5` to scale the ProbabilityBar. Any probability > 20% clips to 100% width, making 25% and 50% look identical. Should normalize against the top contender's probability instead.
2. **No debounce on lever slider dispatch** — Each slider `onChange` fires `SET_GLOBAL_LEVERS` on every mouse-move tick, triggering full re-renders of the bracket. Needs ~150-200ms debounce.
3. **Global `*` transition without reduced-motion override** — `globals.css` applies `transition: background-color 0.2s, border-color 0.2s, color 0.2s` to all elements. No `@media (prefers-reduced-motion: reduce)` guard means users who prefer reduced motion still see constant micro-transitions.

---

## Design System Coherence (C+)

**Strengths:**
- CSS custom properties for colors, borders, backgrounds are consistently used
- CSS Modules successfully adopted for bracket components (RegionBracket, BracketGrid, MatchupSlot, TeamCard, ProbabilityBar, FinalFour, FirstFour)
- Clean responsive breakpoints via `useMediaQuery` hook

**Issues found:**
1. **~50% CSS Modules migration** — Bracket components use CSS Modules, but lever components, overlays, and shell use styled-jsx or inline styles
2. **SimulationResultsOverlay (460 lines)** is entirely inline styles — zero CSS class references, every style is a `style={{}}` object literal. Largest styling debt in the codebase.
3. **LeverSlider, LeverPanel, CompositeWeightsControl** all use styled-jsx — a third styling approach alongside CSS Modules and inline styles
4. **`--text-muted: #7a7a8d`** — Fails WCAG AA contrast (4.5:1 required) against `--bg-primary: #0a0a0f`. Computed ratio is ~3.8:1. Needs to be bumped to `#9090a3` (~5.2:1).

---

## Top 10 Fixes (Priority Order)

| # | Fix | Category | Impact |
|---|-----|----------|--------|
| 1 | Sanitize `picks` in simulate routes | Security | High — unsanitized user input in critical path |
| 2 | Add `sanitizeEngineConfig()` to backtest route | Security | High — inconsistent sanitization |
| 3 | Extract shared `fetchSimulationData()` helper | Maintenance | Medium — eliminates 100+ lines of duplication |
| 4 | Compute `useGameProbabilities` once, pass as prop | Performance | Medium — removes 6× redundant computation |
| 5 | Add debounce to lever slider dispatch | Performance | Medium — prevents render storms during slider drag |
| 6 | Fix `probability * 5` hack in SimulationResultsOverlay | Bug | Medium — incorrect visual representation |
| 7 | Add middleware-level protection for `/api/admin/*` | Security | Medium — defense in depth |
| 8 | Switch admin import routes to `logger.error` + `safeApiError` | Security | Low — prevents error detail leakage |
| 9 | Fix `--text-muted` contrast ratio | Accessibility | Low — WCAG AA compliance |
| 10 | Migrate SimulationResultsOverlay to CSS Modules | Consistency | Low — largest inline-style debt |

---

## Verdict

**This is not a vibe-coding nightmare.** The codebase is well-structured with genuine architectural thought — proper type safety, context-based state management, memoization, structured logging, and rate limiting. The probability engine is clean with separated concerns (matchup resolution, Monte Carlo simulation, bracket building, site mapping).

The main debts are: (1) incomplete CSS Modules migration creating three parallel styling approaches, (2) a handful of security gaps in input sanitization, and (3) some code duplication in API routes. All are addressable without architectural changes.
