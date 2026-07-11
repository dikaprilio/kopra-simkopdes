/**
 * Laporan resmi CORE — SEMUA derived dari journal_lines status CONFIRMED.
 * Konsumen: apps/api (Fase 1) & apps/agent (generateFinancialReport, refactor nanti).
 */
import { prisma } from "@kopra/db";
import { activeMemberScope } from "./lifecycle.js";

interface RangeOpts { from?: Date; to?: Date }

const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export function currentJakartaMonth(now = new Date()): string {
  return new Date(now.getTime() + JAKARTA_UTC_OFFSET_MS).toISOString().slice(0, 7);
}

export function jakartaMonthRange(month = currentJakartaMonth()): {
  from: Date;
  to: Date;
  label: string;
} {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new RangeError("Month must use YYYY-MM format.");
  const [y, m] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(y, m - 1, 1) - JAKARTA_UTC_OFFSET_MS),
    to: new Date(Date.UTC(y, m, 1) - JAKARTA_UTC_OFFSET_MS),
    label: month,
  };
}

function monthRange(month?: string): RangeOpts {
  if (!month) return {};
  const { from, to } = jakartaMonthRange(month);
  return { from, to };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function jakartaDateStart(label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(label))
    throw new RangeError("Date must use YYYY-MM-DD format.");
  const [year, month, day] = label.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day) - JAKARTA_UTC_OFFSET_MS);
  const local = new Date(result.getTime() + JAKARTA_UTC_OFFSET_MS);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  ) throw new RangeError("Date is not valid.");
  return result;
}

export function jakartaInclusiveRange(from?: string, to?: string): RangeOpts {
  if (from && to && from > to) throw new RangeError("Date range is not valid.");
  return {
    from: from ? jakartaDateStart(from) : undefined,
    to: to ? nextJakartaDayStart(jakartaDateStart(to)) : undefined,
  };
}

function nextJakartaDayStart(date: Date): Date {
  const jakarta = new Date(date.getTime() + JAKARTA_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate() + 1) -
      JAKARTA_UTC_OFFSET_MS,
  );
}

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
      AND (${from ?? null}::timestamptz IS NULL OR je.date >= (${from ?? null}::timestamptz AT TIME ZONE 'UTC'))
      AND (${to ?? null}::timestamptz IS NULL OR je.date < (${to ?? null}::timestamptz AT TIME ZONE 'UTC'))
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

export async function revenueByBusinessUnit(
  koperasiId: string,
  opts: RangeOpts = {},
): Promise<{ businessUnitId: string; unitName: string; total: number }[]> {
  const { from, to } = opts;
  const rows = await prisma.$queryRaw<
    { businessUnitId: string; unitName: string; total: number }[]
  >`
    SELECT
      bu.id AS "businessUnitId",
      bu.nama AS "unitName",
      SUM(jl.kredit - jl.debit)::float AS total
    FROM journal_entries je
    JOIN business_units bu
      ON bu.id = je."businessUnitId"
      AND bu."koperasiId" = je."koperasiId"
    JOIN journal_lines jl ON jl."entryId" = je.id
    JOIN coa_accounts c
      ON c.id = jl."coaId"
      AND c."koperasiId" = je."koperasiId"
    WHERE je."koperasiId" = ${koperasiId}
      AND je.status = 'CONFIRMED'
      AND c.type = 'REVENUE'
      AND (${from ?? null}::timestamptz IS NULL OR je.date >= (${from ?? null}::timestamptz AT TIME ZONE 'UTC'))
      AND (${to ?? null}::timestamptz IS NULL OR je.date < (${to ?? null}::timestamptz AT TIME ZONE 'UTC'))
    GROUP BY bu.id, bu.nama
    HAVING ABS(SUM(jl.kredit - jl.debit)) > 0.005
    ORDER BY total DESC, bu.nama`;
  return rows.map((row) => ({ ...row, total: r2(row.total) }));
}

export async function neraca(koperasiId: string, opts: { asOf?: Date } = {}) {
  const rows = await accountTotals(koperasiId, { to: opts.asOf ? nextJakartaDayStart(opts.asOf) : undefined });
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
      AND (${from ?? null}::timestamptz IS NULL OR je.date >= (${from ?? null}::timestamptz AT TIME ZONE 'UTC'))
      AND (${to ?? null}::timestamptz IS NULL OR je.date < (${to ?? null}::timestamptz AT TIME ZONE 'UTC'))
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
    prisma.member.count({ where: activeMemberScope(koperasiId) }),
    prisma.$queryRaw<{ anggota: number; total: number }[]>`
      SELECT COUNT(DISTINCT m.id)::int AS anggota, COALESCE(SUM(ms.amount), 0)::float AS total
      FROM member_savings ms JOIN members m ON m.id = ms."memberId"
      WHERE m."koperasiId" = ${koperasiId} AND m."isActive" = true
        AND ms.status = 'UNPAID'`,
  ]);
  return {
    totalAset: n.aset, totalKewajiban: n.kewajiban, totalEkuitas: n.ekuitas,
    pendapatan: p.pendapatan, beban: p.beban, labaBersih: p.labaBersih,
    totalAnggota, anggotaNunggak: nunggak[0]?.anggota ?? 0,
    totalSimpananTertunggak: r2(nunggak[0]?.total ?? 0), balanced: n.balanced,
  };
}
