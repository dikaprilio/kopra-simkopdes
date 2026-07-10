/**
 * Laporan resmi CORE — SEMUA derived dari journal_lines status CONFIRMED.
 * Konsumen: apps/api (Fase 1) & apps/agent (generateFinancialReport, refactor nanti).
 */
import { prisma } from "@kopra/db";

interface RangeOpts { from?: Date; to?: Date }

function monthRange(month?: string): RangeOpts {
  if (!month) return {};
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Saldo per akun (debit − kredit) dari jurnal CONFIRMED dalam rentang. */
async function accountTotals(koperasiId: string, opts: RangeOpts & { businessUnitId?: string } = {}) {
  const { from, to, businessUnitId } = opts;
  return prisma.$queryRaw<
    { id: string; kode: string; nama: string; type: string; debit: number; kredit: number }[]
  >`
    SELECT c.id, c.kode, c.nama, c.type::text AS type,
      COALESCE(SUM(jl.debit) FILTER (WHERE je.id IS NOT NULL), 0)::float AS debit,
      COALESCE(SUM(jl.kredit) FILTER (WHERE je.id IS NOT NULL), 0)::float AS kredit
    FROM coa_accounts c
    LEFT JOIN journal_lines jl ON jl."coaId" = c.id
    LEFT JOIN journal_entries je ON je.id = jl."entryId"
      AND je.status = 'CONFIRMED'
      AND (${from ?? null}::timestamp IS NULL OR je.date >= ${from ?? null}::timestamp)
      AND (${to ?? null}::timestamp IS NULL OR je.date < ${to ?? null}::timestamp)
      AND (${businessUnitId ?? null}::text IS NULL OR je."businessUnitId" = ${businessUnitId ?? null}::text)
    WHERE c."koperasiId" = ${koperasiId}
    GROUP BY c.id, c.kode, c.nama, c.type
    ORDER BY c.kode`;
}

export async function bukuBesar(koperasiId: string, opts: RangeOpts = {}) {
  const rows = await accountTotals(koperasiId, opts);
  return rows.map((r) => ({
    kode: r.kode, nama: r.nama, type: r.type,
    totalDebit: r2(r.debit), totalKredit: r2(r.kredit), saldo: r2(r.debit - r.kredit),
  }));
}

export async function neracaSaldo(koperasiId: string, opts: RangeOpts = {}) {
  const all = await accountTotals(koperasiId, opts);
  const rows = all
    .filter((r) => r.debit !== 0 || r.kredit !== 0)
    .map((r) => ({ kode: r.kode, nama: r.nama, debit: r2(r.debit), kredit: r2(r.kredit) }));
  const totalDebit = r2(rows.reduce((a, r) => a + r.debit, 0));
  const totalKredit = r2(rows.reduce((a, r) => a + r.kredit, 0));
  return { rows, totalDebit, totalKredit, balanced: Math.abs(totalDebit - totalKredit) < 0.005 };
}

export async function phu(koperasiId: string, opts: { month?: string; businessUnitId?: string } = {}) {
  const rows = await accountTotals(koperasiId, { ...monthRange(opts.month), businessUnitId: opts.businessUnitId });
  let pendapatan = 0, beban = 0;
  for (const r of rows) {
    if (r.type === "REVENUE") pendapatan += r.kredit - r.debit;
    if (r.type === "EXPENSE") beban += r.debit - r.kredit;
  }
  return { pendapatan: r2(pendapatan), beban: r2(beban), labaBersih: r2(pendapatan - beban) };
}

export async function neraca(koperasiId: string, opts: { asOf?: Date } = {}) {
  const rows = await accountTotals(koperasiId, { to: opts.asOf });
  let aset = 0, kewajiban = 0, ekuitas = 0, pendapatan = 0, beban = 0;
  for (const r of rows) {
    if (r.type === "ASSET") aset += r.debit - r.kredit;
    if (r.type === "LIABILITY") kewajiban += r.kredit - r.debit;
    if (r.type === "EQUITY") ekuitas += r.kredit - r.debit;
    if (r.type === "REVENUE") pendapatan += r.kredit - r.debit;
    if (r.type === "EXPENSE") beban += r.debit - r.kredit;
  }
  const labaBerjalan = r2(pendapatan - beban);
  return {
    aset: r2(aset), kewajiban: r2(kewajiban), ekuitas: r2(ekuitas), labaBerjalan,
    balanced: Math.abs(r2(aset) - r2(kewajiban + ekuitas + labaBerjalan)) < 0.005,
  };
}

/** Buku Kas = buku besar satu akun (default Kas 111000) sebagai running ledger. */
export async function bukuKas(koperasiId: string, opts: { month?: string; kode?: string } = {}) {
  const { from, to } = monthRange(opts.month);
  const kode = opts.kode ?? "111000";
  const lines = await prisma.$queryRaw<
    { tanggal: Date; nomor: string; keterangan: string; debit: number; kredit: number }[]
  >`
    SELECT je.date AS tanggal, je.nomor, je.keterangan, jl.debit::float AS debit, jl.kredit::float AS kredit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId" AND je.status = 'CONFIRMED'
    JOIN coa_accounts c ON c.id = jl."coaId"
    WHERE je."koperasiId" = ${koperasiId} AND c.kode = ${kode}
      AND (${from ?? null}::timestamp IS NULL OR je.date >= ${from ?? null}::timestamp)
      AND (${to ?? null}::timestamp IS NULL OR je.date < ${to ?? null}::timestamp)
    ORDER BY je.date, je.nomor`;
  let saldo = 0;
  const rows = lines.map((l) => {
    saldo = r2(saldo + l.debit - l.kredit);
    return {
      tanggal: l.tanggal.toISOString().slice(0, 10), nomor: l.nomor, keterangan: l.keterangan,
      debit: r2(l.debit), kredit: r2(l.kredit), saldo,
    };
  });
  return { rows, saldoAkhir: saldo };
}

/** Kartu dashboard ala CORE (semua SQL-derived). */
export async function dashboardSummary(koperasiId: string) {
  const [n, p, totalAnggota, nunggak] = await Promise.all([
    neraca(koperasiId),
    phu(koperasiId),
    prisma.member.count({ where: { koperasiId } }),
    prisma.$queryRaw<{ anggota: number; total: number }[]>`
      SELECT COUNT(DISTINCT m.id)::int AS anggota, COALESCE(SUM(ms.amount), 0)::float AS total
      FROM member_savings ms JOIN members m ON m.id = ms."memberId"
      WHERE m."koperasiId" = ${koperasiId} AND ms.status = 'UNPAID'`,
  ]);
  return {
    totalAset: n.aset, totalKewajiban: n.kewajiban, totalEkuitas: n.ekuitas,
    pendapatan: p.pendapatan, beban: p.beban, labaBersih: p.labaBersih,
    totalAnggota, anggotaNunggak: nunggak[0]?.anggota ?? 0,
    totalSimpananTertunggak: r2(nunggak[0]?.total ?? 0), balanced: n.balanced,
  };
}
