import { prisma, type PendingAction } from "@kopra/db";
import { DomainError, confirmEntry, rejectEntry, accountBalance } from "./journal.js";
import { confirmMovementOnly, cancelMovement } from "./stock.js";
import { markPeriodsPaid } from "./savings.js";
import { createMember, deleteProductGuarded, updateProduct, type ProductPatch } from "./catalog.js";
import { KODE } from "./posting-rules.js";

const TTL_MS = Number(process.env.PENDING_ACTION_TTL_SECONDS ?? 900) * 1000;

export type ActionType =
  | "JOURNAL_SIMPLE"
  | "JOURNAL_MANUAL"
  | "STOCK_MOVE"
  | "SAVING_PAY"
  | "PRODUCT_CREATE"
  | "PRODUCT_UPDATE"
  | "PRODUCT_DELETE"
  | "MEMBER_CREATE";

export interface PendingPayload {
  /** teks preview persis yang dikirim ke user */
  previewText: string;
  entryId?: string;
  movementId?: string;
  saving?: { memberId: string; savingType: "POKOK" | "WAJIB"; periods: string[]; amountPerPeriod?: number };
  product?: { nama: string; hargaJual?: number; unit?: string };
  productUpdate?: { productId: string; patch: ProductPatch };
  productDelete?: { productId: string };
  member?: { nama: string; waNumber?: string };
  via?: "KAS" | "BANK";
}

export async function getAwaiting(chatJid: string): Promise<PendingAction | null> {
  return prisma.pendingAction.findFirst({
    where: { chatJid, state: "AWAITING_CONFIRM" },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPending(args: {
  chatJid: string;
  actorId: string;
  koperasiId: string;
  actionType: ActionType;
  payload: PendingPayload;
}): Promise<PendingAction> {
  const existing = await getAwaiting(args.chatJid);
  if (existing && existing.expiresAt > new Date())
    throw new DomainError(
      "PENDING_EXISTS",
      "⏳ Masih ada draft menunggu keputusan. Balas *YA*/*BATAL* dulu ya, baru lanjut yang baru.",
    );
  if (existing) {
    await prisma.pendingAction.update({ where: { id: existing.id }, data: { state: "EXPIRED" } });
  }
  return prisma.pendingAction.create({
    data: {
      chatJid: args.chatJid,
      actorId: args.actorId,
      koperasiId: args.koperasiId,
      actionType: args.actionType,
      preview: args.payload as object,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
}

export interface ConfirmResult {
  actionType: ActionType;
  saldoKas: number;
  nomorJurnal?: string;
}

/**
 * "YA" — konfirmasi atomik & idempotent:
 * guard updateMany(state AWAITING_CONFIRM → CONFIRMED) di dalam transaksi;
 * duplicate YA / webhook retry ⇒ count 0 ⇒ NO_PENDING (tanpa efek ganda).
 */
export async function confirmPending(chatJid: string, actorId: string): Promise<ConfirmResult> {
  const pending = await getAwaiting(chatJid);
  if (!pending) throw new DomainError("NO_PENDING", "Tidak ada draft yang menunggu konfirmasi.");
  if (pending.actorId !== actorId)
    throw new DomainError("WRONG_ACTOR", "Draft ini menunggu konfirmasi dari pembuatnya.");
  if (pending.expiresAt < new Date()) {
    await prisma.pendingAction.update({ where: { id: pending.id }, data: { state: "EXPIRED" } });
    throw new DomainError("EXPIRED", "Draft kedaluwarsa (15 menit). Silakan ulangi perintahnya.");
  }

  const payload = pending.preview as unknown as PendingPayload;

  const res = await prisma.pendingAction.updateMany({
    where: { id: pending.id, state: "AWAITING_CONFIRM" },
    data: { state: "CONFIRMED" },
  });
  if (res.count !== 1) throw new DomainError("NO_PENDING", "Draft sudah diproses.");

  try {
    let nomorJurnal: string | undefined;
    if (payload.entryId) {
      await confirmEntry(payload.entryId, pending.koperasiId);
      const e = await prisma.journalEntry.findUnique({ where: { id: payload.entryId } });
      nomorJurnal = e?.nomor;
      if (pending.actionType === "SAVING_PAY" && payload.saving) {
        await markPeriodsPaid(
          payload.saving.memberId,
          payload.saving.savingType,
          payload.saving.periods,
          payload.entryId,
          payload.saving.amountPerPeriod,
        );
      }
    } else if (payload.movementId) {
      await confirmMovementOnly(payload.movementId, pending.koperasiId);
    } else if (pending.actionType === "PRODUCT_CREATE" && payload.product) {
      await prisma.product.create({
        data: {
          koperasiId: pending.koperasiId,
          nama: payload.product.nama,
          unit: payload.product.unit,
          hargaJual: payload.product.hargaJual,
        },
      });
    } else if (pending.actionType === "PRODUCT_UPDATE" && payload.productUpdate) {
      await updateProduct(pending.koperasiId, payload.productUpdate.productId, payload.productUpdate.patch);
    } else if (pending.actionType === "PRODUCT_DELETE" && payload.productDelete) {
      await deleteProductGuarded(pending.koperasiId, payload.productDelete.productId);
    } else if (pending.actionType === "MEMBER_CREATE" && payload.member) {
      await createMember(pending.koperasiId, payload.member);
    }
    const kode = payload.via === "BANK" ? KODE.BANK : KODE.KAS;
    const saldoKas = await accountBalance(pending.koperasiId, kode);
    return { actionType: pending.actionType as ActionType, saldoKas, nomorJurnal };
  } catch (e) {
    // rollback state supaya user bisa YA ulang setelah perbaikan
    await prisma.pendingAction.update({
      where: { id: pending.id },
      data: { state: "AWAITING_CONFIRM" },
    });
    throw e;
  }
}

/** "BATAL" — hapus draft & tutup pending. */
export async function cancelPending(chatJid: string, actorId: string): Promise<void> {
  const pending = await getAwaiting(chatJid);
  if (!pending) throw new DomainError("NO_PENDING", "Tidak ada draft yang menunggu.");
  if (pending.actorId !== actorId)
    throw new DomainError("WRONG_ACTOR", "Draft ini milik pengguna lain.");
  const payload = pending.preview as unknown as PendingPayload;
  if (payload.movementId) await cancelMovement(payload.movementId, pending.koperasiId);
  if (payload.entryId) await rejectEntry(payload.entryId, pending.koperasiId).catch(() => {});
  await prisma.pendingAction.update({ where: { id: pending.id }, data: { state: "CANCELLED" } });
}
