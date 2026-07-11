import { prisma } from '@kopra/db';
import { ROLES_KEY } from '../auth/roles.decorator';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

const service = new MembersService();
let koperasiId = '';
let foreignKoperasiId = '';
let actorId = '';

function jakartaMonth(offset = 0): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 7);
}

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'whatsapp_identities', 'users', 'members',
    'business_units', 'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);

  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: 'Members CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'Members CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  const actor = await prisma.user.create({
    data: {
      email: 'members-crud@example.test',
      passwordHash: 'x',
      name: 'Member CRUD Actor',
      role: 'PENGURUS',
      koperasiId,
    },
  });
  actorId = actor.id;
});

describe('MembersService master CRUD', () => {
  it('creates a safe member, normalizes NIK/WA, expands optional savings, and audits', async () => {
    const startPeriod = jakartaMonth(-2);
    const nikInput = '3402 0102-0304 0506';
    const waInput = '0812-3456-7890';
    const result = await (service as any).create(koperasiId, actorId, {
      nama: '  Bu   Onboarding  ',
      nik: nikInput,
      waNumber: waInput,
      savings: { startPeriod, pokokAmount: 100_000, wajibAmount: 25_000 },
    });

    expect(result).toMatchObject({
      nama: 'Bu Onboarding',
      waNumber: '6281234567890',
      hasNik: true,
      isActive: true,
    });
    expect(result.nik).toBeUndefined();
    const stored = await prisma.member.findUniqueOrThrow({ where: { id: result.id } });
    expect(stored).toMatchObject({
      nama: 'Bu Onboarding',
      nik: '3402010203040506',
      waNumber: '6281234567890',
    });

    const savings = await prisma.memberSaving.findMany({
      where: { memberId: result.id },
      orderBy: [{ type: 'asc' }, { period: 'asc' }],
    });
    expect(savings.filter((row) => row.type === 'POKOK')).toEqual([
      expect.objectContaining({ period: startPeriod, amount: expect.anything(), status: 'UNPAID' }),
    ]);
    expect(savings.filter((row) => row.type === 'WAJIB').map((row) => row.period))
      .toEqual([jakartaMonth(-2), jakartaMonth(-1), jakartaMonth()]);
    expect(savings.filter((row) => row.type === 'WAJIB').every((row) => Number(row.amount) === 25_000))
      .toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { resourceRef: result.id, action: 'member.create' },
    });
    expect(audit).toMatchObject({
      koperasiId,
      actorId,
      channel: 'WEB',
      resourceType: 'member',
      result: 'OK',
    });
    const auditJson = JSON.stringify(audit.payloadJson);
    expect(auditJson).not.toContain('3402010203040506');
    expect(auditJson).not.toContain('6281234567890');
  });

  it('rejects invalid NIK/WA and a future savings start without partial writes', async () => {
    const before = await prisma.member.count({ where: { koperasiId } });
    await expect((service as any).create(koperasiId, actorId, {
      nama: 'Invalid NIK', nik: '1234',
    })).rejects.toMatchObject({ status: 400, message: 'NIK_TIDAK_VALID' });
    await expect((service as any).create(koperasiId, actorId, {
      nama: 'Invalid WA', waNumber: '021-555-000',
    })).rejects.toMatchObject({ status: 400, message: 'NOMOR_WA_TIDAK_VALID' });
    await expect((service as any).create(koperasiId, actorId, {
      nama: 'Future Savings',
      savings: { startPeriod: jakartaMonth(1), wajibAmount: 10_000 },
    })).rejects.toMatchObject({ status: 400, message: 'PERIODE_SIMPANAN_TIDAK_VALID' });
    expect(await prisma.member.count({ where: { koperasiId } })).toBe(before);
  });

  it('supports search, active/unpaid filters, and stable pagination without exposing NIK', async () => {
    const [alpha, beta, archived] = await Promise.all([
      prisma.member.create({
        data: { koperasiId, nama: 'Paged Alpha', nik: '3500000000000001' },
      }),
      prisma.member.create({ data: { koperasiId, nama: 'Paged Beta' } }),
      prisma.member.create({ data: { koperasiId, nama: 'Paged Archived', isActive: false } }),
    ]);
    await Promise.all([
      prisma.memberSaving.create({
        data: { memberId: beta.id, type: 'WAJIB', period: jakartaMonth(), amount: 10_000 },
      }),
      prisma.memberSaving.create({
        data: { memberId: archived.id, type: 'WAJIB', period: jakartaMonth(), amount: 20_000 },
      }),
    ]);

    const first = await service.list(koperasiId, {
      search: 'Paged', active: 'all', page: '1', pageSize: '2',
    } as any);
    const second = await service.list(koperasiId, {
      search: 'Paged', active: 'all', page: '2', pageSize: '2',
    } as any);
    expect(first).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(1);
    expect(JSON.stringify([...first.data, ...second.data])).not.toContain('3500000000000001');
    expect([...first.data, ...second.data].find((row: any) => row.id === alpha.id))
      .toMatchObject({ hasNik: true, isActive: true });

    const defaultActive = await service.list(koperasiId, { search: 'Paged' } as any);
    expect(defaultActive.total).toBe(2);
    const inactive = await service.list(koperasiId, {
      search: 'Paged', active: 'false',
    } as any);
    expect(inactive.data.map((row: any) => row.id)).toEqual([archived.id]);
    const unpaid = await service.list(koperasiId, {
      search: 'Paged', unpaid: 'true',
    } as any);
    expect(unpaid.data.map((row: any) => row.id)).toEqual([beta.id]);
  });

  it('reads and updates a tenant-scoped safe detail with replacement NIK write-only', async () => {
    const member = await prisma.member.create({
      data: { koperasiId, nama: 'Detail Before', nik: '3600000000000001' },
    });
    const detail = await (service as any).detail(koperasiId, member.id);
    expect(detail).toMatchObject({ id: member.id, hasNik: true, nama: 'Detail Before' });
    expect(detail.nik).toBeUndefined();

    const updated = await (service as any).update(koperasiId, actorId, member.id, {
      nama: '  Detail   After ',
      nik: '3600-0000-0000-0002',
      waNumber: '+62 813 2222 3333',
    });
    expect(updated).toMatchObject({
      id: member.id,
      nama: 'Detail After',
      hasNik: true,
      waNumber: '6281322223333',
    });
    expect(updated.nik).toBeUndefined();
    expect(await prisma.member.findUniqueOrThrow({ where: { id: member.id } }))
      .toMatchObject({ nik: '3600000000000002', waNumber: '6281322223333' });
    expect(await prisma.auditLog.count({
      where: { resourceRef: member.id, action: 'member.update', actorId },
    })).toBe(1);
  });

  it('archives and reactivates without deleting savings, with one audit per mutation', async () => {
    const member = await prisma.member.create({ data: { koperasiId, nama: 'Lifecycle Member' } });
    await prisma.memberSaving.create({
      data: { memberId: member.id, type: 'WAJIB', period: jakartaMonth(), amount: 10_000 },
    });

    await expect((service as any).archive(koperasiId, actorId, member.id))
      .resolves.toMatchObject({ id: member.id, isActive: false });
    expect(await prisma.memberSaving.count({ where: { memberId: member.id } })).toBe(1);
    await expect((service as any).update(koperasiId, actorId, member.id, { isActive: true }))
      .resolves.toMatchObject({ id: member.id, isActive: true });
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: member.id }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([
      { action: 'member.archive' },
      { action: 'member.reactivate' },
    ]);
  });

  it('rejects archiving a member linked to a login and leaves it active', async () => {
    const member = await prisma.member.create({ data: { koperasiId, nama: 'Linked Login' } });
    const user = await prisma.user.create({
      data: {
        email: `linked-${member.id}@example.test`,
        passwordHash: 'x',
        name: 'Linked Login',
        koperasiId,
        memberId: member.id,
      },
    });
    try {
      await expect((service as any).archive(koperasiId, actorId, member.id))
        .rejects.toMatchObject({ status: 409, message: 'MEMBER_HAS_LOGIN' });
      expect(await prisma.member.findUniqueOrThrow({ where: { id: member.id } }))
        .toMatchObject({ isActive: true });
      expect(await prisma.auditLog.count({ where: { resourceRef: member.id } })).toBe(0);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.member.delete({ where: { id: member.id } });
    }
  });

  it('hides foreign members consistently for detail, update, and archive', async () => {
    const foreign = await prisma.member.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Foreign Member', nik: '3700000000000001' },
    });
    await expect((service as any).detail(koperasiId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'ANGGOTA_TIDAK_DITEMUKAN' });
    await expect((service as any).update(koperasiId, actorId, foreign.id, { nama: 'Stolen' }))
      .rejects.toMatchObject({ status: 404, message: 'ANGGOTA_TIDAK_DITEMUKAN' });
    await expect((service as any).archive(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'ANGGOTA_TIDAK_DITEMUKAN' });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: foreign.id } }))
      .toMatchObject({ nama: 'Foreign Member', nik: '3700000000000001', isActive: true });
  });
});

describe('MembersController mutation role contract', () => {
  it.each(['create', 'update', 'remove'])('%s is restricted to PENGURUS/OWNER', (method) => {
    const handler = (MembersController.prototype as any)[method];
    expect(typeof handler).toBe('function');
    if (typeof handler === 'function') {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['PENGURUS', 'OWNER']);
    }
  });
});
