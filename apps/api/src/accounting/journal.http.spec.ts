/** HTTP-layer spec utk JournalService — jalur create→confirm→immutable via service. */
import { prisma } from '@kopra/db';
import { DEFAULT_COA } from '../../../../packages/db/src/coa-default';
import { JournalService } from './journal.service';

let kopId = '', userId = '';
const svc = new JournalService();

beforeAll(async () => {
  for (const t of [
    'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'members', 'business_units', 'coa_accounts',
    'whatsapp_identities', 'users', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);
  const kop = await prisma.koperasi.create({ data: { nama: 'Kop HTTP Test', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' } });
  kopId = kop.id;
  const byKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({ data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type, parentId: c.parentKode ? byKode.get(c.parentKode) : undefined } });
    byKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({ data: { email: 'http@t.id', passwordHash: 'x', name: 'T', role: 'PENGURUS', status: 'ACTIVE', koperasiId: kopId } });
  userId = user.id;
});

afterAll(async () => { await prisma.$disconnect(); });

it('simple INCOME → DRAFT 2 lines, decimals as strings', async () => {
  const entry: any = await svc.createSimple(kopId, userId, { kind: 'INCOME', amount: 500000, description: 'pemasukan tes' } as any);
  expect(entry.status).toBe('DRAFT');
  expect(entry.lines).toHaveLength(2);
  expect(typeof entry.lines[0].debit).toBe('string');
});

it('confirm → CONFIRMED; PATCH/DELETE terkunci (409)', async () => {
  const entry: any = await svc.createSimple(kopId, userId, { kind: 'EXPENSE', amount: 100000, description: 'beban tes' } as any);
  const confirmed: any = await svc.confirm(kopId, entry.id);
  expect(confirmed.status).toBe('CONFIRMED');
  await expect(svc.confirm(kopId, entry.id)).rejects.toMatchObject({ code: 'NOT_DRAFT' });
  await expect(svc.remove(kopId, entry.id)).rejects.toMatchObject({ code: 'IMMUTABLE' });
});

it('manual unbalanced → PostingError NOT_BALANCED', async () => {
  await expect(
    svc.createManual(kopId, userId, { keterangan: 'x', lines: [
      { coaKode: '111000', debit: 100, kredit: 0 },
      { coaKode: '410000', debit: 0, kredit: 50 },
    ] } as any),
  ).rejects.toMatchObject({ code: 'NOT_BALANCED' });
});
