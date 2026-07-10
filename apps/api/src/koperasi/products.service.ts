import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { currentStock, stockLevels } from '@kopra/core';
import { serializeDecimals } from '../common/http';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  async list(koperasiId: string, search?: string) {
    const { all } = await stockLevels(koperasiId); // produk aktif + stok
    const stokById = new Map(all.map((r) => [r.id, r.stok]));
    const products = await prisma.product.findMany({
      where: { koperasiId, ...(search ? { nama: { contains: search, mode: 'insensitive' } } : {}) },
      orderBy: { nama: 'asc' },
    });
    return products.map((p) => ({
      id: p.id, nama: p.nama, unit: p.unit, barcode: p.barcode, isActive: p.isActive,
      hargaJual: p.hargaJual?.toString() ?? null, stok: stokById.get(p.id) ?? 0,
    }));
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

  async create(koperasiId: string, dto: CreateProductDto) {
    const exists = await prisma.product.findUnique({ where: { koperasiId_nama: { koperasiId, nama: dto.nama } } });
    if (exists) throw new ConflictException('PRODUK_SUDAH_ADA');
    return serializeDecimals(await prisma.product.create({
      data: { koperasiId, nama: dto.nama, unit: dto.unit, barcode: dto.barcode, hargaJual: dto.hargaJual },
    }));
  }

  async update(koperasiId: string, id: string, dto: UpdateProductDto) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    return serializeDecimals(await prisma.product.update({
      where: { id },
      data: { nama: dto.nama, unit: dto.unit, isActive: dto.isActive, hargaJual: dto.hargaJual },
    }));
  }

  /** Delete-guard: produk ber-movement tidak dihapus — inactive. */
  async remove(koperasiId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, koperasiId } });
    if (!product) throw new NotFoundException('PRODUK_TIDAK_DITEMUKAN');
    const count = await prisma.stockMovement.count({ where: { productId: id } });
    if (count > 0) {
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      return { inactivated: true };
    }
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
