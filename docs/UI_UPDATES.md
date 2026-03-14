# UI Updates

Tracking planned UI improvements, design decisions, and execution direction for BracketLab.

---

## 1. Live Probability Preview on Lever Changes

### Problem

When users adjust levers (Four Factors weights, experience, continuity, etc.), there is no visual feedback until the full Monte Carlo simulation is re-run. A user can tweak 8 sliders and have no idea whether they moved a probability by 0.01 or 5 points. This makes the lever system feel disconnected and opaque.

### Decision

**Live probability preview** — recompute and display updated win probabilities on all visible matchups in real-time as levers change, without requiring a full simulation re-run.

### Why This Approach

- `resolveMatchup()` is computationally cheap (lever adjustments + logistic function). Recomputing all 63 matchups on every lever change is near-instant.
- The full Monte Carlo simulation (10K–100K iterations) remains an intentional, heavyweight action for path probabilities and propagated downstream effects.
- Live preview gives immediate, intuitive feedback: the bracket visually reacts to lever changes.
- Requires clear visual distinction between "preview" (pre-simulation estimate) and "confirmed" (post-simulation) probabilities so users understand they still need to re-simulate for full path propagation.

### Alternatives Considered

1. **Delta indicators only** — Show `+1.2` / `-0.5` deltas next to each probability after lever changes. Subtle and low-noise, but less intuitive than seeing the actual probability update.
2. **Lever impact summary panel** — Tooltip or panel on each lever showing which matchups are most affected. More educational but heavier UI, and doesn't directly answer "what happened to my bracket?"

### Implementation Notes

- Preview probabilities should be visually distinguished (e.g., dotted border, muted color, or "estimated" label) until the next simulation confirms them.
- Path probabilities (chance of reaching Sweet 16, Final Four, etc.) cannot be previewed without full simulation — only single-matchup win probabilities update live.
- Consider debouncing the recomputation if slider drag performance becomes an issue (unlikely given the lightweight math).

---

## 2. First-Load Experience — Empty Bracket Problem

### Problem

A first-time user lands on the bracket page and sees 64 team names and seeds with no context about what to do next. No onboarding, no demo mode, no pre-filled example. The lever panel, simulation button, and guidance system are all present but nothing communicates the workflow or what makes the tool valuable. The User Guide exists but requires deliberate navigation to find.

### Decision

**Pre-computed probabilities on first load** — rather than showing a bare bracket, run a default simulation server-side (or cache one with default lever settings) so the user lands on a bracket that already has probability bars, color-coded favorites, and visible win percentages. The data itself becomes the onboarding: the user immediately sees that a 5-12 matchup is closer than expected, or that a particular 3-seed is fragile, and starts clicking.

Additionally, **surface the Guide more prominently** — the existing User Guide content is solid but buried behind a navbar link. A more visible entry point (e.g., a persistent "Guide" affordance in the bracket header, a first-visit callout, or contextual "learn more" links near key UI elements like levers and the simulation button) would help users who want deeper understanding find it without requiring them to go looking.

### Why This Approach

- Aligns with the Baseball Savant design philosophy: the data is the star, and the visualization communicates what the tool does without a tutorial.
- Solves both the "empty" problem and the "no context" problem simultaneously — the user sees the probability engine at work from the first moment.
- A pre-computed simulation is low-friction: the user can immediately start modifying picks and adjusting levers rather than building from zero before seeing any output.
- Surfacing the Guide more prominently is a lightweight complement — it helps users who want to go deeper without adding noise for users who prefer to explore.

### Alternatives Considered

1. **Contextual empty states** — Faint inline hints ("Click to pick", arrow indicators) at unpicked matchups that fade after first interaction. Low-noise but doesn't solve the deeper problem of the tool not demonstrating its value on first load.
2. **Quick-start banner** — A single dismissable bar: "Pick winners. Adjust levers. Run simulation." Minimal but doesn't show the user what the output looks like.
3. **Pre-filled demo bracket** — Chalk picks pre-loaded so the user sees the full system working. Risk: users might not realize they need to make their own picks, or might feel the tool is prescriptive rather than exploratory.

### Implementation Notes

- The pre-computed simulation could be generated at build time or cached server-side with default lever settings and no picks (just raw probabilities per matchup).
- Need to distinguish "default simulation" state from "user has run their own simulation" state — possibly a subtle indicator or a prompt to re-simulate after making picks.
- Guide visibility improvements should feel native to the UI, not like a pop-up tutorial. Contextual links near levers/simulation button are preferable to modals or walkthroughs.

---

## 3. Styling Convention — Unify on CSS Modules

