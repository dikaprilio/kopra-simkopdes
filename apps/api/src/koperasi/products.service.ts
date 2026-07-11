import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  currentStock,
  writeWebMutationAudit,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

const PRODUCT_SELECT = {
  id: true,
  nama: true,
  unit: true,
  barcode: true,
  hargaJual: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

function normalizeRequired(value: string): string {
  const result = value?.trim().replace(/\s+/g, ' ');
  if (!result) throw new BadRequestException('NAMA_PRODUK_TIDAK_VALID');
  return result;
}

function normalizeNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  return value.trim().replace(/\s+/g, ' ');
}

function safeProduct(product: ProductRow, stok?: number) {
  return {
    ...product,
    hargaJual: product.hargaJual?.toString() ?? null,
    ...(stok === undefined ? {} : { stok }),
  };
}

@Injectable()
export class ProductsService {
  async list(koperasiId: string, q: { search?: string; active?: string; lowStock?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.ProductWhereInput = { koperasiId };
    if (q.active !== 'all') where.isActive = q.active === 'false' ? false : true;
    const search = q.search?.trim();
    if (search) where.nama = { contains: search, mode: 'insensitive' };
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ nama: 'asc' }, { id: 'asc' }],
      select: PRODUCT_SELECT,
    });
    const stockRows = await prisma.$queryRaw<{ productId: string; stok: number }[]>`
      SELECT p.id AS "productId", COALESCE(SUM(CASE sm.type
        WHEN 'IN' THEN sm.qty
        WHEN 'OUT' THEN -sm.qty
        ELSE sm.qty END) FILTER (WHERE sm.status = 'CONFIRMED'), 0)::float AS stok
      FROM products p
      LEFT JOIN stock_movements sm ON sm."productId" = p.id
      WHERE p."koperasiId" = ${koperasiId}
      GROUP BY p.id`;
    const stokById = new Map(stockRows.map((row) => [row.productId, row.stok]));
    let rows = products.map((product) => safeProduct(product, stokById.get(product.id) ?? 0));
    if (q.lowStock === 'true') rows = rows.filter((row) => row.isActive && (row.stok ?? 0) <= 5);
    return { data: rows.slice(skip, skip + take), page, pageSize, total: rows.length };
  }

  async detail(koperasiId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, koperasiId },
      select: PRODUCT_SELECT,
    });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    return safeProduct(product, await currentStock(id));
  }

  async card(koperasiId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const [stok, movements] = await Promise.all([
      currentStock(id),
      prisma.stockMovement.findMany({ where: { productId: id }, orderBy: { date: 'desc' } }),
    ]);
    return serializeDecimals({
      product: { id: product.id, nama: product.nama, unit: product.unit, hargaJual: product.hargaJual },
      stok, movements,
    });
  }

  async create(koperasiId: string, actorId: string, dto: CreateProductDto) {
    const nama = normalizeRequired(dto.nama);
    const unit = normalizeNullable(dto.unit);
    const barcode = normalizeNullable(dto.barcode);
    const exists = await prisma.product.findUnique({ where: { koperasiId_nama: { koperasiId, nama } } });
    if (exists) throw new ConflictException('PRODUK_SUDAH_ADA');
    const product = await prisma.product.create({
      data: { koperasiId, nama, unit, barcode, hargaJual: dto.hargaJual },
      select: PRODUCT_SELECT,
    });
    await writeWebMutationAudit({
      koperasiId, actorId,
      resourceType: WEB_AUDIT_RESOURCE.PRODUCT,
      mutation: WEB_AUDIT_MUTATION.CREATE,
      resourceRef: product.id,
      payload: { hasBarcode: Boolean(barcode), hasSalePrice: dto.hargaJual !== undefined },
    });
    return safeProduct(product);
  }

  async update(koperasiId: string, actorId: string, id: string, dto: UpdateProductDto) {
    const existing = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!existing) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const data: Prisma.ProductUpdateInput = {};
    if (dto.nama !== undefined) {
      const nama = normalizeRequired(dto.nama);
      const duplicate = await prisma.product.findUnique({
        where: { koperasiId_nama: { koperasiId, nama } },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) throw new ConflictException('PRODUK_SUDAH_ADA');
      data.nama = nama;
    }
    if (dto.unit !== undefined) data.unit = normalizeNullable(dto.unit);
    if (dto.barcode !== undefined) data.barcode = normalizeNullable(dto.barcode);
    if (dto.hargaJual !== undefined) data.hargaJual = dto.hargaJual;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const product = await prisma.product.update({
      where: { id },
      data,
      select: PRODUCT_SELECT,
    });
    const mutation = !existing.isActive && dto.isActive === true
      ? WEB_AUDIT_MUTATION.REACTIVATE
      : existing.isActive && dto.isActive === false
        ? WEB_AUDIT_MUTATION.ARCHIVE
        : WEB_AUDIT_MUTATION.UPDATE;
    await writeWebMutationAudit({
      koperasiId, actorId,
      resourceType: WEB_AUDIT_RESOURCE.PRODUCT,
      mutation,
      resourceRef: product.id,
      payload: { changedFields: Object.keys(dto) },
    });
    return safeProduct(product);
  }

  /** Delete-guard: produk ber-movement tidak dihapus — inactive. */
  async remove(koperasiId: string, actorId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const count = await prisma.stockMovement.count({ where: { productId: id } });
    if (count > 0) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      await writeWebMutationAudit({
        koperasiId, actorId,
        resourceType: WEB_AUDIT_RESOURCE.PRODUCT,
        mutation: WEB_AUDIT_MUTATION.ARCHIVE,
        resourceRef: id,
        payload: { preservedMovements: count },
      });
      return { inactivated: true };
    }
    await prisma.product.delete({ where: { id } });
    await writeWebMutationAudit({
      koperasiId, actorId,
      resourceType: WEB_AUDIT_RESOURCE.PRODUCT,
      mutation: WEB_AUDIT_MUTATION.DELETE,
      resourceRef: id,
      payload: { preservedMovements: 0 },
    });
    return { deleted: true };
  }
}
