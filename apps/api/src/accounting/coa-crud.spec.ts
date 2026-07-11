import { prisma } from '@kopra/db';
import { CoaService } from './coa.service';

const service = new CoaService();
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
    prisma.koperasi.create({ data: { nama: 'COA CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'COA CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  actorId = (await prisma.user.create({
    data: {
      email: 'coa-crud@example.test', passwordHash: 'x', name: 'COA Actor',
      role: 'PENGURUS', koperasiId,
    },
  })).id;
});

describe('CoaService master CRUD', () => {
  it('supports flat pagination/search/active filters and retains tree reads', async () => {
    const parent = await prisma.coaAccount.create({
      data: { koperasiId, kode: '801000', nama: 'Filter Parent', type: 'EXPENSE' },
    });
    await Promise.all([
      prisma.coaAccount.create({ data: { koperasiId, kode: '801100', nama: 'Filter Alpha', type: 'EXPENSE', parentId: parent.id } }),
      prisma.coaAccount.create({ data: { koperasiId, kode: '801200', nama: 'Filter Beta', type: 'EXPENSE', isActive: false } }),
      prisma.coaAccount.create({ data: { koperasiId: foreignKoperasiId, kode: '801300', nama: 'Filter Foreign', type: 'EXPENSE' } }),
    ]);

    const active = await (service as any).list(koperasiId, {
      search: 'Filter', active: 'true', page: '1', pageSize: '2',
    });
    expect(active).toMatchObject({ page: 1, pageSize: 2, total: 2 });
    expect(active.data.map((row: any) => row.kode)).toEqual(['801000', '801100']);
    const inactive = await (service as any).list(koperasiId, { search: 'Filter', active: 'false' });
    expect(inactive.data.map((row: any) => row.kode)).toEqual(['801200']);
    const tree = await (service as any).list(koperasiId, { tree: 'true', search: 'Filter', active: 'all' });
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.find((row: any) => row.id === parent.id)?.children[0].kode).toBe('801100');
  });

  it('creates normalized accounts, validates parent tenancy, and audits', async () => {
    const parent = await prisma.coaAccount.create({
      data: { koperasiId, kode: '802000', nama: 'Create Parent', type: 'ASSET' },
    });
    const created = await (service as any).create(koperasiId, actorId, {
      kode: '802100', nama: '  Create   Child ', type: 'ASSET', parentId: parent.id,
    });
    expect(created).toMatchObject({ kode: '802100', nama: 'Create Child', parentId: parent.id, isActive: true });
    expect(await prisma.auditLog.count({
      where: { resourceRef: created.id, action: 'coa.create', actorId },
    })).toBe(1);

    const foreignParent = await prisma.coaAccount.create({
      data: { koperasiId: foreignKoperasiId, kode: '802200', nama: 'Foreign Parent', type: 'ASSET' },
    });
    await expect((service as any).create(koperasiId, actorId, {
      kode: '802300', nama: 'Invalid Parent', type: 'ASSET', parentId: foreignParent.id,
    })).rejects.toMatchObject({ status: 400, message: 'AKUN_INDUK_TIDAK_VALID' });
  });

  it('reads and updates details, clears parent, and prevents parent cycles', async () => {
    const root = await prisma.coaAccount.create({
      data: { koperasiId, kode: '803000', nama: 'Cycle Root', type: 'LIABILITY' },
    });
    const child = await prisma.coaAccount.create({
      data: { koperasiId, kode: '803100', nama: 'Cycle Child', type: 'LIABILITY', parentId: root.id },
    });
    expect(await (service as any).detail(koperasiId, child.id)).toMatchObject({ parentId: root.id });
    await expect((service as any).update(koperasiId, actorId, root.id, { parentId: child.id }))
      .rejects.toMatchObject({ status: 400, message: 'SIKLUS_AKUN_TIDAK_VALID' });
    const updated = await (service as any).update(koperasiId, actorId, child.id, {
      nama: '  Cycle Child Renamed ', parentId: null,
    });
    expect(updated).toMatchObject({ nama: 'Cycle Child Renamed', parentId: null });
    expect(await prisma.auditLog.count({
      where: { resourceRef: child.id, action: 'coa.update', actorId },
    })).toBe(1);
  });

  it('allows code/type edits only before the account is referenced', async () => {
    const account = await prisma.coaAccount.create({
      data: { koperasiId, kode: '804000', nama: 'Editable Account', type: 'ASSET' },
    });
    await expect((service as any).update(koperasiId, actorId, account.id, {
      kode: '804100', type: 'EXPENSE',
    })).resolves.toMatchObject({ kode: '804100', type: 'EXPENSE' });
    const journal = await prisma.journalEntry.create({
      data: {
        koperasiId, nomor: 'COA-CRUD-1', keterangan: 'Referenced account',
        sourceChannel: 'WEB', status: 'DRAFT', createdById: actorId,
      },
    });
    await prisma.journalLine.create({
      data: { entryId: journal.id, coaId: account.id, debit: 1000, kredit: 0 },
    });
    await expect((service as any).update(koperasiId, actorId, account.id, { kode: '804200' }))
      .rejects.toMatchObject({ status: 409, message: 'COA_SUDAH_DIGUNAKAN' });
    await expect((service as any).update(koperasiId, actorId, account.id, { type: 'ASSET' }))
      .rejects.toMatchObject({ status: 409, message: 'COA_SUDAH_DIGUNAKAN' });
    await expect((service as any).update(koperasiId, actorId, account.id, { nama: 'Referenced Renamed' }))
      .resolves.toMatchObject({ nama: 'Referenced Renamed', kode: '804100' });
  });

  it('guards protected accounts and accounts with active children, then archives/reactivates', async () => {
    const protectedAccount = await prisma.coaAccount.create({
      data: { koperasiId, kode: '111000', nama: 'Kas Required', type: 'ASSET' },
    });
    await expect((service as any).archive(koperasiId, actorId, protectedAccount.id))
      .rejects.toMatchObject({ status: 409, message: 'COA_REQUIRED_FOR_POSTING' });

    const parent = await prisma.coaAccount.create({
      data: { koperasiId, kode: '805000', nama: 'Archive Parent', type: 'EXPENSE' },
    });
    await prisma.coaAccount.create({
      data: { koperasiId, kode: '805100', nama: 'Archive Child', type: 'EXPENSE', parentId: parent.id },
    });
    await expect((service as any).archive(koperasiId, actorId, parent.id))
      .rejects.toMatchObject({ status: 409, message: 'COA_MEMILIKI_ANAK_AKTIF' });

    const leaf = await prisma.coaAccount.create({
      data: { koperasiId, kode: '805200', nama: 'Archive Leaf', type: 'EXPENSE' },
    });
    await expect((service as any).archive(koperasiId, actorId, leaf.id))
      .resolves.toMatchObject({ id: leaf.id, isActive: false });
    await expect((service as any).update(koperasiId, actorId, leaf.id, { isActive: true }))
      .resolves.toMatchObject({ id: leaf.id, isActive: true });
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: leaf.id }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([{ action: 'coa.archive' }, { action: 'coa.reactivate' }]);
  });

  it('tenant-hides detail, update, and archive', async () => {
    const foreign = await prisma.coaAccount.create({
      data: { koperasiId: foreignKoperasiId, kode: '806000', nama: 'Foreign COA', type: 'ASSET' },
    });
    await expect((service as any).detail(koperasiId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'COA_TIDAK_DITEMUKAN' });
    await expect((service as any).update(koperasiId, actorId, foreign.id, { nama: 'Stolen' }))
      .rejects.toMatchObject({ status: 404, message: 'COA_TIDAK_DITEMUKAN' });
    await expect((service as any).archive(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'COA_TIDAK_DITEMUKAN' });
  });
});