### Problem

The codebase uses three different styling approaches with no clear convention for when to use which:

- **Inline `style={{}}` objects** — BracketGrid, BracketShell, Navbar, home page. Co-located and works for dynamic values, but verbose, and hover/focus/responsive states are impossible without workarounds.
- **Tailwind utilities** — Admin layout, auth pages, some components. Good for rapid prototyping but fights with the CSS variable theming system (`var(--bg-primary)`, etc.) that drives the dark-mode-first design.
- **`<style jsx>` blocks** — MatchupView, some overlays. Scoped CSS with pseudo-class support, but adds a library dependency and feels like a third paradigm alongside the other two.

This inconsistency is the biggest maintenance drag. A developer touching any component has to first figure out which styling approach it uses, then work within that paradigm — or introduce a fourth hybrid.

### Decision

**CSS Modules as the primary styling approach.** Inline styles are permitted only for truly dynamic values (e.g., a probability bar width computed from data).

- **CSS Modules** (`.module.css` co-located with components): All static styles, pseudo-classes (`:hover`, `:focus`), media queries, transitions, and CSS variable references.
- **Inline `style={{}}`**: Only for values that depend on runtime data (e.g., `width: \`${probability * 100}%\``). Never for static layout, colors, or typography.
- **Tailwind**: Phase out. The CSS variable theming system is the source of truth for colors and spacing; Tailwind adds a competing abstraction.
- **`<style jsx>`**: Phase out entirely. Everything it does, CSS Modules do with better tooling support and no library dependency.

### Why This Approach

