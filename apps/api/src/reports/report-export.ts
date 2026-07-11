import {
  bukuBesar,
  bukuKas,
  jakartaDateStart,
  jakartaInclusiveRange,
  neraca,
  neracaSaldo,
  phu,
} from '@kopra/core';
import { prisma } from '@kopra/db';
import { buildReportWorkbook, reportFilename, type ReportWorkbookInput } from './report-xlsx';

export type ReportExportType = 'buku-besar' | 'neraca-saldo' | 'phu' | 'neraca' | 'buku-kas';

/** Parameter laporan di kolom payload outbox (kind=DOCUMENT). koperasiId SELALU dari actor, bukan input user. */
export interface ReportExportPayload {
  reportType: ReportExportType;
  koperasiId: string;
  from?: string; // YYYY-MM-DD (buku-besar, neraca-saldo)
  to?: string;
  month?: string; // YYYY-MM (phu, buku-kas)
  date?: string; // YYYY-MM-DD (neraca)
  kode?: string; // akun kas (buku-kas), default 111000
  requestedByUserId?: string;
}

const REPORT_TITLES: Record<ReportExportType, string> = {
  'buku-besar': 'Buku Besar',
  'neraca-saldo': 'Neraca Saldo',
  phu: 'PHU',
  neraca: 'Neraca',
  'buku-kas': 'Buku Kas',
};

function rangeLabels(from?: string, to?: string) {
  const has = Boolean(from || to);
  return {
    periodLabel: has ? `${from ?? 'Awal'} – ${to ?? 'Sekarang'}` : 'Semua periode',
    periodToken: has ? `${from ?? 'awal'}_${to ?? 'akhir'}` : 'Semua_Periode',
  };
}

/**
 * Bangun file XLSX dari payload outbox — mapping param→workbook SAMA dengan
 * reports.controller.ts (duplikasi disengaja utk hindari regresi jalur web; konsolidasi belakangan).
 */
export async function buildReportDocument(
  p: ReportExportPayload,
): Promise<{ buffer: Buffer; filename: string; caption: string }> {
  const koperasi = await prisma.koperasi.findUnique({
    where: { id: p.koperasiId },
    select: { nama: true },
  });
  if (!koperasi) throw new Error('KOPERASI_TIDAK_DITEMUKAN');

  let input: Omit<ReportWorkbookInput, 'koperasiName'>;
  let periodToken: string;

  switch (p.reportType) {
    case 'buku-besar': {
      const labels = rangeLabels(p.from, p.to);
      const data = await bukuBesar(p.koperasiId, jakartaInclusiveRange(p.from, p.to));
      input = { kind: 'buku-besar', data, periodLabel: labels.periodLabel };
      periodToken = labels.periodToken;
      break;
    }
    case 'neraca-saldo': {
      const labels = rangeLabels(p.from, p.to);
      const data = await neracaSaldo(p.koperasiId, jakartaInclusiveRange(p.from, p.to));
      input = { kind: 'neraca-saldo', data, periodLabel: labels.periodLabel };
      periodToken = labels.periodToken;
      break;
    }
    case 'phu': {
      const data = await phu(p.koperasiId, { month: p.month });
      input = { kind: 'phu', data, periodLabel: p.month ?? 'Semua periode' };
      periodToken = p.month ?? 'Semua_Periode';
      break;
    }
    case 'neraca': {
      const data = await neraca(p.koperasiId, {
        asOf: p.date ? jakartaDateStart(p.date) : undefined,
      });
      input = { kind: 'neraca', data, periodLabel: p.date ? `Per ${p.date}` : 'Posisi terkini' };
      periodToken = p.date ?? 'Terkini';
      break;
    }
    case 'buku-kas': {
      const kode = p.kode ?? '111000';
      const account = await prisma.coaAccount.findFirst({
        where: { koperasiId: p.koperasiId, kode },
        select: { id: true },
      });
      if (!account) throw new Error('AKUN_TIDAK_DITEMUKAN');
      const data = await bukuKas(p.koperasiId, { month: p.month, kode });
      input = { kind: 'buku-kas', data, periodLabel: `${p.month ?? 'Semua periode'} · ${kode}` };
      periodToken = `${p.month ?? 'Semua_Periode'}_${kode}`;
      break;
    }
    default:
      throw new Error(`LAPORAN_TIDAK_DIKENAL: ${(p as { reportType?: string }).reportType}`);
  }

  const title = REPORT_TITLES[p.reportType];
  const full = { ...input, koperasiName: koperasi.nama } as ReportWorkbookInput;
  return {
    buffer: await buildReportWorkbook(full),
    filename: reportFilename(title, koperasi.nama, periodToken),
    caption: `📄 *Laporan ${title}* — ${full.periodLabel}\n${koperasi.nama} · Kopra ERP`,
  };
}
