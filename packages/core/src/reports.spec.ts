/** Reports — angka pasti dari fixture sendiri (kopra_test). */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import {
  bukuBesar,
  neracaSaldo,
  phu,
  neraca,
  bukuKas,
  dashboardSummary,
  jakartaMonthRange,
  revenueByBusinessUnit,
} from "./reports";
import { unpaidMembers } from "./savings";

let kopId = "", activeMemberId = "";

beforeAll(async () => {
  for (const t of [
    "pending_actions", "member_savings", "stock_movements", "journal_lines",
    "journal_entries", "products", "members", "business_units", "coa_accounts",
    "whatsapp_identities", "users", "koperasi",
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);

  const kop = await prisma.koperasi.create({
    data: { nama: "Kop Report Test", origin: "LOCAL", status: "ACTIVE", managementMode: "OWNER" },
  });
  kopId = kop.id;
  const idByKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({
      data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type,
        parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined },
    });
    idByKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({
    data: { email: "r@t.id", passwordHash: "x", name: "R", role: "PENGURUS", status: "ACTIVE", koperasiId: kopId },
  });
  const member = await prisma.member.create({ data: { koperasiId: kopId, nama: "Bu Nunggak" } });
  activeMemberId = member.id;
  await prisma.memberSaving.create({
    data: { memberId: member.id, type: "WAJIB", period: "2026-06", amount: 10000, status: "UNPAID" },
  });
  const archivedMember = await prisma.member.create({
    data: { koperasiId: kopId, nama: "Bu Arsip", isActive: false },
  });
  await prisma.memberSaving.create({
    data: { memberId: archivedMember.id, type: "WAJIB", period: "2026-06", amount: 25000, status: "UNPAID" },
  });

  // 3 jurnal CONFIRMED: modal 1.000.000 · penjualan 500.000 · beban 200.000 (+1 DRAFT yg HARUS diabaikan)
  const mk = async (ket: string, dr: string, cr: string, amt: number, status: "CONFIRMED" | "DRAFT", nomor: string) =>
    prisma.journalEntry.create({
      data: {
        koperasiId: kopId, nomor, keterangan: ket, sourceChannel: "SEED", status, createdById: user.id,
        date: new Date("2026-07-10T12:00:00+07:00"),
        lines: { create: [
          { coaId: idByKode.get(dr)!, debit: amt, kredit: 0 },
          { coaId: idByKode.get(cr)!, debit: 0, kredit: amt },
        ] },
      },
    });
  await mk("Setoran modal", "111000", "300000", 1_000_000, "CONFIRMED", "JU-001");
  await mk("Penjualan", "111000", "410000", 500_000, "CONFIRMED", "JU-002");
  await mk("Beban listrik", "510000", "111000", 200_000, "CONFIRMED", "JU-003");
  await mk("DRAFT diabaikan", "111000", "410000", 999_999, "DRAFT", "JU-004");
});