- CSS Modules are natively supported by Next.js — zero config, zero dependencies.
- They pair naturally with the existing CSS variable system that drives theming.
- Scoped class names prevent style collisions without runtime overhead.
- Full access to pseudo-classes, media queries, transitions, and animations — all things the app needs for the Baseball Savant-level polish we're targeting.
- Co-location is clean: `TeamCard.tsx` next to `TeamCard.module.css`.
- Dynamic values (the one thing CSS can't do) stay as inline styles — a clear, narrow rule.

### Migration Plan

This is a deliberate conversion, not an opportunistic one. Since the component set is largely stable, we should convert existing components in a focused pass rather than waiting to touch them organically. Order of conversion:

1. **Establish the convention** — document the rules (this section), create one reference component as the exemplar.
2. **Core bracket components** — BracketGrid, TeamCard, MatchupSlot, RegionBracket, FinalFour. These are the most-viewed, most-complex components and benefit the most.
3. **Panels and overlays** — LeverPanel, SimulationResultsOverlay, GuidancePanel, MatchupView.
4. **Navigation and layout** — Navbar, BracketShell header, home page, auth pages.
5. **Admin pages** — Lower priority since they're internal-facing.

Each conversion should be a discrete commit with its tests passing — not a single massive refactor.

---

## 4. Bracket View Visual Uplift — "Wow Before Simulation"

### Problem

The matchup view is excellent — 2rem hero probability numbers, blue/red accent duality, animated comparison bars, streaming AI narrative, a distribution chart. It feels like a sophisticated analytical tool. The bracket view, by contrast, is structurally correct but visually flat. The specific gaps:

- **Typography scale**: The bracket's largest data is 10px font-mono win percentages. There is no "hero" number. The matchup view leads with 2rem 800-weight probabilities.
- **Connector lines are incomplete**: RegionBracket draws only vertical bars — no horizontal joining segments. The bracket reads as stacked boxes rather than a connected tournament tree.
- **Monochromatic color**: The bracket uses three background levels and one accent color (blue left border on winners). The matchup view uses blue/red duality prominently on every probability, bar, and value.
- **No interactivity signals**: The matchup detail link is a 20px-wide strip at opacity 0 with a 5px chevron. Nothing communicates "click this matchup for a deep dive."
- **Almost no animation**: One connector color transition (0.2s ease) vs five distinct animations in the matchup view. The ChampionCard glow is the sole exception — and it proves the bracket *can* have visual punch.
- **No visual payoff before simulation**: Without pre-computed probabilities (see item 2), first load shows no probability bars, no color coding, no data visualization at all.

### Decision

Bring the bracket view's visual quality up to the matchup view's level while preserving its data density. The bracket should feel like an analytical dashboard, not a form to fill out. Specific improvements:

**Connector overhaul** — Draw proper L-shaped bracket connector lines (horizontal from game to column edge, vertical between feeders). These should feel like an actual tournament bracket poster. Color connectors by the advancing team's accent when a pick is made.

**Probability as visual language** — Make probability bars thicker and more readable (at least 4–6px). Use a competitive color split (blue/red or similar duality) rather than the current red/amber/green threshold. Win probability numbers should be more prominent — closer to 12–13px rather than 10px.

**Hover previews** — Hovering a matchup slot shows a compact probability comparison (both teams' win percentages, the spread) without opening the full matchup view. This creates a "peek" that rewards exploration and signals depth.

**Competitiveness heat** — Matchup slots with close probabilities (45–55%) should have a subtle visual signal (e.g., a warm border, a slight glow, or a "toss-up" indicator). This draws the eye to the interesting games.

**Entry animation** — Staggered reveal on bracket load: teams appear round-by-round with a fast cascade, probability bars fill in. This creates a moment of visual engagement on first visit that communicates "this is a dynamic tool."

**Simulation integration** — After simulation runs, the bracket itself becomes richer: path probabilities appear as team-colored traces through the bracket tree, round survival rates overlay each connector, and the overall visual intensity increases to reward the user for running the simulation.

### Why This Approach

- The matchup view already proves the design language works. The bracket view just needs to adopt the same principles: strong typography hierarchy, accent color duality, animation on state changes, and data as visual spectacle.
- The Baseball Savant reference is key — Savant's home page is a bracket-like density of information that is visually arresting because every data point has color, scale, and position working together. The current bracket has position but lacks color and scale.
- These changes compound with items 1 and 2: pre-computed probabilities (item 2) populate the visual layer, live preview (item 1) makes it reactive, and the visual uplift makes both of those features feel polished rather than bolted on.

### Implementation Notes

- The connector overhaul is the highest-impact single change — it transforms the bracket from "boxes on a page" to "a tournament bracket."
- Hover previews need to be performant since they fire on mouse movement. The probability data is already available in context; the preview is pure rendering.
- Entry animations should be fast (200–400ms total cascade) and respect `prefers-reduced-motion`.
- The competitive heat signal should be derived from the probability model, not hardcoded thresholds.

---

## Overall UI Direction

These four items are not independent improvements — they are phases of a single transformation that converts BracketLab from a functional tool into a polished analytical experience. They should be executed in a deliberate sequence where each phase builds on the last:

### Phase 1: Foundation — CSS Modules Migration (Item 3)

Before we can iterate on visual quality, the styling system needs to be unified. Converting to CSS Modules gives us proper access to hover states, transitions, media queries, and keyframe animations — all of which the bracket view currently lacks because inline styles can't express them. This phase is mechanical but essential: it unblocks everything that follows.

**Scope**: Convert all components to CSS Modules + inline-only-for-dynamic-values. One component at a time, each a discrete commit. Start with a reference exemplar, then work through the bracket components, panels, navigation, and admin pages.

### Phase 2: Data Layer — Live Preview + Pre-Computed First Load (Items 1 & 2)

With CSS Modules in place, implement the live probability preview (item 1) and pre-computed first-load simulation (item 2) together. These are complementary: the first load populates the bracket with data, and the live preview keeps it reactive as levers change. Together, they ensure the bracket is never visually empty.

**Scope**: Add a `usePreviewProbabilities` hook that recomputes matchup probabilities from the current lever config without full simulation. Server-side, generate a default simulation result that ships with the initial page load. Visually distinguish preview vs confirmed probabilities.

### Phase 3: Visual Uplift — Bracket View "Wow" (Item 4)

With the data layer in place and CSS Modules enabling proper styling, execute the visual improvements: connector overhaul, typography scale increase, probability bar redesign, hover previews, competitiveness heat, entry animations, and post-simulation visual enrichment. This is where the bracket view catches up to the matchup view.

**Scope**: This is the largest phase and can be broken into sub-passes — connectors first (highest impact), then probability visuals, then hover/animation polish.

### Design Principles Across All Phases

- **Data is the star**: Every visual choice should make the data more readable, more comparative, or more engaging. Decoration without information is noise.
- **Baseball Savant density**: High information density that feels organized, not cluttered. Tight spacing, monospace numbers, tabular alignment.
- **Dark mode first**: All colors, contrasts, and shadows are designed for the dark theme. Light mode (if ever added) is a secondary adaptation.
- **CSS variables are the design system**: `var(--bg-primary)`, `var(--accent-primary)`, etc. are the single source of truth. Components never hardcode colors.
- **Progressive richness**: The UI gets richer as the user engages. First load shows probabilities. Making picks adds connector color. Running simulation adds path traces and survival rates. Each action is visually rewarded.
- **Animations are purposeful**: Entry reveals, state transitions, hover previews. Never decorative loops. Always respect `prefers-reduced-motion`.
