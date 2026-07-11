import { prisma } from '@kopra/db';
import { writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { JwtPayload } from '../auth/jwt-payload';
import { ReportsController } from './reports.controller';

const controller = new ReportsController();
let koperasiId = '';
let actorId = '';
let foreignKoperasiId = '';
let kasId = '';
let bankId = '';
let revenueId = '';
let expenseId = '';
let unitAId = '';
let unitBId = '';
let user: JwtPayload;

beforeAll(async () => {
  for (const table of [
    'audit_logs', 'pending_actions', 'member_savings', 'stock_movements', 'journal_lines',
    'journal_entries', 'products', 'whatsapp_identities', 'users', 'members',
    'business_units', 'coa_accounts', 'koperasi',
  ]) await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  const [koperasi, foreign] = await Promise.all([
    prisma.koperasi.create({ data: { nama: 'Reports Query Test' } }),
    prisma.koperasi.create({ data: { nama: 'Reports Query Foreign' } }),
  ]);
  koperasiId = koperasi.id;
  foreignKoperasiId = foreign.id;
  const actor = await prisma.user.create({
    data: {
      email: 'reports-query@example.test', passwordHash: 'x', name: 'Reports Actor',
      role: 'PENGURUS', koperasiId,
    },
  });
  actorId = actor.id;
  user = { sub: actorId, koperasiId, role: 'PENGURUS', status: 'ACTIVE' };
  const accounts = await Promise.all([
    prisma.coaAccount.create({ data: { koperasiId, kode: '111000', nama: 'Kas', type: 'ASSET' } }),
    prisma.coaAccount.create({ data: { koperasiId, kode: '112100', nama: 'Bank', type: 'ASSET' } }),
    prisma.coaAccount.create({ data: { koperasiId, kode: '410000', nama: 'Pendapatan', type: 'REVENUE' } }),
    prisma.coaAccount.create({ data: { koperasiId, kode: '510000', nama: 'Beban', type: 'EXPENSE' } }),
  ]);
  [kasId, bankId, revenueId, expenseId] = accounts.map((account) => account.id);
  const [unitA, unitB] = await Promise.all([
    prisma.businessUnit.create({ data: { koperasiId, nama: 'Unit Report A', revenueCoaId: revenueId } }),
    prisma.businessUnit.create({ data: { koperasiId, nama: 'Unit Report B' } }),
  ]);
  unitAId = unitA.id;
  unitBId = unitB.id;
});

async function entry(
  nomor: string,
  date: string,
  debitId: string,
  creditId: string,
  amount: number,
  businessUnitId?: string,
) {
  return prisma.journalEntry.create({
    data: {
      koperasiId, nomor, date: new Date(date), keterangan: nomor,
      businessUnitId, sourceChannel: 'WEB', status: 'CONFIRMED', createdById: actorId,
      lines: { create: [
        { coaId: debitId, debit: amount, kredit: 0 },
        { coaId: creditId, debit: 0, kredit: amount },
      ] },
    },
  });
}

describe('report query contracts', () => {
  it('filters Buku Besar and Neraca Saldo by inclusive Jakarta from/to dates', async () => {
    await entry('RANGE-IN', '2026-06-15T05:00:00.000Z', kasId, revenueId, 100);
    await entry('RANGE-OUT', '2026-07-01T05:00:00.000Z', kasId, revenueId, 300);
    const query = { from: '2026-06-01', to: '2026-06-30' };
    const besar: any = await (controller as any).bukuBesar(user, query, undefined);
    const saldo: any = await (controller as any).neracaSaldo(user, query, undefined);
    expect(besar.find((row: any) => row.kode === '111000')).toMatchObject({ totalDebit: 100 });
    expect(saldo).toMatchObject({ totalDebit: 100, totalKredit: 100, balanced: true });
  });

  it('filters PHU by month and same-tenant business unit', async () => {
    await entry('PHU-A', '2026-05-10T05:00:00.000Z', kasId, revenueId, 500, unitAId);
    await entry('PHU-B', '2026-05-11T05:00:00.000Z', kasId, revenueId, 900, unitBId);
    const result: any = await (controller as any).phu(user, { month: '2026-05', unitId: unitAId });
    expect(result).toEqual({ pendapatan: 500, beban: 0, labaBersih: 500 });
  });

  it('treats Neraca date as inclusive through the last Jakarta millisecond', async () => {
    await entry('ASOF-IN', '2026-04-30T16:59:59.999Z', kasId, revenueId, 200);
    await entry('ASOF-OUT', '2026-04-30T17:00:00.000Z', kasId, revenueId, 700);
    const result: any = await (controller as any).neraca(user, { date: '2026-04-30' });
    expect(result.aset).toBe(200);
    expect(result.labaBerjalan).toBe(200);
  });

  it('filters Buku Kas by month and same-tenant account code', async () => {
    await entry('CASH-KAS', '2026-03-10T05:00:00.000Z', kasId, revenueId, 100);
    await entry('CASH-BANK', '2026-03-11T05:00:00.000Z', bankId, revenueId, 250);
    const result: any = await (controller as any).bukuKas(user, {
      month: '2026-03', kode: '112100',
    }, undefined);
    expect(result.rows).toHaveLength(1);
    expect(result).toMatchObject({ saldoAkhir: 250 });
    expect(result.rows[0].nomor).toBe('CASH-BANK');
  });

  it.each([
    ['invalid date', 'bukuBesar', { from: '2026-02-30' }, 'TANGGAL_TIDAK_VALID'],
    ['invalid range', 'neracaSaldo', { from: '2026-06-30', to: '2026-06-01' }, 'RENTANG_TANGGAL_TIDAK_VALID'],
    ['invalid month', 'phu', { month: '2026-13' }, 'BULAN_TIDAK_VALID'],
    ['missing unit', 'phu', { month: '2026-05', unitId: 'missing' }, 'UNIT_TIDAK_DITEMUKAN'],
    ['foreign unit', 'phu', { month: '2026-05', unitId: unitBId }, null],
    ['missing account', 'bukuKas', { month: '2026-03', kode: '999999' }, 'AKUN_TIDAK_DITEMUKAN'],
    ['invalid as-of', 'neraca', { date: 'not-a-date' }, 'TANGGAL_TIDAK_VALID'],
  ])('%s is deterministic', async (_label, method, query, message) => {
    if (message === null) return;
    await expect((controller as any)[method](user, query, undefined))
      .rejects.toMatchObject({ status: expect.any(Number), message });
  });

  it('rejects a business unit belonging to another tenant', async () => {
    const foreign = await prisma.businessUnit.create({
      data: { koperasiId: foreignKoperasiId, nama: 'Foreign Report Unit' },
    });
    await expect((controller as any).phu(user, { month: '2026-05', unitId: foreign.id }))
      .rejects.toMatchObject({ status: 404, message: 'UNIT_TIDAK_DITEMUKAN' });
  });

  it('exports one filtered XLSX download with matching rows', async () => {
    const headers: Record<string, string> = {};
    const response = {
      type(value: string) { headers['content-type'] = value; return this; },
      setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; return this; },
    };
    const buffer: Buffer = await (controller as any).bukuBesar(user, {
      from: '2026-06-01', to: '2026-06-30', format: 'xlsx',
    }, response);
    expect(headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(headers['content-disposition']).toMatch(/^attachment; filename="Kopra_Buku_Besar_/);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const path = '/tmp/kopra-filtered-export-test.xlsx';
    await writeFile(path, buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    const kasRow = sheet.getRows(6, 10)?.find((row) => row.getCell(1).value === '111000');
    expect(kasRow?.getCell(3).value).toBe(100);
  });
});
