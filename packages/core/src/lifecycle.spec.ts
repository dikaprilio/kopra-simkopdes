import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { KODE } from "./posting-rules.js";
import {
  REQUIRED_POSTING_COA_CODES,
  activeBusinessUnitScope,
  activeMemberScope,
  assertCoaNotRequiredForPosting,
  assertJournalReversible,
  findBusinessUnitForWrite,
  nextUnitRevenueCode,
} from "./lifecycle.js";

let koperasiId = "";
let foreignKoperasiId = "";
let userId = "";
let originalEntryId = "";
let kasCoaId = "";
let linkedRevenueCoaId = "";
let mutableCoaId = "";

beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: `Lifecycle ${suffix}` } }),
    prisma.koperasi.create({ data: { nama: `Lifecycle Foreign ${suffix}` } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;

  const accounts = await Promise.all([
    prisma.coaAccount.create({
      data: { koperasiId, kode: KODE.KAS, nama: "Kas", type: "ASSET" },
    }),
    prisma.coaAccount.create({
      data: { koperasiId, kode: "411000", nama: "Pendapatan Satu", type: "REVENUE" },
    }),
    prisma.coaAccount.create({
      data: { koperasiId, kode: "413000", nama: "Pendapatan Tiga", type: "REVENUE" },
    }),
    prisma.coaAccount.create({
      data: { koperasiId, kode: "418000", nama: "Pendapatan UNIT LINKED", type: "REVENUE" },
    }),
    prisma.coaAccount.create({
      data: { koperasiId, kode: "590000", nama: "Akun Bebas", type: "EXPENSE" },
    }),
    // The same candidate code in another tenant must not affect allocation.
    prisma.coaAccount.create({
      data: { koperasiId: foreign.id, kode: "412000", nama: "Pendapatan Asing", type: "REVENUE" },
    }),
  ]);
  [kasCoaId, , , linkedRevenueCoaId, mutableCoaId] = accounts.map((account) => account.id);

  await prisma.businessUnit.create({
    data: {
      koperasiId,
      nama: "UNIT LINKED",
      revenueCoaId: linkedRevenueCoaId,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `lifecycle-${suffix}@example.test`,
      passwordHash: "x",
      name: "Lifecycle User",
      koperasiId,
    },
  });
  userId = user.id;
  const original = await prisma.journalEntry.create({
    data: {
      koperasiId,
      nomor: "JU-LIFECYCLE",
      keterangan: "Original confirmed entry",
      sourceChannel: "SEED",
      status: "CONFIRMED",
      createdById: user.id,
    },
  });
  originalEntryId = original.id;
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { koperasiId } });
  await prisma.businessUnit.deleteMany({ where: { koperasiId } });
  await prisma.coaAccount.deleteMany({
    where: { koperasiId: { in: [koperasiId, foreignKoperasiId] } },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.koperasi.deleteMany({
    where: { id: { in: [koperasiId, foreignKoperasiId] } },
  });
});

describe("shared lifecycle helpers", () => {
  it("allocates the lowest free unit revenue code inside one tenant", async () => {
    await expect(prisma.$transaction((tx) => nextUnitRevenueCode(tx, koperasiId)))
      .resolves.toBe("412000");
  });

  it("exposes explicit active-only scopes for operational selectors", () => {
    expect(activeMemberScope(koperasiId)).toEqual({ koperasiId, isActive: true });
    expect(activeBusinessUnitScope(koperasiId)).toEqual({ koperasiId, isActive: true });
  });

  it("rejects an explicit archived or missing unit name instead of posting generically", async () => {
    const archived = await prisma.businessUnit.create({
      data: { koperasiId, nama: "ARCHIVED UNIT SEARCH", isActive: false },
    });
    try {
      await expect(findBusinessUnitForWrite(koperasiId, "ARCHIVED UNIT SEARCH"))
        .rejects.toMatchObject({ code: "UNIT_ARCHIVED" });
      await expect(findBusinessUnitForWrite(koperasiId, "UNIT DOES NOT EXIST"))
        .rejects.toMatchObject({ code: "UNIT_MISSING" });
      await expect(findBusinessUnitForWrite(koperasiId, "UNIT LINKED"))
        .resolves.toMatchObject({ nama: "UNIT LINKED", isActive: true });
    } finally {
      await prisma.businessUnit.delete({ where: { id: archived.id } });
    }
  });

  it("protects fixed posting accounts and linked unit revenue accounts", async () => {
    expect(new Set(REQUIRED_POSTING_COA_CODES)).toEqual(new Set(Object.values(KODE)));
    await expect(prisma.$transaction((tx) =>
      assertCoaNotRequiredForPosting(tx, koperasiId, kasCoaId),
    )).rejects.toMatchObject({ code: "COA_REQUIRED_FOR_POSTING" });
    await expect(prisma.$transaction((tx) =>
      assertCoaNotRequiredForPosting(tx, koperasiId, linkedRevenueCoaId),
    )).rejects.toMatchObject({ code: "COA_REQUIRED_FOR_POSTING" });
    await expect(prisma.$transaction((tx) =>
      assertCoaNotRequiredForPosting(tx, koperasiId, mutableCoaId),
    )).resolves.toMatchObject({ id: mutableCoaId });
  });

  it("identifies one reversible original and rejects reversal chains/duplicates", async () => {
    await expect(prisma.$transaction((tx) =>
      assertJournalReversible(tx, koperasiId, originalEntryId),
    )).resolves.toMatchObject({ id: originalEntryId, status: "CONFIRMED" });

    const reversal = await prisma.journalEntry.create({
      data: {
        koperasiId,
        nomor: "JU-LIFECYCLE-R",
        keterangan: "Reversal draft",
        sourceChannel: "WEB",
        status: "DRAFT",
        createdById: userId,
        reversalOfId: originalEntryId,
      },
    });
    await expect(prisma.$transaction((tx) =>
      assertJournalReversible(tx, koperasiId, originalEntryId),
    )).rejects.toMatchObject({ code: "REVERSAL_EXISTS" });
    await expect(prisma.$transaction((tx) =>
      assertJournalReversible(tx, koperasiId, reversal.id),
    )).rejects.toMatchObject({ code: "REVERSAL_CHAIN" });
    await expect(prisma.$transaction((tx) =>
      assertJournalReversible(tx, foreignKoperasiId, originalEntryId),
    )).rejects.toMatchObject({ code: "JOURNAL_NOT_FOUND" });
  });
});
