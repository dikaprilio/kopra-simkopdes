import type { Prisma } from "@kopra/db";
import { DomainError } from "./errors.js";

type Tx = Prisma.TransactionClient;

/**
 * Konfirmasi satu movement DRAFT di dalam transaksi pemanggil.
 * Lock baris produk menyerialkan seluruh konfirmasi untuk produk yang sama,
 * sehingga OUT kedua membaca stok terbaru setelah transaksi pertama commit.
 */
export async function confirmStockMovementDraft(
  tx: Tx,
  movementId: string,
  koperasiId: string,
  expectedJournalEntryId: string | null,
): Promise<void> {
  const initial = await tx.stockMovement.findFirst({
    where: { id: movementId, koperasiId },
    select: { productId: true },
  });
  if (!initial)
    throw new DomainError("NOT_DRAFT", "Movement tidak ditemukan atau sudah dikonfirmasi.");

  const products = await tx.$queryRaw<{ id: string; nama: string }[]>`
    SELECT id, nama
    FROM products
    WHERE id = ${initial.productId} AND "koperasiId" = ${koperasiId}
    FOR UPDATE`;
  const product = products[0];
  if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.");

  const movement = await tx.stockMovement.findFirst({
    where: {
      id: movementId,
      koperasiId,
      status: "DRAFT",
      journalEntryId: expectedJournalEntryId,
    },
    select: { productId: true, type: true, qty: true },
  });
  if (!movement)
    throw new DomainError("NOT_DRAFT", "Movement tidak ditemukan atau sudah dikonfirmasi.");

  if (movement.type === "OUT" || movement.type === "ADJUST") {
    const rows = await tx.$queryRaw<{ stok: number }[]>`
      SELECT COALESCE(SUM(CASE type
        WHEN 'IN' THEN qty
        WHEN 'OUT' THEN -qty
        ELSE qty END), 0)::float AS stok
      FROM stock_movements
      WHERE "productId" = ${movement.productId} AND status = 'CONFIRMED'`;
    const stok = rows[0]?.stok ?? 0;
    const qty = Number(movement.qty);
    if ((movement.type === "OUT" && qty > stok) || (movement.type === "ADJUST" && stok + qty < 0))
      throw new DomainError(
        "INSUFFICIENT_STOCK",
        movement.type === "OUT"
          ? `Stok ${product.nama} tinggal ${stok}, tidak cukup untuk keluar ${qty}.`
          : `Stok ${product.nama} tinggal ${stok}, koreksi ${qty} akan membuat stok negatif.`,
      );
  }

  const updated = await tx.stockMovement.updateMany({
    where: {
      id: movementId,
      koperasiId,
      status: "DRAFT",
      journalEntryId: expectedJournalEntryId,
    },
    data: { status: "CONFIRMED" },
  });
  if (updated.count !== 1)
    throw new DomainError("NOT_DRAFT", "Movement tidak ditemukan atau sudah dikonfirmasi.");
}
