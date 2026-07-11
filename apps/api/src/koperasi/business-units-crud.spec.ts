import { prisma } from '@kopra/db';
import { UnitsService } from './units.service';

jest.setTimeout(15_000);

const service = new UnitsService();
let koperasiId = '';
let foreignKoperasiId = '';
let actorId = '';

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'stock_movements', 'journal_lines', 'journal_entries', 'products',
    'whatsapp_identities', 'users', 'member_savings', 'members', 'business_units',
    'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: 'Units CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'Units CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  actorId = (await prisma.user.create({
    data: {
      email: 'units-crud@example.test', passwordHash: 'x', name: 'Units Actor',
      role: 'OWNER', koperasiId,
    },
  })).id;
});

describe('UnitsService master CRUD', () => {
  it('lists with search/active/pagination and returns linked account detail', async () => {
    const revenue = await prisma.coaAccount.create({
      data: { koperasiId, kode: '491000', nama: 'Pendapatan Unit Filter', type: 'REVENUE' },
    });
    const active = await prisma.businessUnit.create({
      data: { koperasiId, nama: 'Unit Filter Active', revenueCoaId: revenue.id },
    });
    await prisma.businessUnit.create({
      data: { koperasiId, nama: 'Unit Filter Archived', isActive: false },
    });
    await prisma.businessUnit.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Unit Filter Foreign' },
    });
    const list = await service.list(koperasiId, { search: 'Filter', page: '1', pageSize: '1' });
    expect(list).toMatchObject({ page: 1, pageSize: 1, total: 1 });
    expect(list.data[0]).toMatchObject({ id: active.id, revenueCoa: { id: revenue.id, kode: '491000' } });
    const history = await service.list(koperasiId, { search: 'Filter', active: 'all' });
    expect(history.total).toBe(2);
    expect(await service.detail(koperasiId, active.id))
      .toMatchObject({ id: active.id, revenueCoa: { id: revenue.id, type: 'REVENUE' } });
  });

  it('creates a normalized unit and linked revenue account atomically with audits', async () => {
    const created = await service.create(koperasiId, actorId, { nama: '  Toko   Desa  ' });
    expect(created).toMatchObject({ nama: 'Toko Desa', isActive: true });
    expect(created.revenueCoa).toMatchObject({ kode: '411000', nama: 'Pendapatan Toko Desa', type: 'REVENUE', isActive: true });
    const stored = await prisma.businessUnit.findUnique({
      where: { id: created.id }, include: { revenueCoa: true },
    });
    expect(stored?.revenueCoaId).toBe(created.revenueCoa!.id);
    expect(await prisma.auditLog.count({
      where: { resourceRef: created.id, action: 'business_unit.create', actorId },
    })).toBe(1);
  });

  it('renames the unit and linked account in one mutation, then archives/reactivates both', async () => {
    const created = await service.create(koperasiId, actorId, { nama: 'Unit Lifecycle' });
    const renamed = await service.update(koperasiId, actorId, created.id, { nama: 'Unit Lifecycle Baru' });
    expect(renamed).toMatchObject({ nama: 'Unit Lifecycle Baru' });
    expect(renamed.revenueCoa!.nama).toBe('Pendapatan Unit Lifecycle Baru');

    const archived = await service.archive(koperasiId, actorId, created.id);
    expect(archived).toMatchObject({ isActive: false, revenueCoa: { isActive: false } });
    const reactivated = await service.update(koperasiId, actorId, created.id, { isActive: true });
    expect(reactivated).toMatchObject({ isActive: true, revenueCoa: { isActive: true } });
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: created.id }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([
      { action: 'business_unit.create' },
      { action: 'business_unit.update' },
      { action: 'business_unit.archive' },
      { action: 'business_unit.reactivate' },
    ]);
  });

  it('retains historical journals when a unit and its revenue account are archived', async () => {
    const created = await service.create(koperasiId, actorId, { nama: 'Unit Historical' });
    await prisma.journalEntry.create({
      data: {
        koperasiId, nomor: 'UNIT-HISTORY-1', keterangan: 'Historical unit',
        businessUnitId: created.id, sourceChannel: 'WEB', status: 'CONFIRMED', createdById: actorId,
      },
    });
    await service.archive(koperasiId, actorId, created.id);
    expect(await prisma.journalEntry.count({ where: { businessUnitId: created.id } })).toBe(1);
    expect(await service.detail(koperasiId, created.id))
      .toMatchObject({ isActive: false, revenueCoa: { isActive: false } });
  });

  it('rejects duplicate names and tenant-hides detail/update/archive', async () => {
    await service.create(koperasiId, actorId, { nama: 'Unique Unit' });
    await expect(service.create(koperasiId, actorId, { nama: ' Unique  Unit ' }))
      .rejects.toMatchObject({ status: 409, message: 'UNIT_USAHA_SUDAH_ADA' });
    const foreign = await prisma.businessUnit.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Foreign Unit' },
    });
    await expect(service.detail(koperasiId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'UNIT_USAHA_TIDAK_DITEMUKAN' });
    await expect(service.update(koperasiId, actorId, foreign.id, { nama: 'Stolen' }))
      .rejects.toMatchObject({ status: 404, message: 'UNIT_USAHA_TIDAK_DITEMUKAN' });
    await expect(service.archive(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'UNIT_USAHA_TIDAK_DITEMUKAN' });
  });
});
