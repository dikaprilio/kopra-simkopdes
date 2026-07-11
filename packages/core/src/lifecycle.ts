import { Prisma, prisma, type CoaAccount, type JournalEntry } from "@kopra/db";
import { DomainError } from "./errors.js";
import { KODE } from "./posting-rules.js";

export const UNIT_REVENUE_CODE_FIRST = 411_000;
export const UNIT_REVENUE_CODE_LAST = 499_000;
export const UNIT_REVENUE_CODE_STEP = 1_000;
export const UNIT_REVENUE_NAME_PREFIX = "Pendapatan ";

export const REQUIRED_POSTING_COA_CODES = Object.freeze(
  [...new Set(Object.values(KODE))],
);
const REQUIRED_POSTING_COA_CODE_SET = new Set<string>(REQUIRED_POSTING_COA_CODES);

export function activeMemberScope(koperasiId: string): Prisma.MemberWhereInput {
  return { koperasiId, isActive: true };
}

export function activeBusinessUnitScope(koperasiId: string): Prisma.BusinessUnitWhereInput {
  return { koperasiId, isActive: true };
}

export async function findBusinessUnitForWrite(koperasiId: string, query: string) {
  const normalized = query.trim();
  if (!normalized)
    throw new DomainError("UNIT_MISSING", "Unit usaha tidak ditemukan.");
  const candidates = await prisma.businessUnit.findMany({
    where: {
      koperasiId,
      nama: { contains: normalized, mode: "insensitive" },
    },
    orderBy: { nama: "asc" },
    take: 10,
  });
  const active = candidates
    .filter((unit) => unit.isActive)
    .sort((a, b) => a.nama.length - b.nama.length || a.nama.localeCompare(b.nama));
  if (active[0]) return active[0];
  if (candidates.length)
    throw new DomainError("UNIT_ARCHIVED", "Unit usaha sudah diarsipkan.");
  throw new DomainError("UNIT_MISSING", "Unit usaha tidak ditemukan.");
}

export async function assertActiveBusinessUnit(
  tx: Prisma.TransactionClient,
  koperasiId: string,
  businessUnitId?: string,
) {
  if (!businessUnitId) return undefined;
  const unit = await tx.businessUnit.findFirst({
    where: { id: businessUnitId, koperasiId },
    select: { id: true, nama: true, isActive: true },
  });
  if (!unit) throw new DomainError("UNIT_MISSING", "Unit usaha tidak ditemukan.");
  if (!unit.isActive)
    throw new DomainError("UNIT_ARCHIVED", "Unit usaha sudah diarsipkan.");
  return unit;
}

export async function resolveActiveUnitRevenueCoa(
  tx: Prisma.TransactionClient,
  koperasiId: string,
  businessUnitId: string,
): Promise<Pick<CoaAccount, "id" | "kode" | "nama">> {
  const unit = await tx.businessUnit.findFirst({
    where: { id: businessUnitId, koperasiId },
    include: { revenueCoa: true },
  });
  if (!unit) throw new DomainError("UNIT_MISSING", "Unit usaha tidak ditemukan.");
  if (!unit.isActive)
    throw new DomainError("UNIT_ARCHIVED", "Unit usaha sudah diarsipkan.");
  const account = unit.revenueCoa;
  if (!account)
    throw new DomainError("REVENUE_COA_MISSING", "Akun pendapatan unit belum ditautkan.");
  if (account.koperasiId !== koperasiId || account.type !== "REVENUE")
    throw new DomainError("REVENUE_COA_INVALID", "Akun pendapatan unit tidak valid.");
  if (!account.isActive)
    throw new DomainError("REVENUE_COA_ARCHIVED", "Akun pendapatan unit sudah diarsipkan.");
  return { id: account.id, kode: account.kode, nama: account.nama };
}

export async function nextUnitRevenueCode(
  tx: Prisma.TransactionClient,
  koperasiId: string,
): Promise<string> {
  const accounts = await tx.coaAccount.findMany({
    where: { koperasiId },
    select: { kode: true },
  });
  const used = new Set(accounts.map((account) => account.kode));
  for (
    let code = UNIT_REVENUE_CODE_FIRST;
    code <= UNIT_REVENUE_CODE_LAST;
    code += UNIT_REVENUE_CODE_STEP
  ) {
    const candidate = String(code);
    if (!used.has(candidate)) return candidate;
  }
  throw new DomainError(
    "REVENUE_CODE_EXHAUSTED",
    "Rentang kode akun pendapatan unit sudah habis.",
  );
}

export async function assertCoaNotRequiredForPosting(
  tx: Prisma.TransactionClient,
  koperasiId: string,
  coaId: string,
): Promise<CoaAccount> {
  const account = await tx.coaAccount.findFirst({
    where: { id: coaId, koperasiId },
    include: { revenueForUnit: { select: { id: true } } },
  });
  if (!account) throw new DomainError("COA_NOT_FOUND", "Akun COA tidak ditemukan.");
  if (REQUIRED_POSTING_COA_CODE_SET.has(account.kode) || account.revenueForUnit) {
    throw new DomainError(
      "COA_REQUIRED_FOR_POSTING",
      "Akun masih diwajibkan oleh aturan pencatatan.",
    );
  }
  return account;
}

export async function assertJournalReversible(
  tx: Prisma.TransactionClient,
  koperasiId: string,
  entryId: string,
): Promise<JournalEntry> {
  const entry = await tx.journalEntry.findFirst({
    where: { id: entryId, koperasiId },
    include: { reversal: { select: { id: true } } },
  });
  if (!entry)
    throw new DomainError("JOURNAL_NOT_FOUND", "Jurnal tidak ditemukan.");
  if (entry.reversalOfId)
    throw new DomainError("REVERSAL_CHAIN", "Jurnal balik tidak dapat dibalik kembali.");
  if (entry.status !== "CONFIRMED")
    throw new DomainError("JOURNAL_NOT_CONFIRMED", "Hanya jurnal terkonfirmasi yang dapat dibalik.");
  if (entry.reversal)
    throw new DomainError("REVERSAL_EXISTS", "Jurnal ini sudah memiliki jurnal balik.");
  const { reversal: _reversal, ...journal } = entry;
  return journal;
}
