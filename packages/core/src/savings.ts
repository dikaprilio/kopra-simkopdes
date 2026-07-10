import { prisma, type EntrySource } from "@kopra/db";
import { DomainError, createDraftFromSimple, type DraftResult } from "./journal.js";

export interface SavingPayInput {
  koperasiId: string;
  memberQuery?: string; // "bu painem"
  memberId?: string;
  periods: string[]; // ["2026-04","2026-05","2026-06"]
  amount: number; // total
  savingType?: "POKOK" | "WAJIB";
  via?: "KAS" | "BANK";
}

export async function findMember(koperasiId: string, q: string) {
  const rows = await prisma.member.findMany({
    where: { koperasiId, nama: { contains: q, mode: "insensitive" } },
    take: 5,
  });
  if (rows.length === 0) return null;
  return rows.sort((a, b) => a.nama.length - b.nama.length)[0];
}

export interface SavingDraftResult {
  member: { id: string; nama: string };
  periods: string[];
  savingType: "POKOK" | "WAJIB";
  journal: DraftResult;
}

/** Draft pembayaran simpanan (rapel multi-periode) → jurnal draft SAVING_PAYMENT. */
export async function paySavingDraft(
  actorId: string,
  input: SavingPayInput,
  source: EntrySource = "WHATSAPP",
): Promise<SavingDraftResult> {
  const member = input.memberId
    ? await prisma.member.findFirst({ where: { id: input.memberId, koperasiId: input.koperasiId } })
    : await findMember(input.koperasiId, input.memberQuery ?? "");
  if (!member)
    throw new DomainError("MEMBER_NOT_FOUND", `Anggota "${input.memberQuery}" tidak ditemukan.`);
  if (!input.periods.length) throw new DomainError("PERIODS_REQUIRED", "Periode pembayaran kosong.");
  const savingType = input.savingType ?? "WAJIB";

  const journal = await createDraftFromSimple(
    actorId,
    {
      koperasiId: input.koperasiId,
      kind: "SAVING_PAYMENT",
      amount: input.amount,
      via: input.via,
      description: `Pembayaran simpanan ${savingType.toLowerCase()} ${member.nama} (${input.periods.join(", ")})`,
      meta: { memberId: member.id, periods: input.periods, savingType },
    },
    source,
  );
  return { member: { id: member.id, nama: member.nama }, periods: input.periods, savingType, journal };
}

/** Dipanggil pending-action saat YA: jurnal confirm + tandai periode PAID. */
export async function markPeriodsPaid(
  memberId: string,
  savingType: "POKOK" | "WAJIB",
  periods: string[],
  journalEntryId: string,
  amountPerPeriod?: number,
) {
  for (const period of periods) {
    await prisma.memberSaving.upsert({
      where: { memberId_type_period: { memberId, type: savingType, period } },
      update: { status: "PAID", paidAt: new Date(), journalEntryId },
      create: {
        memberId,
        type: savingType,
        period,
        amount: amountPerPeriod ?? 10000,
        status: "PAID",
        paidAt: new Date(),
        journalEntryId,
      },
    });
  }
}

/** Penunggak simpanan wajib per koperasi (utk listUnpaidMembers). */
export async function unpaidMembers(koperasiId: string) {
  const rows = await prisma.$queryRaw<
    { id: string; nama: string; tunggakan: number; total: number; periods: string[] }[]
  >`
    SELECT m.id, m.nama, COUNT(*)::int AS tunggakan, SUM(ms.amount)::float AS total,
           ARRAY_AGG(ms.period ORDER BY ms.period) AS periods
    FROM members m
    JOIN member_savings ms ON ms."memberId" = m.id
    WHERE m."koperasiId" = ${koperasiId} AND ms.status = 'UNPAID' AND ms.type = 'WAJIB'
    GROUP BY m.id, m.nama
    ORDER BY tunggakan DESC, m.nama`;
  return rows;
}

/** Simpanan milik satu member (READ_SELF & kartu anggota). */
export async function memberSavings(memberId: string) {
  return prisma.memberSaving.findMany({
    where: { memberId },
    orderBy: [{ type: "asc" }, { period: "asc" }],
  });
}
