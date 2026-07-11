import { prisma } from '@kopra/db';
import { MembersService } from './members.service';

const service = new MembersService();
let koperasiId = '';
let actorId = '';

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'whatsapp_identities', 'users', 'members',
    'business_units', 'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  const koperasi = await prisma.koperasi.create({ data: { nama: 'Savings Mutation Test' } });
  koperasiId = koperasi.id;
  actorId = (await prisma.user.create({
    data: {
      email: 'savings-mutation@example.test', passwordHash: 'x', name: 'Savings Actor',
      role: 'PENGURUS', koperasiId,
    },
  })).id;
  await prisma.coaAccount.createMany({ data: [
    { koperasiId, kode: '111000', nama: 'Kas', type: 'ASSET' },
    { koperasiId, kode: '310000', nama: 'Simpanan Pokok', type: 'EQUITY' },
    { koperasiId, kode: '320000', nama: 'Simpanan Wajib', type: 'EQUITY' },
  ] });
});

async function memberWithSavings(
  nama: string,
  rows: Array<{ type: 'POKOK' | 'WAJIB'; period: string; amount?: number }>,
  isActive = true,
) {
  const member = await prisma.member.create({
    data: { koperasiId, nama, nik: '3402010203040506', isActive },
  });
  const savings = await Promise.all(rows.map((row) => prisma.memberSaving.create({
    data: {
      memberId: member.id, type: row.type, period: row.period,
      amount: row.amount ?? 10_000, status: 'UNPAID',
    },
  })));
  return { member, savings };
}

describe('MembersService savings mutation contract', () => {
  it('keeps rapel output compatible, audits once, and rejects a duplicate web submission', async () => {
    const { member, savings } = await memberWithSavings('Savings Duplicate', [
      { type: 'WAJIB', period: '2026-01' },
      { type: 'WAJIB', period: '2026-02' },
    ]);
    const ids = savings.map((saving) => saving.id);
    const paid = await service.pay(koperasiId, actorId, member.id, ids);
    expect(paid).toMatchObject({ paid: 2, total: '20000' });
    expect(paid.journalId).toBeTruthy();
    await expect(service.pay(koperasiId, actorId, member.id, ids))
      .rejects.toMatchObject({ status: 409, message: 'SIMPANAN_SUDAH_DIBAYAR' });
    expect(await prisma.journalEntry.count({
      where: { koperasiId, keterangan: { contains: 'Savings Duplicate' } },
    })).toBe(1);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { resourceRef: member.id, action: 'member_saving.pay', actorId },
    });
    expect(audit).toMatchObject({ channel: 'WEB', resourceType: 'member_saving', result: 'OK' });
    expect(JSON.stringify(audit.payloadJson)).not.toContain('3402010203040506');
  });

  it('rejects mixed saving types without journal, payment, or audit side effects', async () => {
    const { member, savings } = await memberWithSavings('Savings Mixed', [
      { type: 'POKOK', period: '2026-01', amount: 25_000 },
      { type: 'WAJIB', period: '2026-01' },
    ]);
    await expect(service.pay(koperasiId, actorId, member.id, savings.map((row) => row.id)))
      .rejects.toMatchObject({ status: 400, message: 'CAMPUR_TIPE_SIMPANAN' });
    expect(await prisma.memberSaving.count({ where: { memberId: member.id, status: 'PAID' } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { resourceRef: member.id } })).toBe(0);
  });

  it('rejects archived members with a deterministic conflict and no audit', async () => {
    const { member, savings } = await memberWithSavings('Savings Archived', [
      { type: 'WAJIB', period: '2026-01' },
    ], false);
    await expect(service.pay(koperasiId, actorId, member.id, savings.map((row) => row.id)))
      .rejects.toMatchObject({ status: 409, message: 'ANGGOTA_DIARSIPKAN' });
    expect(await prisma.memberSaving.findUniqueOrThrow({ where: { id: savings[0].id } }))
      .toMatchObject({ status: 'UNPAID', journalEntryId: null });
    expect(await prisma.auditLog.count({ where: { resourceRef: member.id } })).toBe(0);
  });
});
