import { prisma, type EntrySource, type StockMoveType } from "@kopra/db";
import { DomainError, createDraftFromSimple, type DraftResult } from "./journal.js";
import { confirmStockMovementDraft } from "./stock-confirmation.js";

/** Stok terkini = SUM bertanda movement CONFIRMED (IN +, OUT −, ADJUST ±qty). */
export async function currentStock(productId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ stok: number }[]>`
    SELECT COALESCE(SUM(CASE type
      WHEN 'IN' THEN qty
      WHEN 'OUT' THEN -qty
      ELSE qty END), 0)::float AS stok
    FROM stock_movements
    WHERE "productId" = ${productId} AND status = 'CONFIRMED'`;
  return rows[0]?.stok ?? 0;
}

/** Cari produk by nama (fuzzy contains, pilih nama terpendek = paling spesifik). */
export async function findProduct(koperasiId: string, q: string) {
  const rows = await prisma.product.findMany({
    where: { koperasiId, isActive: true, nama: { contains: q, mode: "insensitive" } },
    orderBy: { nama: "asc" },
    take: 5,
  });
  if (rows.length === 0) return null;
  return rows.sort((a, b) => a.nama.length - b.nama.length)[0];
}

export interface StockDraftInput {
  koperasiId: string;
  productQuery?: string; // nama dari ucapan pengurus
  productId?: string;
  type: StockMoveType; // IN|OUT|ADJUST
  qty: number;
  hargaBeli?: number;
  hargaJual?: number;
  businessUnitId?: string;
  description?: string;
  date?: Date;
}

export interface StockDraftResult {
  movementId: string;
  product: { id: string; nama: string; unit: string | null };
  qty: number;
  stokSebelum: number;
  stokSesudah: number;
  journal?: DraftResult; // utk OUT-jual / IN-beli
}

/**
 * Draft movement (+jurnal linked utk penjualan/pembelian).
 * OUT tanpa harga → movement-only (mis. barang rusak → nanti ADJUST).
 */
export async function createMovementDraft(
  actorId: string,
  input: StockDraftInput,
  source: EntrySource = "WHATSAPP",
): Promise<StockDraftResult> {
  const product = input.productId
    ? await prisma.product.findFirst({
        where: { id: input.productId, koperasiId: input.koperasiId, isActive: true },
      })
    : await findProduct(input.koperasiId, input.productQuery ?? "");
  if (!product)
    throw new DomainError(
      "PRODUCT_NOT_FOUND",
      `Produk "${input.productQuery ?? input.productId}" belum terdaftar.`,
    );
  if (input.type === "ADJUST" ? input.qty === 0 : input.qty <= 0)
    throw new DomainError("QTY_INVALID", "Jumlah harus lebih dari 0.");

  const stok = await currentStock(product.id);
  if (input.type === "OUT" && input.qty > stok)
    throw new DomainError(
      "INSUFFICIENT_STOCK",
      `Stok ${product.nama} tinggal ${stok}, tidak cukup untuk keluar ${input.qty}.`,
    );
  if (input.type === "ADJUST" && stok + input.qty < 0)
    throw new DomainError(
      "INSUFFICIENT_STOCK",
      `Stok ${product.nama} tinggal ${stok}, koreksi ${input.qty} akan membuat stok negatif.`,
    );

  // jurnal linked?
  let journal: DraftResult | undefined;
  const hargaJual = input.hargaJual ?? (product.hargaJual ? Number(product.hargaJual) : undefined);
  if (input.type === "OUT" && hargaJual) {
    journal = await createDraftFromSimple(
      actorId,
      {
        koperasiId: input.koperasiId,
        kind: "STOCK_SALE",
        description: input.description ?? `Penjualan ${product.nama} × ${input.qty}`,
        businessUnitId: input.businessUnitId,
        date: input.date,
        meta: { productId: product.id, qty: input.qty, hargaJual },
      },
      source,
    );
  } else if (input.type === "IN" && input.hargaBeli) {
    journal = await createDraftFromSimple(
      actorId,
      {
        koperasiId: input.koperasiId,
        kind: "STOCK_PURCHASE",
        description: input.description ?? `Belanja stok ${product.nama} × ${input.qty}`,
        businessUnitId: input.businessUnitId,
        date: input.date,
        meta: { productId: product.id, qty: input.qty, hargaBeli: input.hargaBeli },
      },
      source,
    );
  }

  const movement = await prisma.stockMovement.create({
    data: {
      koperasiId: input.koperasiId,
      productId: product.id,
      type: input.type,
      qty: input.qty,
      hargaBeli: input.hargaBeli,
      hargaJual,
      journalEntryId: journal?.entry.id,
      sourceChannel: source,
      status: "DRAFT",
      createdById: actorId,
      date: input.date,
    },
  });

  const delta = input.type === "OUT" ? -input.qty : input.qty;
  return {
    movementId: movement.id,
    product: { id: product.id, nama: product.nama, unit: product.unit },
    qty: input.qty,
    stokSebelum: stok,
    stokSesudah: stok + delta,
    journal,
  };
}

/** Konfirmasi movement TANPA jurnal linked (ADJUST / OUT non-jual). */
export async function confirmMovementOnly(movementId: string, koperasiId: string) {
  await prisma.$transaction((tx) =>
    confirmStockMovementDraft(tx, movementId, koperasiId, null),
  );
}

export async function cancelMovement(movementId: string, koperasiId: string) {
  await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.findFirst({
      where: { id: movementId, koperasiId },
      select: { status: true, journalEntryId: true },
    });
    if (!movement) throw new DomainError("NOT_FOUND", "Movement tidak ditemukan.");
    if (movement.status !== "DRAFT")
      throw new DomainError("IMMUTABLE", "Movement terkonfirmasi tidak dapat dibatalkan.");
    await tx.stockMovement.delete({ where: { id: movementId } });
    if (movement.journalEntryId) {
      const deleted = await tx.journalEntry.deleteMany({
        where: { id: movement.journalEntryId, koperasiId, status: "DRAFT" },
      });
      if (deleted.count !== 1)
        throw new DomainError("IMMUTABLE", "Jurnal terkait sudah terkonfirmasi.");
    }
  });
}

/** Daftar stok (utk getStockLevels & "hampir habis"). */
export async function stockLevels(koperasiId: string, lowThreshold = 5) {
  const rows = await prisma.$queryRaw<
    { id: string; nama: string; unit: string | null; stok: number }[]
  >`
    SELECT p.id, p.nama, p.unit,
      COALESCE(SUM(CASE sm.type WHEN 'IN' THEN sm.qty WHEN 'OUT' THEN -sm.qty ELSE sm.qty END)
        FILTER (WHERE sm.status = 'CONFIRMED'), 0)::float AS stok
    FROM products p
    LEFT JOIN stock_movements sm ON sm."productId" = p.id
    WHERE p."koperasiId" = ${koperasiId} AND p."isActive" = true
    GROUP BY p.id ORDER BY p.nama`;
  return { all: rows, low: rows.filter((r) => r.stok <= lowThreshold) };
}
