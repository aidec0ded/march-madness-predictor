/**
 * Run SQL migrations against the remote Supabase database.
 *
 * Usage: npx tsx scripts/run-migrations.ts
 *
 * Requires DATABASE_URL env var or will construct one from
 * SUPABASE_DB_PASSWORD + project ref.
 */

import { Client } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const PROJECT_REF = "xiwpovarclryqtkaugsm";

async function runMigrations() {
  // Load .env.local if dotenv is available
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: join(__dirname, "..", ".env.local") });
  } catch {
    // dotenv not required
  }

  const dbPassword =
    process.env.SUPABASE_DB_PASSWORD || process.argv[2] || "";

  if (!dbPassword) {
    console.error(
      "Error: Provide the database password as SUPABASE_DB_PASSWORD env var or as an argument."
    );
    process.exit(1);
  }

  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to Supabase database...");
    await client.connect();
    console.log("✓ Connected\n");

    // Read migration files in order
    const migrationsDir = join(__dirname, "..", "supabase", "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), "utf-8");

      try {
        await client.query(sql);
        console.log(`✓ ${file} — success\n`);
      } catch (err: unknown) {
        const pgErr = err as { message?: string; code?: string };
        // If tables already exist, that's fine (idempotent)
        if (pgErr.code === "42710" || pgErr.code === "42P07") {
          console.log(
            `⚠ ${file} — objects already exist (skipping): ${pgErr.message}\n`
          );
        } else {
          throw err;
        }
      }
    }

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("--- Database tables ---");
    for (const row of result.rows) {
      console.log(`  • ${row.table_name}`);
    }
    console.log(`\n✓ ${result.rows.length} tables found. Migrations complete.`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
