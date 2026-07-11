import { currentStock, stockLevels } from '@kopra/core';
import { prisma } from '@kopra/db';
import { StockService } from './stock.service';

const service = new StockService();
let koperasiId = '';
let foreignKoperasiId = '';
let actorId = '';

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'whatsapp_identities', 'users', 'members',
    'business_units', 'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: 'Stock CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'Stock CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  actorId = (await prisma.user.create({
    data: {
      email: 'stock-crud@example.test', passwordHash: 'x', name: 'Stock Actor',
      role: 'PENGURUS', koperasiId,
    },
  })).id;
  await prisma.coaAccount.createMany({ data: [
    { koperasiId, kode: '111000', nama: 'Kas', type: 'ASSET' },
    { koperasiId, kode: '114000', nama: 'Persediaan', type: 'ASSET' },
    { koperasiId, kode: '410000', nama: 'Pendapatan', type: 'REVENUE' },
  ] });
});

async function productWithStock(name: string, qty: number) {
  const product = await prisma.product.create({
    data: { koperasiId, nama: name, unit: 'Pcs', hargaJual: 10_000 },
  });
  if (qty) await prisma.stockMovement.create({
    data: {
      koperasiId, productId: product.id, type: 'ADJUST', qty,
      sourceChannel: 'SEED', status: 'CONFIRMED', createdById: actorId,
    },
  });
  return product;
}

