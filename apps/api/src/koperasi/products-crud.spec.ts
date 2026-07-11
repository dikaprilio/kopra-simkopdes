import { prisma } from '@kopra/db';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

const products = new ProductsService();
const stock = new StockService();
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
    prisma.koperasi.create({ data: { nama: 'Products CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'Products CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  const actor = await prisma.user.create({
    data: {
      email: 'products-crud@example.test',
      passwordHash: 'x',
      name: 'Product CRUD Actor',
      role: 'PENGURUS',
      koperasiId,
    },
  });
  actorId = actor.id;
});

async function productWithStock(nama: string, qty: number, isActive = true) {
  const product = await prisma.product.create({
    data: { koperasiId, nama, unit: 'Pcs', hargaJual: 12_500, isActive },
  });
  if (qty !== 0) {
    await prisma.stockMovement.create({
      data: {
        koperasiId,
        productId: product.id,
        type: 'ADJUST',
        qty,
        sourceChannel: 'SEED',
        status: 'CONFIRMED',
        createdById: actorId,
      },
    });
  }
  return product;
}

describe('ProductsService master CRUD', () => {
  it('returns paginated searchable active/history and low-stock lists', async () => {
    const [zero, low, healthy, archived] = await Promise.all([
      productWithStock('Inventory Alpha Zero', 0),
      productWithStock('Inventory Beta Low', 5),
      productWithStock('Inventory Gamma Healthy', 6),
      productWithStock('Inventory Delta Archived', 0, false),
    ]);

    const first = await (products as any).list(koperasiId, {
      search: 'Inventory', active: 'all', page: '1', pageSize: '2',
    });
    const second = await (products as any).list(koperasiId, {
      search: 'Inventory', active: 'all', page: '2', pageSize: '2',
    });
    expect(first).toMatchObject({ page: 1, pageSize: 2, total: 4 });
    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(2);
    expect([...first.data, ...second.data].map((row: any) => row.id))
      .toEqual([zero.id, low.id, archived.id, healthy.id]);

    const defaultActive = await (products as any).list(koperasiId, { search: 'Inventory' });
    expect(defaultActive.total).toBe(3);
    const inactive = await (products as any).list(koperasiId, {
      search: 'Inventory', active: 'false',
    });
    expect(inactive.data.map((row: any) => row.id)).toEqual([archived.id]);
    const lowStock = await (products as any).list(koperasiId, {
      search: 'Inventory', lowStock: 'true',
    });
    expect(lowStock.data.map((row: any) => row.id)).toEqual([zero.id, low.id]);
    expect(lowStock.data.map((row: any) => row.stok)).toEqual([0, 5]);
  });

  it('provides an edit detail while retaining historical card Decimal strings', async () => {
    const product = await productWithStock('Detail Product', 3, false);
    await prisma.product.update({
      where: { id: product.id },
      data: { barcode: '8990001112223' },
    });
    const detail = await (products as any).detail(koperasiId, product.id);
    expect(detail).toMatchObject({
      id: product.id,
      nama: 'Detail Product',
      barcode: '8990001112223',
      hargaJual: '12500',
      stok: 3,
      isActive: false,
    });
    const card: any = await products.card(koperasiId, product.id);
    expect(card.product.hargaJual).toBe('12500');
    expect(card.movements).toHaveLength(1);
    expect(card.movements[0].qty).toBe('3');
  });

  it('creates and audits a normalized product', async () => {
    const result = await (products as any).create(koperasiId, actorId, {
      nama: '  Produk   Baru  ',
      unit: ' Dus ',
      barcode: ' 8991234567890 ',
      hargaJual: 50_000,
    });
    expect(result).toMatchObject({
      nama: 'Produk Baru', unit: 'Dus', barcode: '8991234567890', hargaJual: '50000', isActive: true,
    });
    expect(await prisma.auditLog.findFirst({
      where: { resourceRef: result.id, action: 'product.create', actorId },
    })).toMatchObject({ channel: 'WEB', resourceType: 'product', result: 'OK' });
  });

  it('patches barcode, clears nullable fields, and reactivates with standard audits', async () => {
    const product = await prisma.product.create({
      data: {
        koperasiId,
        nama: 'Patch Product',
        unit: 'Pcs',
        barcode: 'OLD-BARCODE',
        hargaJual: 10_000,
        isActive: false,
      },
    });
    const updated = await (products as any).update(koperasiId, actorId, product.id, {
      unit: null,
      barcode: 'NEW-BARCODE',
      hargaJual: null,
      isActive: true,
    });
    expect(updated).toMatchObject({
      id: product.id,
      unit: null,
      barcode: 'NEW-BARCODE',
      hargaJual: null,
      isActive: true,
    });
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: product.id }, select: { action: true },
    })).toEqual([{ action: 'product.reactivate' }]);

    const cleared = await (products as any).update(koperasiId, actorId, product.id, {
      barcode: null,
    });
    expect(cleared.barcode).toBeNull();
    expect(await prisma.auditLog.count({
      where: { resourceRef: product.id, action: 'product.update' },
    })).toBe(1);
  });

  it('deletes unused products and audits the deletion', async () => {
    const product = await prisma.product.create({ data: { koperasiId, nama: 'Unused Product' } });
    await expect((products as any).remove(koperasiId, actorId, product.id))
      .resolves.toEqual({ deleted: true });
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(await prisma.auditLog.count({
      where: { resourceRef: product.id, action: 'product.delete', actorId },
    })).toBe(1);
  });

  it('deactivates referenced products, keeps historical card reads, and audits archive', async () => {
    const product = await productWithStock('Referenced Product', 8);
    await expect((products as any).remove(koperasiId, actorId, product.id))
      .resolves.toEqual({ inactivated: true });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
      .toMatchObject({ isActive: false });
    expect((await products.card(koperasiId, product.id) as any).movements).toHaveLength(1);
    expect(await prisma.auditLog.count({
      where: { resourceRef: product.id, action: 'product.archive', actorId },
    })).toBe(1);
  });

  it('tenant-fences detail/update/delete and rejects inactive products for new movements', async () => {
    const foreign = await prisma.product.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Foreign Product' },
    });
    await expect((products as any).detail(koperasiId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'PRODUK_TIDAK_DITEMUKAN' });
    await expect((products as any).update(koperasiId, actorId, foreign.id, { nama: 'Stolen' }))
      .rejects.toMatchObject({ status: 404, message: 'PRODUK_TIDAK_DITEMUKAN' });
    await expect((products as any).remove(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'PRODUK_TIDAK_DITEMUKAN' });

    const inactive = await prisma.product.create({
      data: { koperasiId, nama: 'Inactive Movement Product', isActive: false },
    });
    await expect(stock.create(koperasiId, actorId, {
      productId: inactive.id, type: 'ADJUST', qty: 1,
    } as any)).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    expect(await prisma.stockMovement.count({ where: { productId: inactive.id } })).toBe(0);
  });
});
