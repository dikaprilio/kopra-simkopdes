import { Prisma } from "@prisma/client";
import { prisma } from "./index";

export type RevenueCoaBackfillReason =
  | "NO_EXACT_REVENUE_COA"
  | "INACTIVE_EXACT_REVENUE_COA"
  | "MULTIPLE_EXACT_REVENUE_COA"
  | "EXISTING_LINK_MISMATCH"
  | "ACCOUNT_ALREADY_LINKED"
  | "CONCURRENT_CHANGE";

export interface RevenueCoaBackfillIssue {
  unitId: string;
  koperasiId: string;
  unitName: string;
  expectedCoaName: string;
  reason: RevenueCoaBackfillReason;
  candidateCoaIds: string[];
}

export interface RevenueCoaBackfillResult {
  scanned: number;
  linked: number;
  unchanged: number;
  unmatched: RevenueCoaBackfillIssue[];
  ambiguous: RevenueCoaBackfillIssue[];
}

export interface RevenueCoaBackfillOptions {
  koperasiIds?: string[];
}

export type RevenueCoaLinkOutcome =
  | "LINKED"
  | "UNCHANGED"
  | "MISMATCH"
  | "CLAIMED"
  | "CHANGED";

export interface RevenueCoaUnitSnapshot {
  id: string;
  koperasiId: string;
  nama: string;
}

function issue(
  unit: { id: string; koperasiId: string; nama: string },
  expectedCoaName: string,
  reason: RevenueCoaBackfillReason,
  candidateCoaIds: string[] = [],
): RevenueCoaBackfillIssue {
  return {
    unitId: unit.id,
    koperasiId: unit.koperasiId,
    unitName: unit.nama,
    expectedCoaName,
    reason,
    candidateCoaIds,
  };
}

/** Revalidate a previously-read unit/account pair under row locks before linking. */
export async function linkRevenueCoaCandidateIfCurrent(
  unit: RevenueCoaUnitSnapshot,
  expectedCoaName: string,
  candidateId: string,
): Promise<RevenueCoaLinkOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM business_units
        WHERE id = ${unit.id} AND "koperasiId" = ${unit.koperasiId}
        FOR UPDATE`;
      await tx.$queryRaw`
        SELECT id FROM coa_accounts
        WHERE id = ${candidateId}
        FOR UPDATE`;

      const [currentUnit, currentCandidates, claimant] = await Promise.all([
        tx.businessUnit.findFirst({
          where: { id: unit.id, koperasiId: unit.koperasiId },
          select: { nama: true, revenueCoaId: true },
        }),
        tx.coaAccount.findMany({
          where: {
            koperasiId: unit.koperasiId,
            nama: expectedCoaName,
            type: "REVENUE",
            isActive: true,
          },
          select: { id: true },
        }),
        tx.businessUnit.findFirst({
          where: { revenueCoaId: candidateId },
          select: { id: true },
        }),
      ]);

      if (
        !currentUnit
        || currentUnit.nama !== unit.nama
        || currentCandidates.length !== 1
        || currentCandidates[0].id !== candidateId
      ) return "CHANGED";
      if (currentUnit.revenueCoaId === candidateId) return "UNCHANGED";
      if (currentUnit.revenueCoaId) return "MISMATCH";
      if (claimant && claimant.id !== unit.id) return "CLAIMED";

      await tx.businessUnit.update({
        where: { id: unit.id },
        data: { revenueCoaId: candidateId },
      });
      return "LINKED";
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) return "CLAIMED";
    throw error;
  }
}

/**
 * Link legacy units to an exact `Pendapatan <nama unit>` account in the same
 * koperasi. The command never creates, renames, or recodes an account and never
 * guesses when there is no single match.
 */
export async function backfillBusinessUnitRevenueCoa(
  options: RevenueCoaBackfillOptions = {},
): Promise<RevenueCoaBackfillResult> {
  const units = await prisma.businessUnit.findMany({
    where: options.koperasiIds
      ? { koperasiId: { in: options.koperasiIds } }
      : undefined,
    include: {
      revenueCoa: {
        select: { id: true, koperasiId: true, nama: true, type: true, isActive: true },
      },
    },
    orderBy: [{ koperasiId: "asc" }, { nama: "asc" }, { id: "asc" }],
  });

  const result: RevenueCoaBackfillResult = {
    scanned: units.length,
    linked: 0,
    unchanged: 0,
    unmatched: [],
    ambiguous: [],
  };

  for (const unit of units) {
    const expectedCoaName = `Pendapatan ${unit.nama}`;
    if (unit.revenueCoaId) {
      const linked = unit.revenueCoa;
      if (
        linked
        && linked.koperasiId === unit.koperasiId
        && linked.nama === expectedCoaName
        && linked.type === "REVENUE"
        && linked.isActive
      ) {
        result.unchanged += 1;
      } else {
        result.ambiguous.push(issue(
          unit,
          expectedCoaName,
          "EXISTING_LINK_MISMATCH",
          linked ? [linked.id] : [],
        ));
      }
      continue;
    }

    const exactAccounts = await prisma.coaAccount.findMany({
      where: {
        koperasiId: unit.koperasiId,
        nama: expectedCoaName,
        type: "REVENUE",
      },
      orderBy: { id: "asc" },
      select: { id: true, isActive: true },
    });
    const candidates = exactAccounts.filter((account) => account.isActive);
    if (candidates.length === 0) {
      const inactiveIds = exactAccounts.map((account) => account.id);
      result.unmatched.push(issue(
        unit,
        expectedCoaName,
        inactiveIds.length ? "INACTIVE_EXACT_REVENUE_COA" : "NO_EXACT_REVENUE_COA",
        inactiveIds,
      ));
      continue;
    }
    if (candidates.length > 1) {
      result.ambiguous.push(issue(
        unit,
        expectedCoaName,
        "MULTIPLE_EXACT_REVENUE_COA",
        candidates.map((candidate) => candidate.id),
      ));
      continue;
    }

    const candidateId = candidates[0].id;
    const outcome = await linkRevenueCoaCandidateIfCurrent(
      unit,
      expectedCoaName,
      candidateId,
    );

    if (outcome === "LINKED") result.linked += 1;
    else if (outcome === "UNCHANGED") result.unchanged += 1;
    else {
      const reason: RevenueCoaBackfillReason = outcome === "MISMATCH"
        ? "EXISTING_LINK_MISMATCH"
        : outcome === "CLAIMED"
          ? "ACCOUNT_ALREADY_LINKED"
          : "CONCURRENT_CHANGE";
      result.ambiguous.push(issue(unit, expectedCoaName, reason, [candidateId]));
    }
  }

  return result;
}
