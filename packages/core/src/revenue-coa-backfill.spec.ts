import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import {
  backfillBusinessUnitRevenueCoa,
  linkRevenueCoaCandidateIfCurrent,
} from "../../db/src/backfill-revenue-coa.js";

let localKoperasiId = "";
let foreignKoperasiId = "";
let exactUnitId = "";
let missingUnitId = "";
let ambiguousUnitId = "";
let foreignUnitId = "";
let inactiveUnitId = "";

beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [local, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: `Backfill Local ${suffix}` } }),
    prisma.koperasi.create({ data: { nama: `Backfill Foreign ${suffix}` } }),
  ]);
  localKoperasiId = local.id;
  foreignKoperasiId = foreign.id;

  const [exact, missing, ambiguous, foreignUnit, inactive] = await Promise.all([
    prisma.businessUnit.create({ data: { koperasiId: local.id, nama: "UNIT EXACT" } }),
    prisma.businessUnit.create({ data: { koperasiId: local.id, nama: "UNIT MISSING" } }),
    prisma.businessUnit.create({ data: { koperasiId: local.id, nama: "UNIT AMBIGUOUS" } }),
    prisma.businessUnit.create({ data: { koperasiId: foreign.id, nama: "UNIT FOREIGN" } }),
    prisma.businessUnit.create({ data: { koperasiId: local.id, nama: "UNIT INACTIVE COA" } }),
  ]);
  exactUnitId = exact.id;
  missingUnitId = missing.id;
  ambiguousUnitId = ambiguous.id;
  foreignUnitId = foreignUnit.id;
  inactiveUnitId = inactive.id;

  await prisma.coaAccount.createMany({
    data: [
      { koperasiId: local.id, kode: "481001", nama: "Pendapatan UNIT EXACT", type: "REVENUE" },
      { koperasiId: local.id, kode: "481002", nama: "Pendapatan UNIT AMBIGUOUS", type: "REVENUE" },
      { koperasiId: local.id, kode: "481003", nama: "Pendapatan UNIT AMBIGUOUS", type: "REVENUE" },
      // Nama tepat ada, tetapi hanya di tenant lain: tidak boleh dipakai.
      { koperasiId: local.id, kode: "481004", nama: "Pendapatan UNIT FOREIGN", type: "REVENUE" },
      {
        koperasiId: local.id,
        kode: "481006",
        nama: "Pendapatan UNIT INACTIVE COA",
        type: "REVENUE",
        isActive: false,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.businessUnit.deleteMany({
    where: { koperasiId: { in: [localKoperasiId, foreignKoperasiId] } },
  });
  await prisma.coaAccount.deleteMany({
    where: { koperasiId: { in: [localKoperasiId, foreignKoperasiId] } },
  });
  await prisma.koperasi.deleteMany({
    where: { id: { in: [localKoperasiId, foreignKoperasiId] } },
  });
});

describe("business-unit revenue COA backfill", () => {
  it("links only one exact tenant match, reports gaps, preserves codes, and is idempotent", async () => {
    const scope = { koperasiIds: [localKoperasiId, foreignKoperasiId] };
    const codesBefore = await prisma.coaAccount.findMany({
      where: { koperasiId: { in: scope.koperasiIds } },
      orderBy: { id: "asc" },
      select: { id: true, kode: true },
    });

    const first = await backfillBusinessUnitRevenueCoa(scope);
    expect(first).toMatchObject({ scanned: 5, linked: 1, unchanged: 0 });
    expect(first.unmatched.map((issue) => issue.unitId).sort()).toEqual(
      [missingUnitId, foreignUnitId, inactiveUnitId].sort(),
    );
    expect(first.unmatched).toEqual(expect.arrayContaining([
      expect.objectContaining({
        unitId: inactiveUnitId,
        reason: "INACTIVE_EXACT_REVENUE_COA",
      }),
    ]));
    expect(first.ambiguous.map((issue) => issue.unitId)).toEqual([ambiguousUnitId]);

    const units = await prisma.businessUnit.findMany({
      where: {
        id: { in: [exactUnitId, missingUnitId, ambiguousUnitId, foreignUnitId, inactiveUnitId] },
      },
      select: { id: true, revenueCoa: { select: { koperasiId: true, nama: true } } },
    });
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    expect(byId.get(exactUnitId)?.revenueCoa).toEqual({
      koperasiId: localKoperasiId,
      nama: "Pendapatan UNIT EXACT",
    });
    expect(byId.get(missingUnitId)?.revenueCoa).toBeNull();
    expect(byId.get(ambiguousUnitId)?.revenueCoa).toBeNull();
    expect(byId.get(foreignUnitId)?.revenueCoa).toBeNull();
    expect(byId.get(inactiveUnitId)?.revenueCoa).toBeNull();

    const codesAfter = await prisma.coaAccount.findMany({
      where: { koperasiId: { in: scope.koperasiIds } },
      orderBy: { id: "asc" },
      select: { id: true, kode: true },
    });
    expect(codesAfter).toEqual(codesBefore);

    const second = await backfillBusinessUnitRevenueCoa(scope);
    expect(second).toMatchObject({ scanned: 5, linked: 0, unchanged: 1 });
    expect(second.unmatched).toHaveLength(3);
    expect(second.ambiguous).toHaveLength(1);
  });

  it("does not link a stale account from a snapshot taken before a unit rename", async () => {
    const account = await prisma.coaAccount.create({
      data: {
        koperasiId: localKoperasiId,
        kode: "481005",
        nama: "Pendapatan UNIT RACE OLD",
        type: "REVENUE",
      },
    });
    const unit = await prisma.businessUnit.create({
      data: { koperasiId: localKoperasiId, nama: "UNIT RACE OLD" },
    });
    try {
      await prisma.businessUnit.update({
        where: { id: unit.id },
        data: { nama: "UNIT RACE NEW" },
      });
      await expect(linkRevenueCoaCandidateIfCurrent(
        { id: unit.id, koperasiId: localKoperasiId, nama: "UNIT RACE OLD" },
        "Pendapatan UNIT RACE OLD",
        account.id,
      )).resolves.toBe("CHANGED");
      expect(await prisma.businessUnit.findUnique({ where: { id: unit.id } }))
        .toMatchObject({ nama: "UNIT RACE NEW", revenueCoaId: null });
    } finally {
      await prisma.businessUnit.deleteMany({ where: { id: unit.id } });
      await prisma.coaAccount.deleteMany({ where: { id: account.id } });
    }
  });
});
