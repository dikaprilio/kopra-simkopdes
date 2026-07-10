/** Reports — angka pasti dari fixture sendiri (kopra_test). */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@kopra/db";
import { DEFAULT_COA } from "../../db/src/coa-default";
import { bukuBesar, neracaSaldo, phu, neraca, bukuKas, dashboardSummary } from "./reports";

let kopId = "";

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
  await prisma.memberSaving.create({
    data: { memberId: member.id, type: "WAJIB", period: "2026-06", amount: 10000, status: "UNPAID" },
  });

  // 3 jurnal CONFIRMED: modal 1.000.000 · penjualan 500.000 · beban 200.000 (+1 DRAFT yg HARUS diabaikan)
  const mk = async (ket: string, dr: string, cr: string, amt: number, status: "CONFIRMED" | "DRAFT", nomor: string) =>
    prisma.journalEntry.create({
      data: {
        koperasiId: kopId, nomor, keterangan: ket, sourceChannel: "SEED", status, createdById: user.id,
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
});
