import { prisma } from '@kopra/db';
import { JournalService } from './journal.service';

const service = new JournalService();
let koperasiId = '';
let foreignKoperasiId = '';
let actorId = '';

const basicLines = (amount = 25_000) => [
  { coaKode: '111000', debit: amount, kredit: 0, catatan: 'Kas diterima' },
  { coaKode: '410000', debit: 0, kredit: amount, catatan: 'Pendapatan utama' },
];

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'whatsapp_identities', 'users', 'members',
    'business_units', 'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: 'Journal CRUD Test' } }),
    prisma.koperasi.create({ data: { nama: 'Journal CRUD Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  actorId = (await prisma.user.create({
    data: {
      email: 'journal-crud@example.test', passwordHash: 'x', name: 'Journal Actor',
      role: 'PENGURUS', koperasiId,
    },
  })).id;
  await prisma.coaAccount.createMany({ data: [
    { koperasiId, kode: '111000', nama: 'Kas', type: 'ASSET' },
    { koperasiId, kode: '410000', nama: 'Pendapatan', type: 'REVENUE' },
    { koperasiId, kode: '510000', nama: 'Beban', type: 'EXPENSE' },
  ] });
});

describe('JournalService ERP workflow contract', () => {
  it('persists dates for simple/manual drafts, manual notes, and rejects internal-only simple kinds', async () => {
    const simple: any = await service.createSimple(koperasiId, actorId, {
      kind: 'INCOME', amount: 10_000, description: 'Dated simple', date: '2026-05-10',
    } as any);
    expect(simple.date.toISOString()).toBe('2026-05-10T00:00:00.000Z');

    const manual: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Dated manual', date: '2026-05-11', lines: basicLines(),
    } as any);
    expect(manual.date.toISOString()).toBe('2026-05-11T00:00:00.000Z');
    expect(manual.lines.map((line: any) => line.catatan).sort())
      .toEqual(['Kas diterima', 'Pendapatan utama']);

    await expect(service.createSimple(koperasiId, actorId, {
      kind: 'STOCK_SALE', amount: 10_000, description: 'Must use stock workflow',
    } as any)).rejects.toMatchObject({ status: 400, message: 'JENIS_JURNAL_SEDERHANA_TIDAK_VALID' });
  });

  it('lists with search/status/source/date pagination using a stable response envelope', async () => {
    for (const [description, date] of [
      ['Filter Journal Alpha', '2026-06-01'],
      ['Filter Journal Beta', '2026-06-02'],
      ['Filter Journal Gamma', '2026-07-01'],
    ]) {
      await service.createManual(koperasiId, actorId, {
        keterangan: description, date, lines: basicLines(1_000),
      } as any);
    }
    const first: any = await service.list(koperasiId, {
      search: 'Filter Journal', status: 'DRAFT', source: 'WEB',
      from: '2026-06-01', to: '2026-06-30', page: '1', pageSize: '1',
    } as any);
    const second: any = await service.list(koperasiId, {
      search: 'Filter Journal', status: 'DRAFT', source: 'WEB',
      from: '2026-06-01', to: '2026-06-30', page: '2', pageSize: '1',
    } as any);
    expect(first).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(first.data[0].keterangan).toBe('Filter Journal Beta');
    expect(second.data[0].keterangan).toBe('Filter Journal Alpha');
  });

  it('replaces a draft date/header/lines transactionally and audits the update', async () => {
    const draft: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Before replace', date: '2026-04-01', lines: basicLines(2_000),
    } as any);
    const updated: any = await (service as any).updateDraft(koperasiId, actorId, draft.id, {
      keterangan: 'After replace', referensi: 'REF-NEW', date: '2026-04-02',
      lines: [
        { coaKode: '111000', debit: 3_000, kredit: 0, catatan: 'New debit' },
        { coaKode: '410000', debit: 0, kredit: 3_000, catatan: 'New credit' },
      ],
    });
    expect(updated).toMatchObject({ keterangan: 'After replace', referensi: 'REF-NEW' });
    expect(updated.date.toISOString()).toBe('2026-04-02T00:00:00.000Z');
    expect(updated.lines).toHaveLength(2);
    expect(updated.lines.map((line: any) => line.catatan).sort()).toEqual(['New credit', 'New debit']);
    expect(await prisma.auditLog.count({
      where: { resourceRef: draft.id, action: 'journal.update', actorId },
    })).toBe(1);
  });

  it('audits draft creation, confirmation, and deletion while preserving immutable confirmed rows', async () => {
    const confirmed: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Confirm audit', lines: basicLines(4_000),
    } as any);
    await (service as any).confirm(koperasiId, actorId, confirmed.id);
    await expect((service as any).remove(koperasiId, actorId, confirmed.id))
      .rejects.toMatchObject({ code: 'IMMUTABLE' });
    expect(await prisma.journalEntry.findUniqueOrThrow({ where: { id: confirmed.id } }))
      .toMatchObject({ status: 'CONFIRMED' });

    const deleted: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Delete audit', lines: basicLines(5_000),
    } as any);
    await expect((service as any).remove(koperasiId, actorId, deleted.id))
      .resolves.toEqual({ deleted: true });
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: confirmed.id }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([{ action: 'journal.create' }, { action: 'journal.confirm' }]);
    expect(await prisma.auditLog.findMany({
      where: { resourceRef: deleted.id }, orderBy: { createdAt: 'asc' }, select: { action: true },
    })).toEqual([{ action: 'journal.create' }, { action: 'journal.delete' }]);
  });

  it('creates one draft reversal with swapped lines and rejects duplicates/reversal chains', async () => {
    const original: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Original reversible', date: '2026-03-01', lines: basicLines(7_000),
    } as any);
    await (service as any).confirm(koperasiId, actorId, original.id);
    const reversal: any = await (service as any).reverse(koperasiId, actorId, original.id, {
      date: '2026-03-02', keterangan: 'Correction of original',
    });
    expect(reversal).toMatchObject({ status: 'DRAFT', reversalOfId: original.id, keterangan: 'Correction of original' });
    expect(reversal.lines.map((line: any) => [line.debit, line.kredit]))
      .toEqual(original.lines.map((line: any) => [line.kredit, line.debit]));
    await expect((service as any).reverse(koperasiId, actorId, original.id, {}))
      .rejects.toMatchObject({ status: 409, message: 'REVERSAL_EXISTS' });
    await expect((service as any).reverse(koperasiId, actorId, reversal.id, {}))
      .rejects.toMatchObject({ status: 409, message: 'REVERSAL_CHAIN' });
    expect(await prisma.auditLog.count({
      where: { resourceRef: reversal.id, action: 'journal.reverse', actorId },
    })).toBe(1);
  });

  it('rejects reversal of stock-linked journals', async () => {
    const product = await prisma.product.create({ data: { koperasiId, nama: 'Linked Product' } });
    const original: any = await service.createManual(koperasiId, actorId, {
      keterangan: 'Stock linked', lines: basicLines(8_000),
    } as any);
    await prisma.stockMovement.create({
      data: {
        koperasiId, productId: product.id, type: 'ADJUST', qty: 1,
        journalEntryId: original.id, sourceChannel: 'WEB', status: 'DRAFT', createdById: actorId,
      },
    });
    await (service as any).confirm(koperasiId, actorId, original.id);
    await expect((service as any).reverse(koperasiId, actorId, original.id, {}))
      .rejects.toMatchObject({ status: 409, message: 'JURNAL_STOK_GUNAKAN_KOREKSI_STOK' });
  });

  it('tenant-hides get/update/delete/confirm/reversal', async () => {
    const foreignActor = await prisma.user.create({
      data: {
        email: 'journal-foreign@example.test', passwordHash: 'x', name: 'Foreign',
        role: 'PENGURUS', koperasiId: foreignKoperasiId,
      },
    });
    const foreign = await prisma.journalEntry.create({
      data: {
        koperasiId: foreignKoperasiId, nomor: 'FOREIGN-1', keterangan: 'Foreign journal',
        sourceChannel: 'WEB', status: 'DRAFT', createdById: foreignActor.id,
      },
    });
    await expect(service.get(koperasiId, foreign.id))
      .rejects.toMatchObject({ status: 404, message: 'JURNAL_TIDAK_DITEMUKAN' });
    await expect((service as any).updateDraft(koperasiId, actorId, foreign.id, {
      keterangan: 'Stolen', lines: basicLines(),
    })).rejects.toMatchObject({ status: 404, message: 'JURNAL_TIDAK_DITEMUKAN' });
    await expect((service as any).remove(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect((service as any).confirm(koperasiId, actorId, foreign.id))
      .rejects.toMatchObject({ code: 'NOT_DRAFT' });
    await expect((service as any).reverse(koperasiId, actorId, foreign.id, {}))
      .rejects.toMatchObject({ status: 404, message: 'JURNAL_TIDAK_DITEMUKAN' });
  });
});