describe("reports", () => {
  it("buku besar: kas 1.500.000 D / 200.000 K → saldo 1.300.000; DRAFT diabaikan", async () => {
    const kas = (await bukuBesar(kopId)).find((r) => r.kode === "111000")!;
    expect(kas.totalDebit).toBe(1_500_000);
    expect(kas.totalKredit).toBe(200_000);
    expect(kas.saldo).toBe(1_300_000);
  });

  it("neraca saldo seimbang", async () => {
    const ns = await neracaSaldo(kopId);
    expect(ns.totalDebit).toBe(ns.totalKredit);
    expect(ns.balanced).toBe(true);
  });

  it("PHU: 500.000 − 200.000 = 300.000", async () => {
    expect(await phu(kopId)).toEqual({ pendapatan: 500_000, beban: 200_000, labaBersih: 300_000 });
  });

  it("neraca: aset 1.300.000 = ekuitas 1.000.000 + laba 300.000", async () => {
    const n = await neraca(kopId);
    expect(n.aset).toBe(1_300_000);
    expect(n.kewajiban + n.ekuitas + n.labaBerjalan).toBe(1_300_000);
    expect(n.balanced).toBe(true);
  });

  it("buku kas: 3 baris berjalan, saldo akhir 1.300.000", async () => {
    const bk = await bukuKas(kopId);
    expect(bk.rows).toHaveLength(3);
    expect(bk.saldoAkhir).toBe(1_300_000);
  });

  it("dashboard: kartu + 1 anggota nunggak 10.000", async () => {
    const d = await dashboardSummary(kopId);
    expect(d.labaBersih).toBe(300_000);
    expect(d.totalAnggota).toBe(1);
    expect(d.anggotaNunggak).toBe(1);
    expect(d.totalSimpananTertunggak).toBe(10_000);
    expect(d.balanced).toBe(true);
  });

  it("penunggak operasional tidak memasukkan anggota yang sudah diarsipkan", async () => {
    const rows = await unpaidMembers(kopId);
    expect(rows.map((row) => row.id)).toEqual([activeMemberId]);
    expect(rows[0]).toMatchObject({ tunggakan: 1, total: 10_000 });
  });

  it("neraca as-of mencakup seluruh hari kalender Jakarta yang dipilih", async () => {
    const [user, kas, pendapatan] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { koperasiId: kopId } }),
      prisma.coaAccount.findFirstOrThrow({ where: { koperasiId: kopId, kode: "111000" } }),
      prisma.coaAccount.findFirstOrThrow({ where: { koperasiId: kopId, kode: "410000" } }),
    ]);
    await prisma.journalEntry.create({
      data: {
        koperasiId: kopId,
        nomor: "JU-005",
        keterangan: "Penjualan pada hari as-of",
        date: new Date("2026-07-11T23:59:59.999+07:00"),
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: user.id,
        lines: { create: [
          { coaId: kas.id, debit: 100_000, kredit: 0 },
          { coaId: pendapatan.id, debit: 0, kredit: 100_000 },
        ] },
      },
    });
    await prisma.journalEntry.create({
      data: {
        koperasiId: kopId,
        nomor: "JU-006",
        keterangan: "Penjualan setelah hari as-of",
        date: new Date("2026-07-12T00:00:00+07:00"),
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: user.id,
        lines: { create: [
          { coaId: kas.id, debit: 50_000, kredit: 0 },
          { coaId: pendapatan.id, debit: 0, kredit: 50_000 },
        ] },
      },
    });

    const n = await neraca(kopId, { asOf: new Date("2026-07-11T00:00:00+07:00") });
    expect(n.aset).toBe(1_400_000);
    expect(n.labaBerjalan).toBe(400_000);
    expect(n.balanced).toBe(true);
  });

  it("jurnal dan laporan historis tetap membaca unit yang kemudian diarsipkan", async () => {
    const [user, kas, pendapatan] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { koperasiId: kopId } }),
      prisma.coaAccount.findFirstOrThrow({ where: { koperasiId: kopId, kode: "111000" } }),
      prisma.coaAccount.findFirstOrThrow({ where: { koperasiId: kopId, kode: "410000" } }),
    ]);
    const unit = await prisma.businessUnit.create({
      data: { koperasiId: kopId, nama: "UNIT HISTORIS", isActive: false },
    });
    const entry = await prisma.journalEntry.create({
      data: {
        koperasiId: kopId,
        nomor: "JU-HIST",
        keterangan: "Pendapatan unit sebelum arsip",
        date: new Date("2026-06-01T12:00:00+07:00"),
        businessUnitId: unit.id,
        sourceChannel: "SEED",
        status: "CONFIRMED",
        createdById: user.id,
        lines: { create: [
          { coaId: kas.id, debit: 25_000, kredit: 0 },
          { coaId: pendapatan.id, debit: 0, kredit: 25_000 },
        ] },
      },
      include: { businessUnit: true },
    });

    expect(entry.businessUnit).toMatchObject({ id: unit.id, nama: "UNIT HISTORIS", isActive: false });
    expect(await phu(kopId, { businessUnitId: unit.id })).toEqual({
      pendapatan: 25_000,
      beban: 0,
      labaBersih: 25_000,
    });
  });

  it("unit revenue aggregation uses dimensions, non-41 codes, and net reversals", async () => {
    const [user, kas] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { koperasiId: kopId } }),
      prisma.coaAccount.findFirstOrThrow({ where: { koperasiId: kopId, kode: "111000" } }),
    ]);
    const revenue = await prisma.coaAccount.create({
      data: {
        koperasiId: kopId,
        kode: "420000",
        nama: "Pendapatan Unit Kode Lanjut",
        type: "REVENUE",
      },
    });
    const unit = await prisma.businessUnit.create({
      data: {
        koperasiId: kopId,
        nama: "UNIT KODE LANJUT",
        isActive: false,
        revenueCoaId: revenue.id,
      },
    });
    for (const [nomor, date, debit, kredit] of [
      ["JU-UNIT-420", "2026-06-15T12:00:00+07:00", 0, 100_000],
      ["JU-UNIT-420-R", "2026-06-16T12:00:00+07:00", 30_000, 0],
      ["JU-UNIT-420-START", "2026-06-01T00:00:00+07:00", 0, 10_000],
      ["JU-UNIT-420-END", "2026-06-30T23:59:59.999+07:00", 0, 20_000],
      ["JU-UNIT-420-NEXT", "2026-07-01T00:00:00+07:00", 0, 40_000],
    ] as const) {
      await prisma.journalEntry.create({
        data: {
          koperasiId: kopId,
          nomor,
          keterangan: nomor,
          date: new Date(date),
          businessUnitId: unit.id,
          sourceChannel: "SEED",
          status: "CONFIRMED",
          createdById: user.id,
          lines: { create: [
            { coaId: revenue.id, debit, kredit },
            { coaId: kas.id, debit: kredit, kredit: debit },
          ] },
        },
      });
    }

    const range = jakartaMonthRange("2026-06");
    expect(range).toMatchObject({
      label: "2026-06",
      from: new Date("2026-05-31T17:00:00.000Z"),
      to: new Date("2026-06-30T17:00:00.000Z"),
    });
    const rows = await revenueByBusinessUnit(kopId, range);
    expect(rows.find((row) => row.businessUnitId === unit.id)).toEqual({
      businessUnitId: unit.id,
      unitName: "UNIT KODE LANJUT",
      total: 100_000,
    });
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitName: "UNIT HISTORIS", total: 25_000 }),
    ]));
  });
});
