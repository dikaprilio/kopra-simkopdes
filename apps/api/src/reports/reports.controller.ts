import { BadRequestException, Controller, Get, NotFoundException, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  bukuBesar,
  bukuKas,
  jakartaDateStart,
  jakartaInclusiveRange,
  jakartaMonthRange,
  neraca,
  neracaSaldo,
  phu,
} from '@kopra/core';
import { prisma } from '@kopra/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import {
  CashReportQueryDto,
  NeracaReportQueryDto,
  PhuReportQueryDto,
  RangeReportQueryDto,
} from './dto/report-query.dto';
import { renderReportHtml } from './html';
import { buildReportWorkbook, reportFilename, type ReportWorkbookInput } from './report-xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function xlsxResponse(
  koperasiId: string,
  res: Response,
  input: Omit<ReportWorkbookInput, 'koperasiName'>,
  reportName: string,
  periodToken: string,
) {
  const koperasi = await prisma.koperasi.findUnique({
    where: { id: koperasiId }, select: { nama: true },
  });
  if (!koperasi) throw new NotFoundException('KOPERASI_TIDAK_DITEMUKAN');
  const filename = reportFilename(reportName, koperasi.nama, periodToken);
  res.type(XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return buildReportWorkbook({ ...input, koperasiName: koperasi.nama } as ReportWorkbookInput);
}

function validMonth(month?: string) {
  if (!month) return;
  try {
    jakartaMonthRange(month);
  } catch {
    throw new BadRequestException('BULAN_TIDAK_VALID');
  }
}

function validDate(date?: string) {
  if (!date) return;
  try {
    jakartaDateStart(date);
  } catch {
    throw new BadRequestException('TANGGAL_TIDAK_VALID');
  }
}

function range(from?: string, to?: string) {
  validDate(from);
  validDate(to);
  if (from && to && from > to) throw new BadRequestException('RENTANG_TANGGAL_TIDAK_VALID');
  return jakartaInclusiveRange(from, to);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  @Get('buku-besar')
  async bukuBesar(@CurrentUser() u: JwtPayload, @Query() query: RangeReportQueryDto, @Res({ passthrough: true }) res?: Response) {
    const data = await bukuBesar(u.koperasiId, range(query.from, query.to));
    if (query.format === 'xlsx' && res) {
      const period = query.from || query.to ? `${query.from ?? 'awal'}_${query.to ?? 'akhir'}` : 'Semua_Periode';
      return xlsxResponse(u.koperasiId, res, {
        kind: 'buku-besar', data, periodLabel: query.from || query.to
          ? `${query.from ?? 'Awal'} – ${query.to ?? 'Sekarang'}` : 'Semua periode',
      }, 'Buku Besar', period);
    }
    if (query.format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Buku Besar', ['Kode', 'Akun', 'Debit', 'Kredit', 'Saldo'],
        data.map((row) => [row.kode, row.nama, row.totalDebit, row.totalKredit, row.saldo]));
    }
    return data;
  }

  @Get('neraca-saldo')
  async neracaSaldo(@CurrentUser() u: JwtPayload, @Query() query: RangeReportQueryDto, @Res({ passthrough: true }) res?: Response) {
    const data = await neracaSaldo(u.koperasiId, range(query.from, query.to));
    if (query.format === 'xlsx' && res) {
      const period = query.from || query.to ? `${query.from ?? 'awal'}_${query.to ?? 'akhir'}` : 'Semua_Periode';
      return xlsxResponse(u.koperasiId, res, {
        kind: 'neraca-saldo', data, periodLabel: query.from || query.to
          ? `${query.from ?? 'Awal'} – ${query.to ?? 'Sekarang'}` : 'Semua periode',
      }, 'Neraca Saldo', period);
    }
    if (query.format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Neraca Saldo', ['Kode', 'Akun', 'Debit', 'Kredit'],
        data.rows.map((row) => [row.kode, row.nama, row.debit, row.kredit]),
        data.balanced ? `Neraca Seimbang ✓ (D ${data.totalDebit} = K ${data.totalKredit})` : 'TIDAK SEIMBANG');
    }
    return data;
  }

  @Get('phu')
  async phu(@CurrentUser() u: JwtPayload, @Query() query: PhuReportQueryDto, @Res({ passthrough: true }) res?: Response) {
    validMonth(query.month);
    if (query.unitId) {
      const unit = await prisma.businessUnit.findFirst({
        where: { id: query.unitId, koperasiId: u.koperasiId }, select: { id: true },
      });
      if (!unit) throw new NotFoundException('UNIT_TIDAK_DITEMUKAN');
    }
    const data = await phu(u.koperasiId, { month: query.month, businessUnitId: query.unitId });
    if (query.format === 'xlsx' && res) {
      const period = `${query.month ?? 'Semua_Periode'}${query.unitId ? '_Unit' : ''}`;
      return xlsxResponse(u.koperasiId, res, {
        kind: 'phu', data, periodLabel: `${query.month ?? 'Semua periode'}${query.unitId ? ' · Unit terpilih' : ''}`,
      }, 'PHU', period);
    }
    return data;
  }

  @Get('neraca')
  async neraca(@CurrentUser() u: JwtPayload, @Query() query: NeracaReportQueryDto, @Res({ passthrough: true }) res?: Response) {
    validDate(query.date);
    const data = await neraca(u.koperasiId, { asOf: query.date ? jakartaDateStart(query.date) : undefined });
    if (query.format === 'xlsx' && res) {
      return xlsxResponse(u.koperasiId, res, {
        kind: 'neraca', data, periodLabel: query.date ? `Per ${query.date}` : 'Posisi terkini',
      }, 'Neraca', query.date ?? 'Terkini');
    }
    return data;
  }

  @Get('buku-kas')
  async bukuKas(@CurrentUser() u: JwtPayload, @Query() query: CashReportQueryDto, @Res({ passthrough: true }) res?: Response) {
    validMonth(query.month);
    const kode = query.kode ?? '111000';
    const account = await prisma.coaAccount.findFirst({
      where: { koperasiId: u.koperasiId, kode }, select: { id: true, nama: true },
    });
    if (!account) throw new NotFoundException('AKUN_TIDAK_DITEMUKAN');
    const data = await bukuKas(u.koperasiId, { month: query.month, kode });
    if (query.format === 'xlsx' && res) {
      return xlsxResponse(u.koperasiId, res, {
        kind: 'buku-kas', data, periodLabel: `${query.month ?? 'Semua periode'} · ${kode}`,
      }, 'Buku Kas', `${query.month ?? 'Semua_Periode'}_${kode}`);
    }
    if (query.format === 'html' && res) {
      res.type('html');
      return renderReportHtml(`Buku Kas (akun ${kode})`, ['Tanggal', 'No', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
        data.rows.map((row) => [row.tanggal, row.nomor, row.keterangan, row.debit, row.kredit, row.saldo]),
        `Saldo akhir: ${new Intl.NumberFormat('id-ID').format(data.saldoAkhir)}`);
    }
    return data;
  }
}
