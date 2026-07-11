import { describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";

interface ColumnContract {
  column_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

interface ConstraintContract {
  constraint_type: "FOREIGN KEY" | "UNIQUE";
  foreign_table: string | null;
}

interface ForeignKeyContract {
  source_columns: string[];
  target_columns: string[];
}

async function column(table: string, name: string): Promise<ColumnContract | undefined> {
  const rows = await prisma.$queryRaw<ColumnContract[]>`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${table}
      AND column_name = ${name}`;
  return rows[0];
}

async function constraints(table: string, name: string): Promise<ConstraintContract[]> {
  return prisma.$queryRaw<ConstraintContract[]>`
    SELECT tc.constraint_type::text,
      ccu.table_name::text AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
      AND kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
      AND ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = current_schema()
      AND tc.table_name = ${table}
      AND kcu.column_name = ${name}
      AND tc.constraint_type = 'FOREIGN KEY'
    UNION ALL
    SELECT 'UNIQUE'::text AS constraint_type, NULL::text AS foreign_table
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = t.oid
      AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = current_schema()
      AND t.relname = ${table}
      AND a.attname = ${name}
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indnkeyatts = 1`;
}

async function foreignKey(
  table: string,
  constraint: string,
): Promise<ForeignKeyContract | undefined> {
  const rows = await prisma.$queryRaw<ForeignKeyContract[]>`
    SELECT
      ARRAY_AGG(source_column.attname ORDER BY columns.ordinality) AS source_columns,
      ARRAY_AGG(target_column.attname ORDER BY columns.ordinality) AS target_columns
    FROM pg_catalog.pg_constraint relation
    JOIN pg_catalog.pg_class source_table ON source_table.oid = relation.conrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = source_table.relnamespace
    CROSS JOIN LATERAL UNNEST(relation.conkey, relation.confkey)
      WITH ORDINALITY AS columns(source_attnum, target_attnum, ordinality)
    JOIN pg_catalog.pg_attribute source_column
      ON source_column.attrelid = relation.conrelid
      AND source_column.attnum = columns.source_attnum
    JOIN pg_catalog.pg_attribute target_column
      ON target_column.attrelid = relation.confrelid
      AND target_column.attnum = columns.target_attnum
    WHERE namespace.nspname = current_schema()
      AND source_table.relname = ${table}
      AND relation.conname = ${constraint}
      AND relation.contype = 'f'
    GROUP BY relation.oid`;
  return rows[0];
}

async function uniqueIndexes(table: string): Promise<string[][]> {
  const rows = await prisma.$queryRaw<{ columns: string[] }[]>`
    SELECT ARRAY_AGG(attribute.attname ORDER BY key.ordinality) AS columns
    FROM pg_catalog.pg_index index
    JOIN pg_catalog.pg_class source_table ON source_table.oid = index.indrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = source_table.relnamespace
    CROSS JOIN LATERAL UNNEST(index.indkey::smallint[])
      WITH ORDINALITY AS key(attnum, ordinality)
    JOIN pg_catalog.pg_attribute attribute
      ON attribute.attrelid = source_table.oid
      AND attribute.attnum = key.attnum
    WHERE namespace.nspname = current_schema()
      AND source_table.relname = ${table}
      AND index.indisunique
      AND index.indisvalid
      AND index.indisready
      AND index.indpred IS NULL
    GROUP BY index.indexrelid`;
  return rows.map((row) => row.columns);
}

describe("ERP lifecycle schema contract", () => {
  it("members memiliki flag arsip aktif-by-default", async () => {
    const active = await column("members", "isActive");
    expect(active).toMatchObject({ is_nullable: "NO" });
    expect(active?.column_default).toMatch(/true/i);
  });

  it("business units memiliki flag arsip dan satu revenue COA opsional", async () => {
    const [active, revenue, revenueConstraints] = await Promise.all([
      column("business_units", "isActive"),
      column("business_units", "revenueCoaId"),
      constraints("business_units", "revenueCoaId"),
    ]);
    expect(active).toMatchObject({ is_nullable: "NO" });
    expect(active?.column_default).toMatch(/true/i);
    expect(revenue).toMatchObject({ is_nullable: "YES" });
    expect(revenueConstraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ constraint_type: "FOREIGN KEY", foreign_table: "coa_accounts" }),
    ]));
    expect(await uniqueIndexes("business_units")).toEqual(expect.arrayContaining([
      ["revenueCoaId", "koperasiId"],
    ]));
    expect(await foreignKey("business_units", "business_units_revenueCoaId_fkey"))
      .toEqual({
        source_columns: ["revenueCoaId", "koperasiId"],
        target_columns: ["id", "koperasiId"],
      });
  });

  it("journal reversal menunjuk unik ke journal asal", async () => {
    const [reversal, reversalConstraints] = await Promise.all([
      column("journal_entries", "reversalOfId"),
      constraints("journal_entries", "reversalOfId"),
    ]);
    expect(reversal).toMatchObject({ is_nullable: "YES" });
    expect(reversalConstraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ constraint_type: "FOREIGN KEY", foreign_table: "journal_entries" }),
    ]));
    expect(await uniqueIndexes("journal_entries")).toEqual(expect.arrayContaining([
      ["reversalOfId", "koperasiId"],
    ]));
    expect(await foreignKey("journal_entries", "journal_entries_reversalOfId_fkey"))
      .toEqual({
        source_columns: ["reversalOfId", "koperasiId"],
        target_columns: ["id", "koperasiId"],
      });
  });

  it("database rejects cross-tenant revenue and reversal relations", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [local, foreign] = await Promise.all([
      prisma.koperasi.create({ data: { nama: `Schema Local ${suffix}` } }),
      prisma.koperasi.create({ data: { nama: `Schema Foreign ${suffix}` } }),
    ]);
    const [localUser, foreignUser, foreignRevenue] = await Promise.all([
      prisma.user.create({
        data: {
          email: `schema-local-${suffix}@example.test`,
          passwordHash: "x",
          name: "Local",
          koperasiId: local.id,
        },
      }),
      prisma.user.create({
        data: {
          email: `schema-foreign-${suffix}@example.test`,
          passwordHash: "x",
          name: "Foreign",
          koperasiId: foreign.id,
        },
      }),
      prisma.coaAccount.create({
        data: {
          koperasiId: foreign.id,
          kode: "499999",
          nama: "Foreign Revenue",
          type: "REVENUE",
        },
      }),
    ]);
    const unit = await prisma.businessUnit.create({
      data: { koperasiId: local.id, nama: "LOCAL UNIT" },
    });
    const foreignEntry = await prisma.journalEntry.create({
      data: {
        koperasiId: foreign.id,
        nomor: "JU-FOREIGN",
        keterangan: "Foreign original",
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: foreignUser.id,
      },
    });

    try {
      await expect(prisma.businessUnit.update({
        where: { id: unit.id },
        data: { revenueCoaId: foreignRevenue.id },
      })).rejects.toMatchObject({ code: "P2003" });
      await expect(prisma.journalEntry.create({
        data: {
          koperasiId: local.id,
          nomor: "JU-LOCAL-REVERSAL",
          keterangan: "Invalid cross-tenant reversal",
          sourceChannel: "WEB",
          status: "DRAFT",
          createdById: localUser.id,
          reversalOfId: foreignEntry.id,
        },
      })).rejects.toMatchObject({ code: "P2003" });
    } finally {
      await prisma.journalEntry.deleteMany({
        where: { koperasiId: { in: [local.id, foreign.id] } },
      });
      await prisma.businessUnit.deleteMany({ where: { id: unit.id } });
      await prisma.coaAccount.deleteMany({ where: { id: foreignRevenue.id } });
      await prisma.user.deleteMany({ where: { id: { in: [localUser.id, foreignUser.id] } } });
      await prisma.koperasi.deleteMany({ where: { id: { in: [local.id, foreign.id] } } });
    }
  });
});
