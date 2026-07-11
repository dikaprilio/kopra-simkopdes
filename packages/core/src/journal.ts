import { prisma, Prisma, type JournalEntry, type EntrySource } from "@kopra/db";
import {
  buildLines,
  assertBalanced,
  effectiveAmount,
  PostingError,
  type SimpleEntryInput,
  type PostingLine,
} from "./posting-rules.js";
import { DomainError } from "./errors.js";
import { confirmStockMovementDraft } from "./stock-confirmation.js";
import {
  assertActiveBusinessUnit,
  assertJournalReversible,
  resolveActiveUnitRevenueCoa,
} from "./lifecycle.js";

export { DomainError } from "./errors.js";

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
  // MAX+1, bukan count+1: BATAL menghapus draft sehingga count bisa turun
  // di bawah nomor tertinggi → count+1 menabrak @@unique([koperasiId, nomor]).
  const rows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COALESCE(MAX(SUBSTRING(nomor FROM 4)::int), 0)::int AS n
    FROM journal_entries WHERE "koperasiId" = ${koperasiId} AND nomor ~ '^JU-\\d+$'`;
  return `JU-${String(Number(rows[0]?.n ?? 0) + 1).padStart(3, "0")}`;
}

/** Resolve kode akun pendapatan melalui relasi unit yang aktif dan tenant-safe. */
export async function revenueKodeForUnit(
  koperasiId: string,
  businessUnitId?: string,
): Promise<string | undefined> {
  if (!businessUnitId) return undefined;
  return prisma.$transaction(async (tx) =>
    (await resolveActiveUnitRevenueCoa(tx, koperasiId, businessUnitId)).kode,
  );
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
  return prisma.$transaction(async (tx) => {
    await assertActiveBusinessUnit(tx, input.koperasiId, input.businessUnitId);
    const usesRevenue = input.kind === "INCOME" || input.kind === "STOCK_SALE";
    const revenueCoaKode = input.businessUnitId && usesRevenue
      ? (await resolveActiveUnitRevenueCoa(tx, input.koperasiId, input.businessUnitId)).kode
      : input.revenueCoaKode;
    const resolvedInput = { ...input, revenueCoaKode };
    const lines = buildLines(resolvedInput);
    const amount = effectiveAmount(resolvedInput);
    const kodeMap = await coaIdByKode(tx, input.koperasiId, lines.map((l) => l.coaKode));
    const entry = await tx.journalEntry.create({
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
            catatan: l.catatan,
          })),
        },
      },
      include: { lines: true },
    });
    return { entry, amount, lines };
  });
}

/** Buat satu jurnal balik DRAFT; original CONFIRMED tidak pernah dimutasi. */
export async function createReversalDraft(
  actorId: string,
  koperasiId: string,
  originalId: string,
  input: { date?: Date; keterangan?: string; source?: EntrySource } = {},
) {
  return prisma.$transaction(async (tx) => {
    const original = await assertJournalReversible(tx, koperasiId, originalId);
    if (await tx.stockMovement.findFirst({ where: { journalEntryId: originalId, koperasiId } }))
      throw new DomainError(
        "STOCK_LINKED_REVERSAL",
        "Jurnal stok harus dikoreksi melalui workflow stok.",
      );
    const lines = await tx.journalLine.findMany({ where: { entryId: originalId } });
    return tx.journalEntry.create({
      data: {
        koperasiId,
        nomor: await nextNomor(tx, koperasiId),
        referensi: original.nomor,
        date: input.date ?? new Date(),
        keterangan: input.keterangan ?? `Jurnal balik ${original.nomor}`,
        businessUnitId: original.businessUnitId,
        sourceChannel: input.source ?? "WEB",
        status: "DRAFT",
        reversalOfId: originalId,
        createdById: actorId,
        lines: {
          create: lines.map((line) => ({
            coaId: line.coaId,
            debit: line.kredit,
            kredit: line.debit,
            catatan: line.catatan,
          })),
        },
      },
      include: { lines: true },
    });
  });
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
    await assertActiveBusinessUnit(tx, koperasiId, header.businessUnitId);
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
            catatan: l.catatan,
          })),
        },
      },
      include: { lines: true },
    });
  });
}

/**
 * Jurnal PEMBALIK utk "menghapus" jurnal CONFIRMED secara akuntansi-benar:
 * entri asli tetap immutable; draft baru dgn debit↔kredit tertukar dibuat,
 * commit tetap lewat YA (PendingAction). Return draft + info entri asal.
 */
export async function reverseEntry(actorId: string, nomor: string, koperasiId: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { koperasiId, nomor: { equals: nomor, mode: "insensitive" }, status: "CONFIRMED" },
    include: { lines: { include: { coa: true } } },
  });
  if (!entry)
    throw new DomainError(
      "ENTRY_NOT_FOUND",
      `Jurnal ${nomor} tidak ditemukan / belum CONFIRMED. (Draft cukup dibatalkan dengan BATAL.)`,
    );
  let draft;
  try {
    draft = await createReversalDraft(
      actorId,
      koperasiId,
      entry.id,
      { keterangan: `Pembalik ${entry.nomor}: ${entry.keterangan}`, source: "WHATSAPP" },
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === "REVERSAL_EXISTS")
      throw new DomainError("ALREADY_REVERSED", `Jurnal ${entry.nomor} sudah pernah dibalik.`);
    throw error;
  }
  const total = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  return { draft, asal: { nomor: entry.nomor, keterangan: entry.keterangan }, total };
}

/**
 * Konfirmasi DRAFT → CONFIRMED, atomik dgn stock movement linked (bila ada).
 * Guard updateMany(status: DRAFT) ⇒ duplicate-confirm aman (count 0 = sudah/tak ada).
 */
export async function confirmEntry(entryId: string, koperasiId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const linkedMovement = await tx.stockMovement.findFirst({
      where: { journalEntryId: entryId, koperasiId },
      select: { id: true },
    });
    if (linkedMovement)
      await confirmStockMovementDraft(tx, linkedMovement.id, koperasiId, entryId);

    const res = await tx.journalEntry.updateMany({
      where: { id: entryId, koperasiId, status: "DRAFT" },
      data: { status: "CONFIRMED" },
    });
    if (res.count !== 1)
      throw new DomainError("NOT_DRAFT", "Jurnal tidak ditemukan atau sudah dikonfirmasi.");
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
