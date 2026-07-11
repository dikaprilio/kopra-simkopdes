/** HTTP-layer spec utk Members/Products/Stock services — rapel simpanan + stok atas @kopra/core. */
import { prisma } from '@kopra/db';
import { DEFAULT_COA } from '../../../../packages/db/src/coa-default';
import { MembersService } from './members.service';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

let kopId = '', userId = '';
let kopBId = '';
const membersSvc = new MembersService();
const productsSvc = new ProductsService();
const stockSvc = new StockService();

beforeAll(async () => {
  for (const t of [
    'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'members', 'business_units', 'coa_accounts',
    'whatsapp_identities', 'users', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);

  const kop = await prisma.koperasi.create({ data: { nama: 'Kop Koperasi HTTP Test', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' } });
  kopId = kop.id;
  const byKode = new Map<string, string>();
  for (const c of DEFAULT_COA) {
    const r = await prisma.coaAccount.create({ data: { koperasiId: kopId, kode: c.kode, nama: c.nama, type: c.type, parentId: c.parentKode ? byKode.get(c.parentKode) : undefined } });
    byKode.set(c.kode, r.id);
  }
  const user = await prisma.user.create({ data: { email: 'koperasi-http@t.id', passwordHash: 'x', name: 'T', role: 'PENGURUS', status: 'ACTIVE', koperasiId: kopId } });
  userId = user.id;

  // Tenant B — cross-tenant guard case.
  const kopB = await prisma.koperasi.create({ data: { nama: 'Kop Tenant B', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' } });
  kopBId = kopB.id;
});

afterAll(async () => { await prisma.$disconnect(); });

async function memberWithSavings(kop: string, nama: string, type: 'WAJIB' | 'POKOK', periods: string[], amount = 10000) {
  const member = await prisma.member.create({ data: { koperasiId: kop, nama } });
  for (const period of periods) {
    await prisma.memberSaving.create({ data: { memberId: member.id, type, period, amount, status: 'UNPAID' } });
  }
  return member;
}

describe('MembersService.pay — rapel', () => {
  it('happy path: 3 periode UNPAID WAJIB → satu jurnal CONFIRMED + 3 periode PAID', async () => {
    const member = await memberWithSavings(kopId, 'Bu Rapel', 'WAJIB', ['2026-01', '2026-02', '2026-03']);
    const savings = await prisma.memberSaving.findMany({ where: { memberId: member.id } });

    const result: any = await membersSvc.pay(kopId, userId, member.id, savings.map((s) => s.id));

    expect(result.paid).toBe(3);
    expect(result.total).toBe('30000');
    expect(result.journalId).toBeTruthy();

    const entry = await prisma.journalEntry.findUnique({ where: { id: result.journalId } });
    expect(entry?.status).toBe('CONFIRMED');

    const rows = await prisma.memberSaving.findMany({ where: { memberId: member.id } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === 'PAID')).toBe(true);
    expect(rows.every((r) => r.journalEntryId === result.journalId)).toBe(true);
  });

  it('campur POKOK+WAJIB → 400 CAMPUR_TIPE_SIMPANAN, tidak ada yang berubah', async () => {
    const member = await prisma.member.create({ data: { koperasiId: kopId, nama: 'Bu Campur' } });
    const pokok = await prisma.memberSaving.create({ data: { memberId: member.id, type: 'POKOK', period: '2026-01', amount: 25000, status: 'UNPAID' } });
    const wajib = await prisma.memberSaving.create({ data: { memberId: member.id, type: 'WAJIB', period: '2026-01', amount: 10000, status: 'UNPAID' } });

    await expect(membersSvc.pay(kopId, userId, member.id, [pokok.id, wajib.id])).rejects.toMatchObject({ status: 400, message: 'CAMPUR_TIPE_SIMPANAN' });

    const rows = await prisma.memberSaving.findMany({ where: { memberId: member.id } });
    expect(rows.every((r) => r.status === 'UNPAID' && r.journalEntryId === null)).toBe(true);
  });

  it('semua id sudah PAID → 409 SIMPANAN_SUDAH_DIBAYAR', async () => {
    const member = await prisma.member.create({ data: { koperasiId: kopId, nama: 'Bu Lunas' } });
    const paid = await prisma.memberSaving.create({ data: { memberId: member.id, type: 'WAJIB', period: '2026-01', amount: 10000, status: 'PAID', paidAt: new Date() } });

    await expect(membersSvc.pay(kopId, userId, member.id, [paid.id])).rejects.toMatchObject({ status: 409, message: 'SIMPANAN_SUDAH_DIBAYAR' });
  });

  it('memberId milik koperasi lain → 404 ANGGOTA_TIDAK_DITEMUKAN', async () => {
    const memberB = await memberWithSavings(kopBId, 'Anggota Tenant B', 'WAJIB', ['2026-01']);
    const savingsB = await prisma.memberSaving.findMany({ where: { memberId: memberB.id } });

    await expect(membersSvc.pay(kopId, userId, memberB.id, savingsB.map((s) => s.id))).rejects.toMatchObject({ status: 404, message: 'ANGGOTA_TIDAK_DITEMUKAN' });

    const rows = await prisma.memberSaving.findMany({ where: { memberId: memberB.id } });
    expect(rows.every((r) => r.status === 'UNPAID')).toBe(true);
  });
});

describe('StockService.create/confirm', () => {
  it('OUT pada produk dengan hargaJual → movement DRAFT + jurnal linked DRAFT; confirm → keduanya CONFIRMED', async () => {
    const product = await prisma.product.create({ data: { koperasiId: kopId, nama: 'Produk Stok A', unit: 'Pcs', hargaJual: 15000 } });
    await prisma.stockMovement.create({ data: { koperasiId: kopId, productId: product.id, type: 'ADJUST', qty: 20, sourceChannel: 'SEED', status: 'CONFIRMED', createdById: userId } });

    const draft: any = await stockSvc.create(kopId, userId, { productId: product.id, type: 'OUT', qty: 5 } as any);
    expect(draft.movementId).toBeTruthy();
    expect(draft.journal).toBeTruthy();

    const movementDraft = await prisma.stockMovement.findUnique({ where: { id: draft.movementId } });
    expect(movementDraft?.status).toBe('DRAFT');
    expect(movementDraft?.journalEntryId).toBe(draft.journal.entry.id);
    const journalDraft = await prisma.journalEntry.findUnique({ where: { id: draft.journal.entry.id } });
    expect(journalDraft?.status).toBe('DRAFT');

    await stockSvc.confirm(kopId, userId, draft.movementId);

    const movementConfirmed = await prisma.stockMovement.findUnique({ where: { id: draft.movementId } });
    expect(movementConfirmed?.status).toBe('CONFIRMED');
    const journalConfirmed = await prisma.journalEntry.findUnique({ where: { id: draft.journal.entry.id } });
    expect(journalConfirmed?.status).toBe('CONFIRMED');
  });

  it('OUT qty melebihi stok → DomainError INSUFFICIENT_STOCK', async () => {
    const product = await prisma.product.create({ data: { koperasiId: kopId, nama: 'Produk Stok B', unit: 'Pcs', hargaJual: 5000 } });
    await prisma.stockMovement.create({ data: { koperasiId: kopId, productId: product.id, type: 'ADJUST', qty: 3, sourceChannel: 'SEED', status: 'CONFIRMED', createdById: userId } });

    await expect(stockSvc.create(kopId, userId, { productId: product.id, type: 'OUT', qty: 999 } as any)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });
});

describe('ProductsService.remove — delete-guard', () => {
  it('produk ber-movement → inactivated (bukan dihapus)', async () => {
    const product = await prisma.product.create({ data: { koperasiId: kopId, nama: 'Produk Delete-Guard', unit: 'Pcs', hargaJual: 8000 } });
    await prisma.stockMovement.create({ data: { koperasiId: kopId, productId: product.id, type: 'ADJUST', qty: 10, sourceChannel: 'SEED', status: 'CONFIRMED', createdById: userId } });

    const result = await productsSvc.remove(kopId, userId, product.id);
    expect(result).toEqual({ inactivated: true });

    const row = await prisma.product.findUnique({ where: { id: product.id } });
    expect(row?.isActive).toBe(false);
  });

  it('produk tanpa movement → deleted (row hilang)', async () => {
    const product = await prisma.product.create({ data: { koperasiId: kopId, nama: 'Produk Tanpa Movement', unit: 'Pcs' } });

    const result = await productsSvc.remove(kopId, userId, product.id);
    expect(result).toEqual({ deleted: true });

    const row = await prisma.product.findUnique({ where: { id: product.id } });
    expect(row).toBeNull();
  });
});
