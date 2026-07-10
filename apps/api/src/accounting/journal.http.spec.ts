/** HTTP-layer spec utk JournalService — jalur create→confirm→immutable via service. */
import { prisma } from '@kopra/db';
import { DEFAULT_COA } from '../../../../packages/db/src/coa-default';
import { JournalService } from './journal.service';
import { CoaService } from './coa.service';

let kopId = '', userId = '';
let kopBId = '', coaBId = '', unitBId = '';
const svc = new JournalService();
const coaSvc = new CoaService();

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

  // Tenant B — fixture terpisah khusus utk kasus cross-tenant (temuan review task 2:
  // parentId/businessUnitId dari DTO ditulis tanpa verifikasi kepemilikan koperasi).
  const kopB = await prisma.koperasi.create({ data: { nama: 'Kop Tenant B', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' } });
  kopBId = kopB.id;
  const byKodeB = new Map<string, string>();
  for (const c of DEFAULT_COA.slice(0, 3)) { // subset cukup: 100000, 111000, 112100
    const r = await prisma.coaAccount.create({ data: { koperasiId: kopBId, kode: c.kode, nama: c.nama, type: c.type, parentId: c.parentKode ? byKodeB.get(c.parentKode) : undefined } });
    byKodeB.set(c.kode, r.id);
  }
  coaBId = byKodeB.get('100000')!;
  const unitB = await prisma.businessUnit.create({ data: { koperasiId: kopBId, nama: 'Unit B' } });
  unitBId = unitB.id;
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

// --- Temuan review task 2: tenancy guard parentId/businessUnitId + source allow-list ---

it('updateDraft dengan businessUnitId milik koperasi lain → ditolak (400), entry tidak berubah', async () => {
  const created: any = await svc.createManual(kopId, userId, { keterangan: 'jurnal asli', lines: [
    { coaKode: '111000', debit: 20000, kredit: 0 },
    { coaKode: '410000', debit: 0, kredit: 20000 },
  ] } as any);
  const before: any = await svc.get(kopId, created.id);

  await expect(
    svc.updateDraft(kopId, created.id, { keterangan: 'coba ubah lintas tenant', businessUnitId: unitBId, lines: [
      { coaKode: '111000', debit: 30000, kredit: 0 },
      { coaKode: '410000', debit: 0, kredit: 30000 },
    ] } as any),
  ).rejects.toMatchObject({ status: 400, message: 'UNIT_TIDAK_DITEMUKAN' });

  const after: any = await svc.get(kopId, created.id);
  expect(after).toEqual(before);
});

it('CoaService.create dengan parentId milik koperasi lain → ditolak (400)', async () => {
  await expect(
    coaSvc.create(kopId, { kode: '999000', nama: 'Akun Lintas Tenant', type: 'ASSET', parentId: coaBId } as any),
  ).rejects.toMatchObject({ status: 400, message: 'AKUN_INDUK_TIDAK_VALID' });

  const rows = await prisma.coaAccount.findMany({ where: { koperasiId: kopId, kode: '999000' } });
  expect(rows).toHaveLength(0);
});

it('list dengan source=BOGUS tidak throw (500) — resolve dgn data array', async () => {
  const result: any = await svc.list(kopId, { source: 'BOGUS' } as any);
  expect(Array.isArray(result.data)).toBe(true);
});
