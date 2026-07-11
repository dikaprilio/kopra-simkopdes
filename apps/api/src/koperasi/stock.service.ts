import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  DomainError,
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  cancelMovement,
  confirmEntry,
  confirmMovementOnly,
  createMovementDraft,
  currentStock,
  writeWebMutationAudit,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockService {
  async list(koperasiId: string, q: {
    productId?: string; type?: string; status?: string; source?: string;
    from?: string; to?: string; page?: string; pageSize?: string;
  }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.StockMovementWhereInput = { koperasiId };
    if (q.productId) where.productId = q.productId;
    if (q.type === 'IN' || q.type === 'OUT' || q.type === 'ADJUST') where.type = q.type;
    if (q.status === 'DRAFT' || q.status === 'CONFIRMED') where.status = q.status;
    if (q.source === 'WHATSAPP' || q.source === 'WEB' || q.source === 'SEED' || q.source === 'IMPORT')
      where.sourceChannel = q.source;
    if (q.from || q.to) {
      const date: Prisma.DateTimeFilter = {};
      if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
      if (q.to) {
        const exclusive = new Date(`${q.to}T00:00:00.000Z`);
        exclusive.setUTCDate(exclusive.getUTCDate() + 1);
        date.lt = exclusive;
      }
      where.date = date;
    }
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where, orderBy: [{ date: 'desc' }, { id: 'desc' }], skip, take,
        include: { product: { select: { nama: true, unit: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return { data: serializeDecimals(rows), page, pageSize, total };
  }

  async create(koperasiId: string, actorId: string, dto: CreateStockMovementDto) {
    const product = await prisma.product.findFirst({
      where: { id: dto.productId, koperasiId, isActive: true }, select: { id: true },
    });
    if (!product) throw new DomainError('PRODUCT_NOT_FOUND', 'Produk tidak ditemukan.');

    let qty: number;
    let before: number | undefined;
    if (dto.type === 'ADJUST') {
      if (dto.actualQty === undefined || !Number.isFinite(dto.actualQty) || dto.actualQty < 0)
        throw new BadRequestException('STOK_FISIK_TIDAK_VALID');
      before = await currentStock(dto.productId);
      qty = dto.actualQty - before;
      if (qty === 0) throw new BadRequestException('STOK_FISIK_TIDAK_BERUBAH');
    } else {
      if (dto.qty === undefined || !Number.isFinite(dto.qty) || dto.qty <= 0)
        throw new BadRequestException('JUMLAH_STOK_TIDAK_VALID');
      qty = dto.qty;
    }
    const result = await createMovementDraft(actorId, {
      koperasiId,
      productId: dto.productId,
      type: dto.type,
      qty,
      hargaBeli: dto.hargaBeli,
      hargaJual: dto.hargaJual,
      businessUnitId: dto.businessUnitId,
      description: dto.description,
      date: dto.date ? new Date(dto.date) : undefined,
    }, 'WEB');
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.STOCK_MOVEMENT,
      mutation: dto.type === 'ADJUST' ? WEB_AUDIT_MUTATION.ADJUST : WEB_AUDIT_MUTATION.CREATE,
      resourceRef: result.movementId,
      payload: dto.type === 'ADJUST'
        ? { physicalCount: dto.actualQty, previousStock: before, delta: qty }
        : { type: dto.type, qty },
    });
    return serializeDecimals(result);
  }

  /** Linked journal → confirmEntry (cascades movement); tanpa jurnal → confirmMovementOnly. */
  async confirm(koperasiId: string, actorId: string, id: string) {
    const movement = await prisma.stockMovement.findFirst({ where: { id, koperasiId } });
    if (!movement) throw new NotFoundException('MOVEMENT_TIDAK_DITEMUKAN');
    if (movement.journalEntryId) await confirmEntry(movement.journalEntryId, koperasiId);
    else await confirmMovementOnly(id, koperasiId);
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.STOCK_MOVEMENT,
      mutation: WEB_AUDIT_MUTATION.CONFIRM, resourceRef: id,
    });
    const confirmed = await prisma.stockMovement.findUniqueOrThrow({ where: { id } });
    return serializeDecimals({ ...confirmed, stok: await currentStock(confirmed.productId) });
  }

  async cancel(koperasiId: string, actorId: string, id: string) {
    const movement = await prisma.stockMovement.findFirst({ where: { id, koperasiId } });
    if (!movement) throw new NotFoundException('MOVEMENT_TIDAK_DITEMUKAN');
    if (movement.status !== 'DRAFT')
      throw new ConflictException('MOVEMENT_TERKONFIRMASI_IMMUTABLE');
    try {
      await cancelMovement(id, koperasiId);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      if (error.code === 'NOT_FOUND') throw new NotFoundException('MOVEMENT_TIDAK_DITEMUKAN');
      if (error.code === 'IMMUTABLE')
        throw new ConflictException('MOVEMENT_TERKONFIRMASI_IMMUTABLE');
      throw error;
    }
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.STOCK_MOVEMENT,
      mutation: WEB_AUDIT_MUTATION.CANCEL, resourceRef: id,
      payload: { linkedJournal: Boolean(movement.journalEntryId) },
    });
    return { deleted: true };
  }
}
