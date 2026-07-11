import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(process.cwd(), "../..");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function pushSchema(databaseUrl: string) {
  execFileSync(PNPM, ["--filter", "@kopra/db", "push", "--", "--skip-generate"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

describe("safe schema push", () => {
  it.each([
    { label: "public", targetSchema: undefined },
    { label: "non-public", targetSchema: "tenant_stage2" },
  ])("upgrades a populated legacy database in $label schema without data loss", async ({ targetSchema }) => {
    const sourceUrl = new URL(process.env.DATABASE_URL!);
    const databaseName = `kopra_push_${targetSchema ? "custom" : "public"}_${Date.now()}`;
    const adminUrl = new URL(sourceUrl);
    adminUrl.pathname = "/postgres";
    const databaseUrl = new URL(sourceUrl);
    databaseUrl.pathname = `/${databaseName}`;
    if (targetSchema) databaseUrl.searchParams.set("schema", targetSchema);
    else databaseUrl.searchParams.delete("schema");

    const admin = new Client({ connectionString: adminUrl.toString() });
    let database: Client | undefined;
    await admin.connect();
    await admin.query(`CREATE DATABASE ${databaseName}`);
    try {
      pushSchema(databaseUrl.toString());
      database = new Client({ connectionString: databaseUrl.toString() });
      await database.connect();
      await database.query(
        "SELECT set_config('search_path', quote_ident($1), false)",
        [targetSchema ?? "public"],
      );
      if (targetSchema) {
        const publicTable = await database.query<{ present: string | null }>(
          "SELECT to_regclass('public.members')::text AS present",
        );
        expect(publicTable.rows[0]?.present).toBeNull();
      }
      await database.query(`
        INSERT INTO koperasi (id, nama) VALUES ('legacy-kop', 'Legacy Cooperative');
        INSERT INTO users (id, email, "passwordHash", name, "koperasiId")
          VALUES ('legacy-user', 'legacy@example.test', 'x', 'Legacy User', 'legacy-kop');
        INSERT INTO coa_accounts (id, "koperasiId", kode, nama, type)
          VALUES ('legacy-coa', 'legacy-kop', '411000', 'Pendapatan Legacy', 'REVENUE');
        INSERT INTO business_units (id, "koperasiId", nama)
          VALUES ('legacy-unit', 'legacy-kop', 'LEGACY');
        INSERT INTO members (id, "koperasiId", nama)
          VALUES ('legacy-member', 'legacy-kop', 'Legacy Member');
        INSERT INTO journal_entries (
          id, "koperasiId", nomor, keterangan, "sourceChannel", status, "createdById"
        ) VALUES (
          'legacy-entry', 'legacy-kop', 'JU-LEGACY', 'Legacy entry', 'SEED', 'CONFIRMED', 'legacy-user'
        );
        INSERT INTO rag_documents (id, title, source, "sourceType", content)
          VALUES ('legacy-rag', 'Legacy FTS', 'test', 'guide', 'searchable content');
      `);
      const before = await database.query(`
        SELECT
          (SELECT COUNT(*)::int FROM members) AS members,
          (SELECT COUNT(*)::int FROM business_units) AS units,
          (SELECT COUNT(*)::int FROM coa_accounts) AS accounts,
          (SELECT COUNT(*)::int FROM journal_entries) AS journals,
          (SELECT COUNT(*)::int FROM rag_documents WHERE tsv IS NOT NULL) AS fts
      `);

      // Simulate the exact populated pre-Stage-2 shape while retaining custom FTS.
      await database.query(`
        ALTER TABLE business_units
          DROP CONSTRAINT "business_units_revenueCoaId_fkey",
          DROP COLUMN "revenueCoaId",
          DROP COLUMN "isActive";
        ALTER TABLE journal_entries
          DROP CONSTRAINT "journal_entries_reversalOfId_fkey",
          DROP COLUMN "reversalOfId";
        ALTER TABLE members DROP COLUMN "isActive";
        DROP INDEX IF EXISTS "coa_accounts_id_koperasiId_key";
        DROP INDEX IF EXISTS "journal_entries_id_koperasiId_key";
      `);

      pushSchema(databaseUrl.toString());

      const after = await database.query(`
        SELECT
          (SELECT COUNT(*)::int FROM members) AS members,
          (SELECT COUNT(*)::int FROM business_units) AS units,
          (SELECT COUNT(*)::int FROM coa_accounts) AS accounts,
          (SELECT COUNT(*)::int FROM journal_entries) AS journals,
          (SELECT COUNT(*)::int FROM rag_documents WHERE tsv IS NOT NULL) AS fts
      `);
      expect(after.rows[0]).toEqual(before.rows[0]);

      const columns = await database.query<{
        table_name: string;
        column_name: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        SELECT table_name, column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND (table_name, column_name) IN (
            ('members', 'isActive'),
            ('business_units', 'isActive'),
            ('business_units', 'revenueCoaId'),
            ('journal_entries', 'reversalOfId')
          )
        ORDER BY table_name, column_name
      `);
      expect(columns.rows).toHaveLength(4);
      expect(columns.rows.filter((column) => column.column_name === "isActive"))
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ is_nullable: "NO", column_default: "true" }),
          expect.objectContaining({ is_nullable: "NO", column_default: "true" }),
        ]));
      expect(await database.query(`SELECT tsv::text FROM rag_documents WHERE id = 'legacy-rag'`))
        .toMatchObject({ rows: [{ tsv: expect.stringContaining("searchable") }] });
    } finally {
      if (database) await database.end().catch(() => undefined);
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
      await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
      await admin.end();
    }
  }, 30_000);
});
