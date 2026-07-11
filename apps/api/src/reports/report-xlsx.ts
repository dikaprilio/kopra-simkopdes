import ExcelJS from 'exceljs';

type BukuBesarRow = {
  kode: string; nama: string; type: string;
  totalDebit: number; totalKredit: number; saldo: number;
};
type NeracaSaldoData = {
  rows: { kode: string; nama: string; debit: number; kredit: number }[];
  totalDebit: number; totalKredit: number; balanced: boolean;
};
type PhuData = { pendapatan: number; beban: number; labaBersih: number };
type NeracaData = {
  aset: number; kewajiban: number; ekuitas: number; labaBerjalan: number; balanced: boolean;
};
type BukuKasData = {
  rows: { tanggal: string; nomor: string; keterangan: string; debit: number; kredit: number; saldo: number }[];
  saldoAkhir: number;
};

type ReportBase = { koperasiName: string; periodLabel: string };
export type ReportWorkbookInput = ReportBase & (
  | { kind: 'buku-besar'; data: BukuBesarRow[] }
  | { kind: 'neraca-saldo'; data: NeracaSaldoData }
  | { kind: 'phu'; data: PhuData }
  | { kind: 'neraca'; data: NeracaData }
  | { kind: 'buku-kas'; data: BukuKasData }
);

const TITLES = {
  'buku-besar': 'Laporan Buku Besar',
  'neraca-saldo': 'Laporan Neraca Saldo',
  phu: 'Laporan Perhitungan Hasil Usaha',
  neraca: 'Laporan Neraca',
  'buku-kas': 'Laporan Buku Kas',
} as const;

const SHEETS = {
  'buku-besar': 'Buku Besar',
  'neraca-saldo': 'Neraca Saldo',
  phu: 'PHU',
  neraca: 'Neraca',
  'buku-kas': 'Buku Kas',
} as const;

const MONEY_FORMAT = '#,##0.00;[Red](#,##0.00);-';
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

function formula(formulaText: string, result: number): ExcelJS.CellFormulaValue {
  return { formula: formulaText, result };
}

function totalFormula(column: string, start: number, end: number, result: number) {
  return formula(end >= start ? `SUM(${column}${start}:${column}${end})` : '0', result);
}

function setupSheet(workbook: ExcelJS.Workbook, input: ReportWorkbookInput, columnCount: number) {
  const sheet = workbook.addWorksheet(SHEETS[input.kind], {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  const last = sheet.getColumn(columnCount).letter;
  sheet.mergeCells(`A1:${last}1`);
  sheet.mergeCells(`A2:${last}2`);
  sheet.mergeCells(`A3:${last}3`);
  sheet.getCell('A1').value = TITLES[input.kind];
  sheet.getCell('A2').value = input.koperasiName;
  sheet.getCell('A3').value = input.periodLabel;
  sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF173B33' } };
  sheet.getCell('A2').font = { name: 'Arial', size: 11, bold: true };
  sheet.getCell('A3').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF4B5563' } };
  sheet.getCell('A1').alignment = sheet.getCell('A2').alignment = sheet.getCell('A3').alignment = {
    horizontal: 'center', vertical: 'middle',
  };
  sheet.getRow(1).height = 25;
  sheet.headerFooter.oddFooter = '&LKopra ERP&C&P / &N&R&D &T';
  return sheet;
}

function addHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.getRow(5);
  row.values = headers;
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6B5C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  });
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: headers.length } };
}

function emptyState(sheet: ExcelJS.Worksheet, columns: number) {
  const last = sheet.getColumn(columns).letter;
  sheet.mergeCells(`A6:${last}6`);
  const cell = sheet.getCell('A6');
  cell.value = 'Tidak ada data untuk filter ini.';
  cell.font = { name: 'Arial', italic: true, color: { argb: 'FF6B7280' } };
  cell.alignment = { horizontal: 'center' };
}

function styleBody(sheet: ExcelJS.Worksheet, numberColumns: number[], totalRow?: number) {
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, columnNumber) => {
      if (!cell.font?.name) cell.font = { ...cell.font, name: 'Arial' };
      if (rowNumber >= 6) {
        cell.border = BORDER;
        cell.alignment = { vertical: 'middle', horizontal: numberColumns.includes(columnNumber) ? 'right' : 'left' };
        if (numberColumns.includes(columnNumber)) cell.numFmt = MONEY_FORMAT;
      }
      if (totalRow === rowNumber) {
        cell.font = { ...cell.font, name: 'Arial', bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3F0' } };
      }
    });
  });
}

