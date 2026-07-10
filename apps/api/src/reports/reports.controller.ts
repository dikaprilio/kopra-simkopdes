import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { bukuBesar, bukuKas, neraca, neracaSaldo, phu } from '@kopra/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { renderReportHtml } from './html';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  @Get('buku-besar')
  async bukuBesar(@CurrentUser() u: JwtPayload, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const data = await bukuBesar(u.koperasiId);
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Buku Besar', ['Kode', 'Akun', 'Debit', 'Kredit', 'Saldo'],
        data.map((r) => [r.kode, r.nama, r.totalDebit, r.totalKredit, r.saldo]));
    }
    return data;
  }

  @Get('neraca-saldo')
  async neracaSaldo(@CurrentUser() u: JwtPayload, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const d = await neracaSaldo(u.koperasiId);
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Neraca Saldo', ['Kode', 'Akun', 'Debit', 'Kredit'],
        d.rows.map((r) => [r.kode, r.nama, r.debit, r.kredit]),
        d.balanced ? `Neraca Seimbang ✓ (D ${d.totalDebit} = K ${d.totalKredit})` : 'TIDAK SEIMBANG');
    }
    return d;
  }

  @Get('phu')
  phu(@CurrentUser() u: JwtPayload, @Query('month') month?: string, @Query('unitId') unitId?: string) {
    return phu(u.koperasiId, { month, businessUnitId: unitId });
  }

  @Get('neraca')
  neraca(@CurrentUser() u: JwtPayload, @Query('date') date?: string) {
    return neraca(u.koperasiId, { asOf: date ? new Date(date) : undefined });
  }

  @Get('buku-kas')
  async bukuKas(@CurrentUser() u: JwtPayload, @Query('month') month?: string, @Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const d = await bukuKas(u.koperasiId, { month });
    if (format === 'html' && res) {
      res.type('html');
      return renderReportHtml('Buku Kas (akun 111000)', ['Tanggal', 'No', 'Keterangan', 'Debit', 'Kredit', 'Saldo'],
        d.rows.map((r) => [r.tanggal, r.nomor, r.keterangan, r.debit, r.kredit, r.saldo]),
        `Saldo akhir: ${new Intl.NumberFormat('id-ID').format(d.saldoAkhir)}`);
    }
    return d;
  }
}
