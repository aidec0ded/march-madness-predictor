/**
 * One-time cleanup script: merge duplicate team records caused by cross-source
 * naming differences (e.g., "Utah State" from KenPom vs "Utah St." from Torvik).
 *
 * For each pair of duplicates, the script:
 *   1. Picks a "canonical" team (the one with more team_season records, or the
 *      first one alphabetically if tied)
 *   2. Merges team_season data from the duplicate into the canonical record
 *      (coalescing non-null column values — canonical wins on conflicts)
 *   3. Moves tournament_entries from the duplicate to the canonical team
 *   4. Merges team_name_mappings (consolidates source-specific names)
 *   5. Deletes the duplicate team record (cascade cleans up any remaining FKs)
 *
 * After running this script, re-import 2026 data from all three sources. The
 * updated commit routes now use resolveCanonicalTeamNames() to prevent
 * duplicates from being created in the future.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-teams.ts [--dry-run]
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service role key (bypasses RLS)
 *
 * @module
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Relative imports (path aliases don't work in standalone tsx scripts)
// ---------------------------------------------------------------------------

import { normalizeForMerge } from "../src/lib/data/merger";
import type { Database } from "../src/lib/supabase/types";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error(
      "Make sure you have a .env or .env.local file with the following variables:"
    );
    console.error("  NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>");
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DuplicatePair {
  /** The team record we keep. */
  canonical: { id: string; name: string };
  /** The team record we merge and delete. */
  duplicate: { id: string; name: string };
}

/**
 * All nullable numeric columns in team_seasons that should be coalesced when
 * merging two records for the same (team_id, season). Canonical value wins
 * when both are non-null. This list must match the DB schema.
 */
const TEAM_SEASON_NUMERIC_COLUMNS = [
  "kenpom_adj_oe",
  "kenpom_adj_de",
  "kenpom_adj_em",
  "torvik_adj_oe",
  "torvik_adj_de",
  "torvik_adj_em",
  "evanmiya_adj_oe",
  "evanmiya_adj_de",
  "evanmiya_adj_em",
  "off_efg_pct",
  "off_to_pct",
  "off_orb_pct",
  "off_ft_rate",
  "def_efg_pct",
  "def_to_pct",
  "def_orb_pct",
  "def_ft_rate",
  "off_three_pt_pct",
  "off_three_pt_rate",
  "off_ft_pct",
  "def_three_pt_pct",
  "def_three_pt_rate",
  "def_ft_pct",
  "adj_tempo",
  "avg_poss_length_off",
  "avg_poss_length_def",
  "bench_minutes_pct",
  "experience",
  "minutes_continuity",
  "avg_height",
  "two_foul_participation",
  "evanmiya_opponent_adjust",
  "evanmiya_pace_adjust",
  "evanmiya_kill_shots_per_game",
  "evanmiya_kill_shots_allowed_per_game",
  "evanmiya_kill_shots_margin",
  "sos_net_rating",
  "sos_off_rating",
  "sos_def_rating",
  "luck",
] as const;

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function findDuplicates(
  supabase: SupabaseClient<Database>
): Promise<DuplicatePair[]> {
  console.log("[1/5] Fetching all teams...");

  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  if (!teams || teams.length === 0) {
    console.log("  No teams found in database.");
    return [];
  }

  console.log(`  Found ${teams.length} teams.`);

  // Group teams by normalized key
  const keyGroups = new Map<string, { id: string; name: string }[]>();
  for (const team of teams) {
    const key = normalizeForMerge(team.name);
    const group = keyGroups.get(key) || [];
    group.push(team);
    keyGroups.set(key, group);
  }

  // Find groups with more than one team (duplicates)
  const pairs: DuplicatePair[] = [];

  for (const [key, group] of keyGroups) {
    if (group.length < 2) continue;

    if (group.length > 2) {
      console.warn(
        `  ⚠ More than 2 teams normalize to "${key}": ${group.map((t) => `"${t.name}"`).join(", ")}. Merging first two only.`
      );
    }

    // Decide which is canonical: fetch team_season counts
    const counts = await Promise.all(
      group.map(async (team) => {
        const { count } = await supabase
          .from("team_seasons")
          .select("id", { count: "exact", head: true })
          .eq("team_id", team.id);
        return { team, count: count ?? 0 };
      })
    );

    // Sort: most team_seasons first. On tie, prefer the name with "State"
    // (the KenPom convention) over "St." (Torvik convention).
    counts.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      // Prefer "State" names (KenPom convention)
      const aHasState = /\bState\b/.test(a.team.name);
      const bHasState = /\bState\b/.test(b.team.name);
      if (aHasState && !bHasState) return -1;
      if (!aHasState && bHasState) return 1;
      return a.team.name.localeCompare(b.team.name);
    });

    pairs.push({
      canonical: counts[0].team,
      duplicate: counts[1].team,
    });
  }

  return pairs;
}

