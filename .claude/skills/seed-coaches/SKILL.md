---
name: seed-coaches
description: Seed coach tournament experience data from Kaggle into the database. Use before each tournament season to ensure all teams have coach records.
argument-hint: [--season=2026] [--dry-run] [--all-seasons]
---

# Seed Coaches Skill

Seeds coach tournament experience data from the Kaggle March Machine Learning Mania dataset into the Supabase `coaches` table, then links coaches to their `team_seasons` entries.

Use this skill:
- **Before Selection Sunday** — to populate/update coach data for the upcoming tournament
- **After adding new team data** — to ensure newly-added teams have coach records
- **When backtesting** — use `--all-seasons` to seed coaches for all historical seasons

## Usage

```
/seed-coaches --season 2026            # Seed coaches for 2026 (default)
/seed-coaches --season 2026 --dry-run  # Preview without writing to DB
/seed-coaches --all-seasons            # Seed all seasons 2002-2026
```

## What It Does

1. **Reads Kaggle CSVs** from `march-machine-learning-mania-2026/`:
   - `MTeamCoaches.csv` — coach-to-team-to-season assignments
   - `MNCAATourneyCompactResults.csv` — tournament game results
   - `MNCAATourneySlots.csv` — bracket structure
   - `MTeams.csv` — Kaggle team ID to name mapping

2. **Derives cumulative coach stats** as-of each season:
   - Tournament games and wins
   - Final Four appearances
   - Championships
   - Years as D-1 head coach

3. **Matches Kaggle team names to DB teams** using:
   - `normalizeForMerge()` from `src/lib/data/merger.ts` (handles "St."/"St"/"State", "Saint", directional abbreviations, etc.)
   - A Kaggle-specific override table in the script for uniquely-abbreviated names

4. **Upserts coach records** to the `coaches` table (on conflict by name)

5. **Links coaches** to `team_seasons.coach_id` for the target season

## Steps to Run

### Step 1: Run the seeder script

```bash
npx tsx scripts/seed-coaches.ts --seed --season 2026
```

Or preview first:

```bash
npx tsx scripts/seed-coaches.ts --seed --season 2026 --dry-run
```

### Step 2: Verify results

Check the output for:
- **Matched to DB teams**: Should be 360+ for a full D-1 season
- **Seeded to Supabase**: Should match the matched count
- **Unmatched teams**: Should be < 5, all obscure programs

### Step 3: Handle unmatched teams (if needed)

If important teams are unmatched, add their Kaggle name to the `KAGGLE_NAME_OVERRIDES` table in `scripts/seed-coaches.ts`:

```typescript
const KAGGLE_NAME_OVERRIDES: Record<string, string> = {
  // key = lowercase Kaggle name (apostrophes stripped)
  // value = DB canonical name
  "new team abbrev": "Canonical DB Name",
};
```

Then re-run the seeder.

### Step 4: Verify in app

The bracket page at `/bracket` should now show coach data for all teams. Check the matchup view for coach tournament experience display.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/seed-coaches.ts` | Main seeder script (Kaggle → Supabase) |
| `src/lib/data/merger.ts` | `normalizeForMerge()` — team name normalization rules |
| `src/lib/data/merger.test.ts` | Tests for name normalization |
| `march-machine-learning-mania-2026/` | Kaggle dataset directory |
| `data/coach-snapshots.json` | Generated JSON with all coach-season snapshots |

## Database Schema

### `coaches` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `name` | TEXT | Unique — used as upsert key |
| `tournament_games` | INT | Cumulative tournament games coached |
| `tournament_wins` | INT | Cumulative tournament wins |
| `final_fours` | INT | Number of Final Four appearances |
| `championships` | INT | Number of championships won |
| `years_head_coach` | INT | Total years as D-1 head coach |

### `team_seasons` table (linked)
| Column | Type | Notes |
|--------|------|-------|
| `coach_id` | UUID | FK to `coaches.id`, nullable |

## Troubleshooting

**"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"**
- Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**"Data directory not found"**
- Download the Kaggle March Machine Learning Mania dataset to `march-machine-learning-mania-2026/`

**Important teams showing as unmatched**
- Add a Kaggle name override in `KAGGLE_NAME_OVERRIDES` in `scripts/seed-coaches.ts`
- Or add normalization rules in `src/lib/data/merger.ts` if the pattern is shared across sources

**Coach data not appearing in UI**
- Verify `team_seasons.coach_id` is linked: check that the seeder output shows "Seeded to Supabase" count > 0
- The app reads coach data via the `team_seasons` → `coaches` join
