import { prisma } from "@kopra/db";
import { DomainError } from "./journal.js";

/** Mutasi master data (produk & anggota) — dieksekusi HANYA oleh dispatch pending-action (setelah YA). */

export interface ProductPatch {
  nama?: string;
  unit?: string;
  hargaJual?: number;
}

export async function updateProduct(koperasiId: string, productId: string, patch: ProductPatch) {
  const res = await prisma.product.updateMany({
    where: { id: productId, koperasiId },
    data: {
      ...(patch.nama ? { nama: patch.nama } : {}),
      ...(patch.unit ? { unit: patch.unit } : {}),
      ...(patch.hargaJual !== undefined ? { hargaJual: patch.hargaJual } : {}),
    },
  });
  if (res.count !== 1) throw new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.");
}

/**
 * Delete-guard (konsisten web/api Aldio): produk ber-riwayat movement hanya
 * DINONAKTIFKAN (riwayat pembukuan tetap utuh); tanpa riwayat → dihapus permanen.
 */
export async function deleteProductGuarded(
  koperasiId: string,
  productId: string,
): Promise<"DELETED" | "INACTIVATED"> {
  const product = await prisma.product.findFirst({ where: { id: productId, koperasiId } });
  if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.");
  const movements = await prisma.stockMovement.count({ where: { productId } });
  if (movements > 0) {
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
    return "INACTIVATED";
  }
  await prisma.product.delete({ where: { id: productId } });
  return "DELETED";
}

export async function createMember(
  koperasiId: string,
  data: { nama: string; waNumber?: string },
) {
  const dup = await prisma.member.findFirst({
    where: { koperasiId, nama: { equals: data.nama, mode: "insensitive" } },
  });
  if (dup)
    throw new DomainError("MEMBER_EXISTS", `Anggota bernama "${data.nama}" sudah terdaftar.`);
  return prisma.member.create({
    data: { koperasiId, nama: data.nama, waNumber: data.waNumber },
  });
}
