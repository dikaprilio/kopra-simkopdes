import { mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { buildReportWorkbook, reportFilename, type ReportWorkbookInput } from './report-xlsx';

const cases: ReportWorkbookInput[] = [
  {
    kind: 'buku-besar', koperasiName: 'Koperasi Uji', periodLabel: '1–30 Juni 2026',
    data: [{ kode: '111000', nama: 'Kas', type: 'ASSET', totalDebit: 1200, totalKredit: 200, saldo: 1000 }],
  },
  {
    kind: 'neraca-saldo', koperasiName: 'Koperasi Uji', periodLabel: '1–30 Juni 2026',
    data: { rows: [{ kode: '111000', nama: 'Kas', debit: 1200, kredit: 1200 }], totalDebit: 1200, totalKredit: 1200, balanced: true },
  },
  {
    kind: 'phu', koperasiName: 'Koperasi Uji', periodLabel: 'Juni 2026',
    data: { pendapatan: 5000, beban: 2000, labaBersih: 3000 },
  },
  {
    kind: 'neraca', koperasiName: 'Koperasi Uji', periodLabel: '30 Juni 2026',
    data: { aset: 6000, kewajiban: 1000, ekuitas: 2000, labaBerjalan: 3000, balanced: true },
  },
  {
    kind: 'buku-kas', koperasiName: 'Koperasi Uji', periodLabel: 'Juni 2026 · 111000',
    data: { rows: [{ tanggal: '2026-06-10', nomor: 'JU-001', keterangan: 'Setoran', debit: 5000, kredit: 0, saldo: 5000 }], saldoAkhir: 5000 },
  },
];

describe('report XLSX builder', () => {
  it.each(cases)('builds a professional $kind workbook', async (input) => {
    const buffer = await buildReportWorkbook(input);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.creator).toBe('Kopra ERP');
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('A1').value).toContain('Laporan');
    expect(sheet.getCell('A2').value).toBe('Koperasi Uji');
    expect(sheet.getCell('A3').value).toBe(input.periodLabel);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 });
    expect(sheet.autoFilter).toBeTruthy();
    expect(sheet.pageSetup).toMatchObject({ orientation: 'landscape', paperSize: 9, fitToPage: true });
    expect(sheet.columns.every((column) => Number(column.width) >= 12)).toBe(true);

    let formulas = 0;
    let numericCells = 0;
    sheet.eachRow((row) => row.eachCell((cell) => {
      expect(cell.font?.name).toBe('Arial');
      if (typeof cell.value === 'number') numericCells++;
      if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) {
        formulas++;
        expect(cell.result).toEqual(expect.any(Number));
      }
    }));
    expect(numericCells + formulas).toBeGreaterThan(0);
    expect(formulas).toBeGreaterThan(0);
    expect(JSON.stringify(sheet.getSheetValues())).not.toContain('nik');
  });

  it('builds a valid formatted empty-state workbook', async () => {
    const buffer = await buildReportWorkbook({
      kind: 'buku-kas', koperasiName: 'Koperasi Kosong', periodLabel: 'Juli 2026',
      data: { rows: [], saldoAkhir: 0 },
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('A6').value).toBe('Tidak ada data untuk filter ini.');
    const formulaCells: ExcelJS.Cell[] = [];
    sheet.eachRow((row) => row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) formulaCells.push(cell);
    }));
    expect(formulaCells.length).toBeGreaterThan(0);
    expect(formulaCells.every((cell) => cell.result === 0)).toBe(true);
  });

  it('sanitizes a deterministic XLSX filename', () => {
    expect(reportFilename('Buku Kas', 'Kop/Desa: Maju?', '2026-06'))
      .toBe('Kopra_Buku_Kas_Kop_Desa_Maju_2026-06.xlsx');
  });

  it('writes workbook fixtures for LibreOffice recalculation checks', async () => {
    const dir = '/tmp/kopra-xlsx-tests';
    await mkdir(dir, { recursive: true });
    for (const input of cases) {
      await writeFile(`${dir}/${input.kind}.xlsx`, await buildReportWorkbook(input));
    }
  });
});
