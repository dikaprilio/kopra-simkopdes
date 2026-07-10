import { prisma, Prisma, type JournalEntry, type EntrySource } from "@kopra/db";
import {
  buildLines,
  assertBalanced,
  effectiveAmount,
  PostingError,
  type SimpleEntryInput,
  type PostingLine,
} from "./posting-rules.js";

export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/** kode→id akun COA milik koperasi (buat kalau perlu? — tidak: seed/onboard yg buat). */
async function coaIdByKode(tx: Tx, koperasiId: string, kodes: string[]) {
  const rows = await tx.coaAccount.findMany({
    where: { koperasiId, kode: { in: kodes }, isActive: true },
  });
  const map = new Map(rows.map((r) => [r.kode, r.id]));
  for (const k of kodes)
    if (!map.has(k))
      throw new DomainError("COA_MISSING", `Akun ${k} tidak ada di koperasi ini.`);
  return map;
}

async function nextNomor(tx: Tx, koperasiId: string): Promise<string> {
  const count = await tx.journalEntry.count({ where: { koperasiId } });
  return `JU-${String(count + 1).padStart(3, "0")}`;
}

/** Resolve kode akun pendapatan per unit usaha ("Pendapatan <UNIT>") bila ada. */
export async function revenueKodeForUnit(
  koperasiId: string,
  businessUnitId?: string,
): Promise<string | undefined> {
  if (!businessUnitId) return undefined;
  const unit = await prisma.businessUnit.findFirst({
    where: { id: businessUnitId, koperasiId },
  });
  if (!unit) throw new DomainError("UNIT_MISSING", "Unit usaha tidak ditemukan.");
  const acc = await prisma.coaAccount.findFirst({
    where: { koperasiId, nama: `Pendapatan ${unit.nama}`, isActive: true },
  });
  return acc?.kode;
}

export interface DraftResult {
  entry: JournalEntry & { lines: { coaId: string; debit: Prisma.Decimal; kredit: Prisma.Decimal }[] };
  amount: number;
  lines: PostingLine[];
}

/** Buat jurnal DRAFT dari input sederhana (posting rules). */
export async function createDraftFromSimple(
  actorId: string,
  input: SimpleEntryInput,
  source: EntrySource = "WHATSAPP",
): Promise<DraftResult> {
  input.revenueCoaKode =
    input.revenueCoaKode ??
    (await revenueKodeForUnit(input.koperasiId, input.businessUnitId));
  const lines = buildLines(input);
  const amount = effectiveAmount(input);
  const entry = await prisma.$transaction(async (tx) => {
    const kodeMap = await coaIdByKode(tx, input.koperasiId, lines.map((l) => l.coaKode));
    return tx.journalEntry.create({
      data: {
        koperasiId: input.koperasiId,
        nomor: await nextNomor(tx, input.koperasiId),
        date: input.date ?? new Date(),
        keterangan: input.description,
        businessUnitId: input.businessUnitId,
        sourceChannel: source,
        status: "DRAFT",
        createdById: actorId,
        lines: {
          create: lines.map((l) => ({
            coaId: kodeMap.get(l.coaKode)!,
            debit: l.debit,
            kredit: l.kredit,
          })),
        },
      },
      include: { lines: true },
    });
  });
  return { entry, amount, lines };
}

/** Jurnal MANUAL (dari web / perintah lanjutan) — lines eksplisit, divalidasi balance. */
export async function createManualDraft(
  actorId: string,
  koperasiId: string,
  header: { keterangan: string; referensi?: string; date?: Date; businessUnitId?: string },
  lines: PostingLine[],
  source: EntrySource = "WEB",
) {
  assertBalanced(lines);
  return prisma.$transaction(async (tx) => {
    const kodeMap = await coaIdByKode(tx, koperasiId, lines.map((l) => l.coaKode));
    return tx.journalEntry.create({
      data: {
        koperasiId,
        nomor: await nextNomor(tx, koperasiId),
        keterangan: header.keterangan,
        referensi: header.referensi,
        date: header.date ?? new Date(),
        businessUnitId: header.businessUnitId,
        sourceChannel: source,
        status: "DRAFT",
        createdById: actorId,
        lines: {
          create: lines.map((l) => ({
            coaId: kodeMap.get(l.coaKode)!,
            debit: l.debit,
            kredit: l.kredit,
          })),
        },
      },
      include: { lines: true },
    });
  });
}

/**
 * Konfirmasi DRAFT → CONFIRMED, atomik dgn stock movement linked (bila ada).
 * Guard updateMany(status: DRAFT) ⇒ duplicate-confirm aman (count 0 = sudah/tak ada).
 */
export async function confirmEntry(entryId: string, koperasiId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const res = await tx.journalEntry.updateMany({
      where: { id: entryId, koperasiId, status: "DRAFT" },
      data: { status: "CONFIRMED" },
    });
    if (res.count !== 1)
      throw new DomainError("NOT_DRAFT", "Jurnal tidak ditemukan atau sudah dikonfirmasi.");
    await tx.stockMovement.updateMany({
      where: { journalEntryId: entryId, status: "DRAFT" },
      data: { status: "CONFIRMED" },
    });
  });
}

/** Batalkan DRAFT (hapus lines cascade + movement linked). CONFIRMED tak bisa. */
export async function rejectEntry(entryId: string, koperasiId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: entryId, koperasiId },
      select: { status: true },
    });
    if (!entry) throw new DomainError("NOT_FOUND", "Jurnal tidak ditemukan.");
    if (entry.status !== "DRAFT")
      throw new DomainError("IMMUTABLE", "Jurnal terkonfirmasi tidak bisa dihapus — buat jurnal balik.");
    await tx.stockMovement.deleteMany({ where: { journalEntryId: entryId, status: "DRAFT" } });
    await tx.journalEntry.delete({ where: { id: entryId } });
  });
}

/** Saldo akun by kode (utk balasan bot "saldo kas sekarang…"). */
export async function accountBalance(koperasiId: string, kode: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ saldo: number }[]>`
    SELECT COALESCE(SUM(jl.debit - jl.kredit), 0)::float AS saldo
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl."entryId" AND je.status = 'CONFIRMED'
    JOIN coa_accounts c ON c.id = jl."coaId"
    WHERE je."koperasiId" = ${koperasiId} AND c.kode = ${kode}`;
  return rows[0]?.saldo ?? 0;
}

export { PostingError };