function buildBukuBesar(sheet: ExcelJS.Worksheet, data: BukuBesarRow[]) {
  addHeader(sheet, ['Kode', 'Akun', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo (Rp)']);
  data.forEach((row) => sheet.addRow([row.kode, row.nama, row.totalDebit, row.totalKredit, row.saldo]));
  if (!data.length) emptyState(sheet, 5);
  const totalRow = Math.max(7, 6 + data.length);
  const end = 5 + data.length;
  sheet.getCell(`A${totalRow}`).value = 'TOTAL';
  sheet.getCell(`C${totalRow}`).value = totalFormula('C', 6, end, data.reduce((sum, row) => sum + row.totalDebit, 0));
  sheet.getCell(`D${totalRow}`).value = totalFormula('D', 6, end, data.reduce((sum, row) => sum + row.totalKredit, 0));
  sheet.getCell(`E${totalRow}`).value = totalFormula('E', 6, end, data.reduce((sum, row) => sum + row.saldo, 0));
  styleBody(sheet, [3, 4, 5], totalRow);
  sheet.columns = [{ width: 14 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }];
}

function buildNeracaSaldo(sheet: ExcelJS.Worksheet, data: NeracaSaldoData) {
  addHeader(sheet, ['Kode', 'Akun', 'Debit (Rp)', 'Kredit (Rp)']);
  data.rows.forEach((row) => sheet.addRow([row.kode, row.nama, row.debit, row.kredit]));
  if (!data.rows.length) emptyState(sheet, 4);
  const totalRow = Math.max(7, 6 + data.rows.length);
  const end = 5 + data.rows.length;
  sheet.getCell(`A${totalRow}`).value = data.balanced ? 'TOTAL · SEIMBANG' : 'TOTAL · TIDAK SEIMBANG';
  sheet.getCell(`C${totalRow}`).value = totalFormula('C', 6, end, data.totalDebit);
  sheet.getCell(`D${totalRow}`).value = totalFormula('D', 6, end, data.totalKredit);
  styleBody(sheet, [3, 4], totalRow);
  sheet.columns = [{ width: 14 }, { width: 38 }, { width: 20 }, { width: 20 }];
}

function buildPhu(sheet: ExcelJS.Worksheet, data: PhuData) {
  addHeader(sheet, ['Komponen', 'Nilai (Rp)']);
  sheet.addRow(['Pendapatan', data.pendapatan]);
  sheet.addRow(['Beban', data.beban]);
  sheet.addRow(['Laba Bersih', formula('B6-B7', data.labaBersih)]);
  styleBody(sheet, [2], 8);
  sheet.columns = [{ width: 38 }, { width: 24 }];
}

function buildNeraca(sheet: ExcelJS.Worksheet, data: NeracaData) {
  addHeader(sheet, ['Komponen', 'Nilai (Rp)']);
  sheet.addRow(['Aset', data.aset]);
  sheet.addRow(['Kewajiban', data.kewajiban]);
  sheet.addRow(['Ekuitas', data.ekuitas]);
  sheet.addRow(['Laba Berjalan', data.labaBerjalan]);
  sheet.addRow([
    data.balanced ? 'Total Pasiva · SEIMBANG' : 'Total Pasiva · TIDAK SEIMBANG',
    formula('B7+B8+B9', data.kewajiban + data.ekuitas + data.labaBerjalan),
  ]);
  styleBody(sheet, [2], 10);
  sheet.columns = [{ width: 38 }, { width: 24 }];
}

function buildBukuKas(sheet: ExcelJS.Worksheet, data: BukuKasData) {
  addHeader(sheet, ['Tanggal', 'Nomor', 'Keterangan', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo (Rp)']);
  data.rows.forEach((row, index) => {
    const rowNumber = 6 + index;
    sheet.addRow([
      new Date(`${row.tanggal}T00:00:00.000Z`), row.nomor, row.keterangan, row.debit, row.kredit,
      formula(index === 0 ? `D${rowNumber}-E${rowNumber}` : `F${rowNumber - 1}+D${rowNumber}-E${rowNumber}`, row.saldo),
    ]);
    sheet.getCell(`A${rowNumber}`).numFmt = 'dd mmm yyyy';
  });
  if (!data.rows.length) emptyState(sheet, 6);
  const totalRow = Math.max(7, 6 + data.rows.length);
  const end = 5 + data.rows.length;
  sheet.getCell(`A${totalRow}`).value = 'SALDO AKHIR';
  sheet.getCell(`D${totalRow}`).value = totalFormula('D', 6, end, data.rows.reduce((sum, row) => sum + row.debit, 0));
  sheet.getCell(`E${totalRow}`).value = totalFormula('E', 6, end, data.rows.reduce((sum, row) => sum + row.kredit, 0));
  sheet.getCell(`F${totalRow}`).value = formula(data.rows.length ? `F${end}` : '0', data.saldoAkhir);
  styleBody(sheet, [4, 5, 6], totalRow);
  sheet.columns = [
    { width: 16 }, { width: 16 }, { width: 42 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
}

export async function buildReportWorkbook(input: ReportWorkbookInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kopra ERP';
  workbook.company = 'Kopra';
  workbook.subject = TITLES[input.kind];
  workbook.title = TITLES[input.kind];
  workbook.description = `Dihasilkan oleh Kopra ERP · ${input.periodLabel}`;
  workbook.calcProperties.fullCalcOnLoad = true;

  if (input.kind === 'buku-besar') buildBukuBesar(setupSheet(workbook, input, 5), input.data);
  if (input.kind === 'neraca-saldo') buildNeracaSaldo(setupSheet(workbook, input, 4), input.data);
  if (input.kind === 'phu') buildPhu(setupSheet(workbook, input, 2), input.data);
  if (input.kind === 'neraca') buildNeraca(setupSheet(workbook, input, 2), input.data);
  if (input.kind === 'buku-kas') buildBukuKas(setupSheet(workbook, input, 6), input.data);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function filenamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function reportFilename(report: string, koperasi: string, period: string): string {
  return `Kopra_${filenamePart(report)}_${filenamePart(koperasi)}_${filenamePart(period)}.xlsx`;
}
