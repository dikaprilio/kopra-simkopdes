import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { confirmEntry, confirmMovementOnly, createMovementDraft } from '@kopra/core';
import { serializeDecimals } from '../common/http';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockService {
  async list(koperasiId: string, productId?: string) {
    const rows = await prisma.stockMovement.findMany({
      where: { koperasiId, ...(productId ? { productId } : {}) },
      orderBy: { date: 'desc' },
      include: { product: { select: { nama: true, unit: true } } },
    });
    return serializeDecimals(rows);
  }

  async create(koperasiId: string, actorId: string, dto: CreateStockMovementDto) {
    const result = await createMovementDraft(actorId, { koperasiId, ...dto }, 'WEB');
    return serializeDecimals(result); // {movementId, product, qty, stokSebelum, stokSesudah, journal?}
  }

  /** Linked journal → confirmEntry (cascades movement); tanpa jurnal → confirmMovementOnly. */
  async confirm(koperasiId: string, id: string) {
    const movement = await prisma.stockMovement.findFirst({ where: { id, koperasiId } });
    if (!movement) throw new NotFoundException('MOVEMENT_TIDAK_DITEMUKAN');
    if (movement.journalEntryId) await confirmEntry(movement.journalEntryId, koperasiId);
    else await confirmMovementOnly(id, koperasiId);
    return serializeDecimals(await prisma.stockMovement.findUnique({ where: { id } }));
  }
}
