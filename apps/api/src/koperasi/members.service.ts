import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import { confirmEntry, markPeriodsPaid, memberSavings, paySavingDraft } from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';

@Injectable()
export class MembersService {
  async list(koperasiId: string, q: { search?: string; unpaid?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.MemberWhereInput = { koperasiId };
    if (q.search) where.nama = { contains: q.search, mode: 'insensitive' };
    if (q.unpaid === 'true') where.savings = { some: { status: 'UNPAID' } };
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where, orderBy: { nama: 'asc' }, skip, take,
        select: { id: true, nama: true, waNumber: true, _count: { select: { savings: { where: { status: 'UNPAID' } } } } }, // no nik!
      }),
      prisma.member.count({ where }),
    ]);
    return { data: rows.map((m) => ({ id: m.id, nama: m.nama, waNumber: m.waNumber, unpaidCount: m._count.savings })), page, pageSize, total };
  }

  async savings(koperasiId: string, memberId: string) {
    const member = await prisma.member.findFirst({ where: { id: memberId, koperasiId }, select: { id: true, nama: true } });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    return serializeDecimals({ member, savings: await memberSavings(memberId) });
  }

  /** Rapel: bayar beberapa periode UNPAID sekaligus → satu jurnal confirmed + PAID. */
  async pay(koperasiId: string, actorId: string, memberId: string, savingIds: string[]) {
    const member = await prisma.member.findFirst({ where: { id: memberId, koperasiId } });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    const savings = await prisma.memberSaving.findMany({ where: { id: { in: savingIds }, memberId, status: 'UNPAID' } });
    if (!savings.length) throw new BadRequestException('TIDAK_ADA_PERIODE_UNPAID');
    const types = new Set(savings.map((s) => s.type));
    if (types.size > 1) throw new BadRequestException('CAMPUR_TIPE_SIMPANAN');
    const savingType = savings[0].type as 'POKOK' | 'WAJIB';
    const periods = savings.map((s) => s.period).sort();
    const total = savings.reduce((a, s) => a + Number(s.amount), 0);

    const draft = await paySavingDraft(actorId, { koperasiId, memberId, periods, amount: total, savingType }, 'WEB');
    await confirmEntry(draft.journal.entry.id, koperasiId);
    await markPeriodsPaid(memberId, savingType, periods, draft.journal.entry.id, Number(savings[0].amount));
    return { paid: periods.length, total: String(total), journalId: draft.journal.entry.id, nomor: draft.journal.entry.nomor };
  }
}