describe('StockService ERP workflow contract', () => {
  it('lists paginated movements with product/type/status/source/date filters', async () => {
    const product = await productWithStock('Movement Filter Product', 0);
    await prisma.stockMovement.createMany({ data: [
      { koperasiId, productId: product.id, type: 'IN', qty: 1, date: new Date('2026-06-01T00:00:00Z'), sourceChannel: 'WEB', status: 'DRAFT', createdById: actorId },
      { koperasiId, productId: product.id, type: 'IN', qty: 2, date: new Date('2026-06-02T00:00:00Z'), sourceChannel: 'WEB', status: 'DRAFT', createdById: actorId },
      { koperasiId, productId: product.id, type: 'OUT', qty: 1, date: new Date('2026-07-01T00:00:00Z'), sourceChannel: 'WEB', status: 'DRAFT', createdById: actorId },
    ] });
    const first: any = await (service as any).list(koperasiId, {
      productId: product.id, type: 'IN', status: 'DRAFT', source: 'WEB',
      from: '2026-06-01', to: '2026-06-30', page: '1', pageSize: '1',
    });
    const second: any = await (service as any).list(koperasiId, {
      productId: product.id, type: 'IN', status: 'DRAFT', source: 'WEB',
      from: '2026-06-01', to: '2026-06-30', page: '2', pageSize: '1',
    });
    expect(first).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(first.data[0].qty).toBe('2');
    expect(second.data[0].qty).toBe('1');
  });

  it('persists editable dates and validates IN/OUT quantities', async () => {
    const product = await productWithStock('Dated Stock Product', 5);
    const draft: any = await service.create(koperasiId, actorId, {
      productId: product.id, type: 'OUT', qty: 2, date: '2026-05-10',
    } as any);
    expect((await prisma.stockMovement.findUniqueOrThrow({ where: { id: draft.movementId } })).date.toISOString())
      .toBe('2026-05-10T00:00:00.000Z');
    await expect(service.create(koperasiId, actorId, {
      productId: product.id, type: 'IN', qty: 0,
    } as any)).rejects.toMatchObject({ status: 400, message: 'JUMLAH_STOK_TIDAK_VALID' });
    await expect(service.create(koperasiId, actorId, {
      productId: product.id, type: 'OUT', qty: -1,
    } as any)).rejects.toMatchObject({ status: 400, message: 'JUMLAH_STOK_TIDAK_VALID' });
  });

  it('converts physical counts above/below current stock to signed deltas and rejects equal counts', async () => {
    const below = await productWithStock('Physical Below', 10);
    const down: any = await service.create(koperasiId, actorId, {
      productId: below.id, type: 'ADJUST', actualQty: 7, date: '2026-05-11',
    } as any);
    expect(down).toMatchObject({ qty: -3, stokSebelum: 10, stokSesudah: 7 });
    await (service as any).confirm(koperasiId, actorId, down.movementId);
    expect(await currentStock(below.id)).toBe(7);

    const above = await productWithStock('Physical Above', 10);
    const up: any = await service.create(koperasiId, actorId, {
      productId: above.id, type: 'ADJUST', actualQty: 14,
    } as any);
    expect(up).toMatchObject({ qty: 4, stokSebelum: 10, stokSesudah: 14 });
    await (service as any).confirm(koperasiId, actorId, up.movementId);
    expect(await currentStock(above.id)).toBe(14);

    await expect(service.create(koperasiId, actorId, {
      productId: above.id, type: 'ADJUST', actualQty: 14,
    } as any)).rejects.toMatchObject({ status: 400, message: 'STOK_FISIK_TIDAK_BERUBAH' });
  });

  it('atomically cancels a draft movement and its linked draft journal', async () => {
    const product = await productWithStock('Cancel Linked Product', 0);
    const draft: any = await service.create(koperasiId, actorId, {
      productId: product.id, type: 'IN', qty: 3, hargaBeli: 2_000,
    } as any);
    const journalId = draft.journal.entry.id;
    await expect((service as any).cancel(koperasiId, actorId, draft.movementId))
      .resolves.toEqual({ deleted: true });
    expect(await prisma.stockMovement.findUnique({ where: { id: draft.movementId } })).toBeNull();
    expect(await prisma.journalEntry.findUnique({ where: { id: journalId } })).toBeNull();
    expect(await prisma.auditLog.count({
      where: { resourceRef: draft.movementId, action: 'stock_movement.cancel', actorId },
    })).toBe(1);
  });

  it('rejects cancellation of confirmed movements without changing stock', async () => {
    const product = await productWithStock('Confirmed Cancel Product', 0);
    const draft: any = await service.create(koperasiId, actorId, {
      productId: product.id, type: 'IN', qty: 4,
    } as any);
    await (service as any).confirm(koperasiId, actorId, draft.movementId);
    await expect((service as any).cancel(koperasiId, actorId, draft.movementId))
      .rejects.toMatchObject({ status: 409, message: 'MOVEMENT_TERKONFIRMASI_IMMUTABLE' });
    expect(await currentStock(product.id)).toBe(4);
  });

  it('tenant-hides confirm and cancellation', async () => {
    const foreignActor = await prisma.user.create({
      data: {
        email: 'stock-foreign@example.test', passwordHash: 'x', name: 'Foreign Stock',
        role: 'PENGURUS', koperasiId: foreignKoperasiId,
      },
    });
    const foreignProduct = await prisma.product.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Foreign Stock Product' },
    });
    const foreignMovement = await prisma.stockMovement.create({
      data: {
        koperasiId: foreignKoperasiId, productId: foreignProduct.id, type: 'IN', qty: 1,
        sourceChannel: 'WEB', status: 'DRAFT', createdById: foreignActor.id,
      },
    });
    await expect((service as any).confirm(koperasiId, actorId, foreignMovement.id))
      .rejects.toMatchObject({ status: 404, message: 'MOVEMENT_TIDAK_DITEMUKAN' });
    await expect((service as any).cancel(koperasiId, actorId, foreignMovement.id))
      .rejects.toMatchObject({ status: 404, message: 'MOVEMENT_TIDAK_DITEMUKAN' });
  });

  it('audits create/adjust/confirm and refreshes low-stock results', async () => {
    const product = await productWithStock('Low Refresh Product', 6);
    const draft: any = await service.create(koperasiId, actorId, {
      productId: product.id, type: 'ADJUST', actualQty: 5,
    } as any);
    const confirmed: any = await (service as any).confirm(koperasiId, actorId, draft.movementId);
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', stok: 5 });
    expect((await stockLevels(koperasiId)).low.some((row) => row.id === product.id)).toBe(true);
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: draft.movementId }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([
      { action: 'stock_movement.adjust' },
      { action: 'stock_movement.confirm' },
    ]);
  });
});