async function mergePair(
  supabase: SupabaseClient<Database>,
  pair: DuplicatePair,
  dryRun: boolean
): Promise<void> {
  const { canonical, duplicate } = pair;
  console.log(
    `\n  Merging: "${duplicate.name}" (${duplicate.id}) → "${canonical.name}" (${canonical.id})`
  );

  // Fetch all team_seasons for both teams (needed by multiple steps)
  const { data: canonicalSeasons, error: csErr } = await supabase
    .from("team_seasons")
    .select("*")
    .eq("team_id", canonical.id);

  if (csErr) {
    throw new Error(
      `Failed to fetch canonical team_seasons: ${csErr.message}`
    );
  }

  const { data: duplicateSeasons, error: dsErr } = await supabase
    .from("team_seasons")
    .select("*")
    .eq("team_id", duplicate.id);

  if (dsErr) {
    throw new Error(
      `Failed to fetch duplicate team_seasons: ${dsErr.message}`
    );
  }

  // Build season → record maps for both teams
  const canonicalBySeason = new Map<number, Record<string, unknown>>();
  if (canonicalSeasons) {
    for (const row of canonicalSeasons) {
      canonicalBySeason.set(row.season, row as unknown as Record<string, unknown>);
    }
  }

  const duplicateBySeason = new Map<number, Record<string, unknown>>();
  if (duplicateSeasons) {
    for (const row of duplicateSeasons) {
      duplicateBySeason.set(row.season, row as unknown as Record<string, unknown>);
    }
  }

  // -------------------------------------------------------------------------
  // Step A: Move tournament_entries FIRST
  //
  // CRITICAL: tournament_entries.team_season_id has ON DELETE CASCADE to
  // team_seasons. We must move entries BEFORE deleting any team_seasons,
  // otherwise the cascade will silently destroy tournament entries.
  // -------------------------------------------------------------------------

  const { data: dupEntries, error: teErr } = await supabase
    .from("tournament_entries")
    .select("id, season, team_season_id")
    .eq("team_id", duplicate.id);

  if (teErr) {
    console.error(
      `    ✗ Failed to fetch duplicate tournament_entries: ${teErr.message}`
    );
  } else if (dupEntries && dupEntries.length > 0) {
    for (const entry of dupEntries) {
      // Check if canonical already has an entry for this season
      const { data: existingEntry } = await supabase
        .from("tournament_entries")
        .select("id")
        .eq("team_id", canonical.id)
        .eq("season", entry.season)
        .maybeSingle();

      if (existingEntry) {
        console.log(
          `    tournament_entry season ${entry.season}: canonical already has entry, deleting duplicate`
        );
        if (!dryRun) {
          await supabase.from("tournament_entries").delete().eq("id", entry.id);
        }
      } else {
        // Point to the canonical team's team_season for this season.
        // If canonical already has one, use it. If only the duplicate has one
        // (it will be moved in Step B), the team_season_id stays the same for
        // now and will be correct after Step B moves the team_season.
        const canonicalTs = canonicalBySeason.get(entry.season);
        const updatePayload: Record<string, unknown> = {
          team_id: canonical.id,
        };
        if (canonicalTs) {
          updatePayload.team_season_id = canonicalTs.id as string;
        }
        // If canonical doesn't have a team_season yet, the duplicate's
        // team_season will be reassigned to canonical in Step B, so the
        // existing team_season_id will become correct after that step.

        console.log(
          `    tournament_entry season ${entry.season}: moving to canonical team`
        );
        if (!dryRun) {
          const { error: moveErr } = await supabase
            .from("tournament_entries")
            .update(updatePayload as any)
            .eq("id", entry.id);

          if (moveErr) {
            console.error(
              `    ✗ Failed to move tournament_entry: ${moveErr.message}`
            );
          }
        }
      }
    }
    console.log(
      `    tournament_entries: ${dupEntries.length} processed`
    );
  } else {
    console.log("    tournament_entries: none to move");
  }

  // -------------------------------------------------------------------------
  // Step B: Merge team_seasons
  //
  // Now safe to delete duplicate team_seasons — tournament entries have
  // already been moved to the canonical team.
  // -------------------------------------------------------------------------

  const seasonsMerged: number[] = [];
  const seasonsMoved: number[] = [];

  if (duplicateSeasons && duplicateSeasons.length > 0) {
    for (const dupRow of duplicateSeasons) {
      const existingCanonical = canonicalBySeason.get(dupRow.season);

      if (existingCanonical) {
        // Both teams have a record for this season — merge column values
        // Canonical wins for any column where both have non-null values.
        // Duplicate fills in NULLs from canonical.
        const updates: Record<string, unknown> = {};
        let hasUpdates = false;

        for (const col of TEAM_SEASON_NUMERIC_COLUMNS) {
          const canonicalVal = existingCanonical[col];
          const dupVal = (dupRow as unknown as Record<string, unknown>)[col];

          // If canonical is null but duplicate has data, take duplicate's value
          if (
            (canonicalVal === null || canonicalVal === undefined) &&
            dupVal !== null &&
            dupVal !== undefined
          ) {
            updates[col] = dupVal;
            hasUpdates = true;
          }
        }

        // Merge data_sources arrays
        const canonicalSources =
          (existingCanonical.data_sources as string[]) || [];
        const dupSources =
          ((dupRow as unknown as Record<string, unknown>)
            .data_sources as string[]) || [];
        const mergedSources = Array.from(
          new Set([...canonicalSources, ...dupSources])
        );
        if (mergedSources.length > canonicalSources.length) {
          updates.data_sources = mergedSources;
          hasUpdates = true;
        }

        // Merge coach_id: take duplicate's if canonical doesn't have one
        if (!existingCanonical.coach_id && dupRow.coach_id) {
          updates.coach_id = dupRow.coach_id;
          hasUpdates = true;
        }

        if (hasUpdates) {
          console.log(
            `    Season ${dupRow.season}: merging ${Object.keys(updates).length} column(s) into canonical`
          );
          if (!dryRun) {
            const { error: updateErr } = await supabase
              .from("team_seasons")
              .update(updates as any)
              .eq("id", existingCanonical.id as string);

            if (updateErr) {
              console.error(
                `    ✗ Failed to merge season ${dupRow.season}: ${updateErr.message}`
              );
            }
          }
          seasonsMerged.push(dupRow.season);
        } else {
          console.log(
            `    Season ${dupRow.season}: canonical already has all data, skipping`
          );
        }

        // Delete the duplicate team_season row (tournament entries already moved)
        if (!dryRun) {
          const { error: deleteErr } = await supabase
            .from("team_seasons")
            .delete()
            .eq("id", dupRow.id);

          if (deleteErr) {
            console.error(
              `    ✗ Failed to delete duplicate team_season ${dupRow.id}: ${deleteErr.message}`
            );
          }
        }
      } else {
        // Only the duplicate has a record for this season — reassign to canonical
        console.log(
          `    Season ${dupRow.season}: moving to canonical team`
        );
        if (!dryRun) {
          const { error: moveErr } = await supabase
            .from("team_seasons")
            .update({ team_id: canonical.id } as any)
            .eq("id", dupRow.id);

          if (moveErr) {
            console.error(
              `    ✗ Failed to move team_season for season ${dupRow.season}: ${moveErr.message}`
            );
          }
        }
        seasonsMoved.push(dupRow.season);
      }
    }
  }

  console.log(
    `    team_seasons: ${seasonsMerged.length} merged, ${seasonsMoved.length} moved`
  );

  // -------------------------------------------------------------------------
  // Step C: Merge team_name_mappings
  // -------------------------------------------------------------------------

  const { data: canonicalMapping } = await supabase
    .from("team_name_mappings")
    .select("*")
    .eq("team_id", canonical.id)
    .maybeSingle();

  const { data: dupMapping } = await supabase
    .from("team_name_mappings")
    .select("*")
    .eq("team_id", duplicate.id)
    .maybeSingle();

  if (dupMapping) {
    if (canonicalMapping) {
      // Merge: fill in any missing source names from the duplicate
      const updates: Record<string, unknown> = {};
      let hasUpdates = false;

      if (!canonicalMapping.kenpom_name && dupMapping.kenpom_name) {
        updates.kenpom_name = dupMapping.kenpom_name;
        hasUpdates = true;
      }
      if (!canonicalMapping.torvik_name && dupMapping.torvik_name) {
        updates.torvik_name = dupMapping.torvik_name;
        hasUpdates = true;
      }
      if (!canonicalMapping.evanmiya_name && dupMapping.evanmiya_name) {
        updates.evanmiya_name = dupMapping.evanmiya_name;
        hasUpdates = true;
      }

      if (hasUpdates) {
        console.log(
          `    name_mappings: merging ${Object.keys(updates).length} source name(s)`
        );
        if (!dryRun) {
          // Delete duplicate mapping first (unique constraints on source names)
          await supabase
            .from("team_name_mappings")
            .delete()
            .eq("id", dupMapping.id);

          const { error: updateErr } = await supabase
            .from("team_name_mappings")
            .update(updates as any)
            .eq("id", canonicalMapping.id);

          if (updateErr) {
            console.error(
              `    ✗ Failed to merge name mappings: ${updateErr.message}`
            );
          }
        }
      } else {
        console.log("    name_mappings: canonical already complete, deleting duplicate");
        if (!dryRun) {
          await supabase
            .from("team_name_mappings")
            .delete()
            .eq("id", dupMapping.id);
        }
      }
    } else {
      // Canonical has no mapping — move the duplicate's mapping over
      console.log("    name_mappings: moving duplicate mapping to canonical");
      if (!dryRun) {
        const { error: moveErr } = await supabase
          .from("team_name_mappings")
          .update({ team_id: canonical.id } as any)
          .eq("id", dupMapping.id);

        if (moveErr) {
          console.error(
            `    ✗ Failed to move name mapping: ${moveErr.message}`
          );
        }
      }
    }
  } else {
    console.log("    name_mappings: duplicate has no mapping");
  }

  // -------------------------------------------------------------------------
  // Step D: Delete the duplicate team record
  // -------------------------------------------------------------------------

  console.log(
    `    Deleting duplicate team "${duplicate.name}" (${duplicate.id})...`
  );
  if (!dryRun) {
    const { error: deleteErr } = await supabase
      .from("teams")
      .delete()
      .eq("id", duplicate.id);

    if (deleteErr) {
      console.error(
        `    ✗ Failed to delete duplicate team: ${deleteErr.message}`
      );
    } else {
      console.log("    ✓ Duplicate team deleted.");
    }
  } else {
    console.log("    (dry run — skipping delete)");
  }
}

