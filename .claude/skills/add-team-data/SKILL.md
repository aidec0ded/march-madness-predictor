---
name: add-team-data
description: Structured team data ingestion with schema validation. Use when adding or updating team stats from KenPom, Torvik, or Evan Miya sources.
argument-hint: <source> [--team=TeamName] [--season=2026] [--file=path/to/csv]
---

# Add Team Data Skill

Ingest team data from `$ARGUMENTS` into the database with full schema validation.

## Supported Sources

| Source | Format | Ingestion Method |
|--------|--------|------------------|
| KenPom | CSV file | Parse CSV → normalize → validate → upsert |
| Torvik | Static CSV / API | Fetch or parse → normalize → validate → upsert |
| Evan Miya | Manual entry | Build TeamSeason fields → validate → upsert |

## Steps

### 1. Determine Source and Data

Parse arguments for:
- `source`: "kenpom", "torvik", or "evanmiya"
- `--team`: Single team name (for manual entry)
- `--season`: Year (default: 2026)
- `--file`: Path to CSV file (for KenPom/Torvik)

### 2. Parse Raw Data

**KenPom CSV:**
```typescript
import { parseKenPomCsv } from "@/lib/data/csv-parser";
import type { KenPomRawRow } from "@/types/data-import";

// Parse the CSV file
const rawRows: KenPomRawRow[] = parseKenPomCsv(csvContent);
```

**Torvik:**
```typescript
import { fetchTorvikData } from "@/lib/data/fetchers/torvik";

// Fetch from static CSV files
const rawRows = await fetchTorvikData(season);
```

**Evan Miya (manual):**
```typescript
import type { EvanMiyaRawRow } from "@/types/data-import";

// Build manually from provided stats
const raw: EvanMiyaRawRow = {
  team: "Team Name",
  bpr: 15.2, // Bayesian Performance Rating
  // ... other fields
};
```

### 3. Normalize to TeamSeason Schema

```typescript
// KenPom
import { normalizeKenPomData } from "@/lib/data/normalizers/kenpom";
const { data, errors } = normalizeKenPomData(rawRows);

// Torvik
import { normalizeTorvikData } from "@/lib/data/normalizers/torvik";
const { data, errors } = normalizeTorvikData(rawRows);

// Evan Miya
import { normalizeEvanMiyaData } from "@/lib/data/normalizers/evanmiya";
const { data, errors } = normalizeEvanMiyaData(rawRows);
```

Each normalizer returns `{ data: Partial<TeamSeason>[], errors: ValidationError[] }`.

### 4. Validate

```typescript
import { validateTeamSeason } from "@/lib/data/validation";

for (const team of data) {
  const result = validateTeamSeason(team);
  if (!result.valid) {
    // Surface validation errors
    for (const error of result.errors) {
      console.error(`${error.field}: ${error.message}`);
    }
  }
}
```

Key validation rules from `src/lib/data/validation.ts`:
- Efficiency ratings: AdjOE/AdjDE in range [70, 140], AdjEM in range [-40, 50]
- Four Factors: percentages in [0, 100]
- Tempo: adjTempo in [50, 90]
- Experience: [0, 6] years
- Height: [68, 84] inches
- All required fields present and numeric

### 5. Merge / Upsert

If data from multiple sources already exists, merge using the data merger:

```typescript
import { mergeTeamData } from "@/lib/data/merger";

// Merge partial records from different sources into complete TeamSeason
const merged = mergeTeamData(existingTeam, newPartialData);
```

### 6. Insert into Database

```typescript
import { createAuthenticatedClient } from "@/lib/supabase/server";

const { supabase } = await createAuthenticatedClient();

// Upsert into team_seasons table
const { data, error } = await supabase
  .from("team_seasons")
  .upsert(teamSeasonRow)
  .select();
```

### 7. Format Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA IMPORT: [Source] — Season [Year]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESULTS
  Teams processed:  XXX
  Successful:       XXX
  Validation errors: XX
  Skipped:          XX

VALIDATION ERRORS (if any)
  Team Name: field — error message
  Team Name: field — error message

SAMPLE IMPORTED DATA
  Team Name | AdjEM | AdjOE | AdjDE | Tempo | Exp
  ─────────────────────────────────────────────────
  Duke       +22.3   118.5   96.2    69.2    2.34
  UConn      +24.1   120.3   96.2    67.8    2.56
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Key Files

| File | Purpose |
|------|---------|
| `src/types/data-import.ts` | `KenPomRawRow`, `TorvikRawRow`, `EvanMiyaRawRow`, `ValidationError` |
| `src/types/team.ts` | `TeamSeason` — full schema |
| `src/lib/data/csv-parser.ts` | CSV parsing utilities |
| `src/lib/data/normalizers/kenpom.ts` | KenPom → TeamSeason normalizer |
| `src/lib/data/normalizers/torvik.ts` | Torvik → TeamSeason normalizer |
| `src/lib/data/normalizers/evanmiya.ts` | Evan Miya → TeamSeason normalizer |
| `src/lib/data/validation.ts` | `validateTeamSeason()` with field-level rules |
| `src/lib/data/merger.ts` | Multi-source data merger |
| `src/lib/data/fetchers/torvik.ts` | Torvik data fetcher |
| `src/lib/data/campus-locations.ts` | 380+ D-1 school names and coordinates |
| `scripts/fetch-and-seed.ts` | Programmatic seeder reference |

## TeamSeason Required Fields

```typescript
interface TeamSeason {
  id: string;
  teamId: string;
  season: number;
  team: Team;                    // { id, name, shortName, conference, campus }
  ratings: {                     // At least one source required
    kenpom?: EfficiencyRatings;
    torvik?: EfficiencyRatings;
    evanmiya?: EfficiencyRatings;
  };
  fourFactorsOffense: FourFactors;  // { efgPct, toPct, orbPct, ftRate }
  fourFactorsDefense: FourFactors;
  shootingOffense: ShootingSplits;  // { threePtPct, threePtRate, ftPct }
  shootingDefense: ShootingSplits;
  adjTempo: number;
  avgPossLengthOff: number;
  avgPossLengthDef: number;
  benchMinutesPct: number;
  experience: number;
  minutesContinuity: number;
  avgHeight: number;
  twoFoulParticipation: number;
  coach: CoachRecord;
  tournamentEntry?: TournamentEntry;  // { seed, region, bracketPosition }
  updatedAt: string;
  dataSources: DataSource[];
}
```

## Admin UI

The admin data management page is at `/admin/data` for browser-based imports. This skill is for programmatic / CLI-based ingestion.
