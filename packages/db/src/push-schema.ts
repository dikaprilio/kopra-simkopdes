/**
 * Prisma cannot create a PostgreSQL generated tsvector column, but omitting the
 * column from schema.prisma makes `db push` offer to delete live FTS data.
 * Bootstrap without that one field, install the SQL-managed column, then let
 * Prisma validate/apply the canonical schema. Existing databases never drop it.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

const DB_ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = join(DB_ROOT, "prisma", "schema.prisma");
const FTS_SQL_PATH = join(DB_ROOT, "sql", "rag_fts.sql");
const PRISMA_CLI = require.resolve("prisma/build/index.js");

if (!process.env.DATABASE_URL) loadEnvFile(join(DB_ROOT, ".env"));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL belum di-set");
const databaseSchema = new URL(databaseUrl).searchParams.get("schema") ?? "public";

function withoutGeneratedFts(schema: string): string {
  const withoutField = schema.replace(
    /^\s*tsv\s+Unsupported\("tsvector"\)\?[^\n]*\n/m,
    "",
  );
  const result = withoutField.replace(
    /^\s*@@index\(\[tsv\], type: Gin\)\s*\n/m,
    "",
  );
  if (result === schema || result.includes('Unsupported("tsvector")')) {
    throw new Error("Kontrak field FTS di schema.prisma berubah; bootstrap dihentikan");
  }
  return result;
}

function prisma(args: string[]) {
  execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: DB_ROOT,
    env: process.env,
    stdio: "inherit",
  });
}

async function hasTable(client: Client, table: string): Promise<boolean> {
  const result = await client.query<{ present: boolean }>(
    `SELECT to_regclass(current_schema() || '.' || $1) IS NOT NULL AS present`,
    [table],
  );
  return result.rows[0]?.present ?? false;
}

async function hasColumn(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
        AND column_name = $2
    ) AS present`,
    [table, column],
  );
  return result.rows[0]?.present ?? false;
}

async function ensureLifecycleUpgrade(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    // Data-preserving preflight: Prisma otherwise requires the broadly unsafe
    // --accept-data-loss flag merely to add unique indexes on new NULL columns.
    await client.query(`
      ALTER TABLE members
        ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE business_units
        ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "revenueCoaId" TEXT;
      ALTER TABLE journal_entries
        ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;
      DROP INDEX IF EXISTS "business_units_revenueCoaId_key";
      DROP INDEX IF EXISTS "journal_entries_reversalOfId_key";
      CREATE UNIQUE INDEX IF NOT EXISTS "business_units_revenueCoaId_koperasiId_key"
        ON business_units("revenueCoaId", "koperasiId");
      CREATE UNIQUE INDEX IF NOT EXISTS "coa_accounts_id_koperasiId_key"
        ON coa_accounts(id, "koperasiId");
      CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_reversalOfId_koperasiId_key"
        ON journal_entries("reversalOfId", "koperasiId");
      CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_id_koperasiId_key"
        ON journal_entries(id, "koperasiId");
    `);
    await client.query(`
      DO $$
      BEGIN
        -- Transitional Prisma-generated names from the composite-FK rollout.
        ALTER TABLE business_units
          DROP CONSTRAINT IF EXISTS "business_units_revenueCoaId_koperasiId_fkey";
        ALTER TABLE journal_entries
          DROP CONSTRAINT IF EXISTS "journal_entries_reversalOfId_koperasiId_fkey";
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'business_units_revenueCoaId_fkey'
            AND conrelid = 'business_units'::regclass
            AND ARRAY_LENGTH(conkey, 1) <> 2
        ) THEN
          ALTER TABLE business_units
            DROP CONSTRAINT "business_units_revenueCoaId_fkey";
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'business_units_revenueCoaId_fkey'
            AND conrelid = 'business_units'::regclass
        ) THEN
          ALTER TABLE business_units
            ADD CONSTRAINT "business_units_revenueCoaId_fkey"
            FOREIGN KEY ("revenueCoaId", "koperasiId")
            REFERENCES coa_accounts(id, "koperasiId")
            ON DELETE RESTRICT ON UPDATE RESTRICT;
        END IF;
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'journal_entries_reversalOfId_fkey'
            AND conrelid = 'journal_entries'::regclass
            AND ARRAY_LENGTH(conkey, 1) <> 2
        ) THEN
          ALTER TABLE journal_entries
            DROP CONSTRAINT "journal_entries_reversalOfId_fkey";
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'journal_entries_reversalOfId_fkey'
            AND conrelid = 'journal_entries'::regclass
        ) THEN
          ALTER TABLE journal_entries
            ADD CONSTRAINT "journal_entries_reversalOfId_fkey"
            FOREIGN KEY ("reversalOfId", "koperasiId")
            REFERENCES journal_entries(id, "koperasiId")
            ON DELETE RESTRICT ON UPDATE RESTRICT;
        END IF;
      END
      $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const skipGenerate = process.argv.includes("--skip-generate");
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(
    "SELECT set_config('search_path', quote_ident($1), false)",
    [databaseSchema],
  );

  let tempDir: string | undefined;
  try {
    if (!(await hasTable(client, "rag_documents"))) {
      tempDir = mkdtempSync(join(tmpdir(), "kopra-prisma-"));
      const bootstrapPath = join(tempDir, "schema.prisma");
      writeFileSync(bootstrapPath, withoutGeneratedFts(schema));
      prisma(["db", "push", "--schema", bootstrapPath, "--skip-generate"]);
    }

    if (!(await hasColumn(client, "rag_documents", "tsv"))) {
      await client.query(readFileSync(FTS_SQL_PATH, "utf8"));
    }
    await ensureLifecycleUpgrade(client);
  } finally {
    await client.end();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }

  prisma(["db", "push", "--schema", SCHEMA_PATH, "--skip-generate"]);
  if (!skipGenerate) prisma(["generate", "--schema", SCHEMA_PATH]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