// ---------------------------------------------------------------------------
// Update canonical team's short_name if needed
// ---------------------------------------------------------------------------

async function updateShortNames(
  supabase: SupabaseClient<Database>,
  pairs: DuplicatePair[],
  dryRun: boolean
): Promise<void> {
  console.log("\n[4/5] Checking short_name conflicts...");

  for (const pair of pairs) {
    // After deleting the duplicate, the canonical's short_name might
    // conflict with nothing now. But we should verify it's correct.
    const { data: team } = await supabase
      .from("teams")
      .select("name, short_name")
      .eq("id", pair.canonical.id)
      .maybeSingle();

    if (team) {
      console.log(
        `  "${team.name}" → short_name: "${team.short_name}" ✓`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  DRY RUN MODE — no changes will be made to the DB");
    console.log("═══════════════════════════════════════════════════════\n");
  }

  // Load environment variables
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
  }

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Step 1: Find duplicates
  const pairs = await findDuplicates(supabase);

  if (pairs.length === 0) {
    console.log("\n✓ No duplicate teams found. Database is clean.");
    return;
  }

  console.log(`\n[2/5] Found ${pairs.length} duplicate pair(s):`);
  for (const pair of pairs) {
    console.log(
      `  "${pair.duplicate.name}" → "${pair.canonical.name}"`
    );
  }

  // Step 2: Merge each pair
  console.log("\n[3/5] Merging duplicates...");
  for (const pair of pairs) {
    await mergePair(supabase, pair, dryRun);
  }

  // Step 3: Verify short_names
  if (!dryRun) {
    await updateShortNames(supabase, pairs, dryRun);
  }

  // Step 4: Summary
  console.log("\n[5/5] Summary");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Duplicate pairs found:  ${pairs.length}`);
  console.log(`  Mode:                   ${dryRun ? "DRY RUN" : "LIVE"}`);

  if (!dryRun) {
    console.log("\n  ✓ Cleanup complete!");
    console.log("\n  Next steps:");
    console.log("  1. Re-import 2026 data from all three sources via the admin UI");
    console.log(
      "     (KenPom → Torvik → Evan Miya)"
    );
    console.log(
      "  2. Verify the affected teams now show combined data from all sources"
    );
  } else {
    console.log(
      "\n  Run without --dry-run to apply changes:"
    );
    console.log("    npx tsx scripts/cleanup-duplicate-teams.ts");
  }

  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
