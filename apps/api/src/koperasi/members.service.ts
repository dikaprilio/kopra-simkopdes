import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  confirmEntry,
  currentJakartaMonth,
  markPeriodsPaid,
  memberSavings,
  paySavingDraft,
  writeWebMutationAudit,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import type {
  CreateMemberDto,
  MemberSavingsOnboardingDto,
  UpdateMemberDto,
} from './dto/member.dto';

const MEMBER_MASTER_SELECT = {
  id: true,
  nama: true,
  nik: true,
  waNumber: true,
  sourceRef: true,
  isActive: true,
  createdAt: true,
  _count: { select: { savings: { where: { status: 'UNPAID' } } } },
} satisfies Prisma.MemberSelect;

type MemberMasterRow = Prisma.MemberGetPayload<{ select: typeof MEMBER_MASTER_SELECT }>;

function safeMember(row: MemberMasterRow) {
  return {
    id: row.id,
    nama: row.nama,
    waNumber: row.waNumber,
    sourceRef: row.sourceRef,
    isActive: row.isActive,
    createdAt: row.createdAt,
    hasNik: Boolean(row.nik),
    unpaidCount: row._count.savings,
  };
}

function normalizedName(value: string): string {
  const result = value?.trim().replace(/\s+/g, ' ');
  if (!result) throw new BadRequestException('NAMA_ANGGOTA_TIDAK_VALID');
  return result;
}

function normalizedNik(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!/^[\d\s.-]+$/.test(value)) throw new BadRequestException('NIK_TIDAK_VALID');
  const digits = value.replace(/\D/g, '');
  if (!/^\d{16}$/.test(digits)) throw new BadRequestException('NIK_TIDAK_VALID');
  return digits;
}

function normalizedWaNumber(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  if (!/^[\d+\s().-]+$/.test(value))
    throw new BadRequestException('NOMOR_WA_TIDAK_VALID');
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^628\d{7,11}$/.test(digits))
    throw new BadRequestException('NOMOR_WA_TIDAK_VALID');
  return digits;
}

function nextMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function savingRows(savings?: MemberSavingsOnboardingDto) {
  if (!savings) return [];
  const supplied = savings.pokokAmount !== undefined || savings.wajibAmount !== undefined;
  if (!supplied) return [];
  const start = savings.startPeriod;
  const current = currentJakartaMonth();
  if (!start || !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || start > current)
    throw new BadRequestException('PERIODE_SIMPANAN_TIDAK_VALID');
  for (const amount of [savings.pokokAmount, savings.wajibAmount]) {
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0))
      throw new BadRequestException('NOMINAL_SIMPANAN_TIDAK_VALID');
  }
  const rows: { type: 'POKOK' | 'WAJIB'; period: string; amount: number }[] = [];
  if (savings.pokokAmount !== undefined)
    rows.push({ type: 'POKOK', period: start, amount: savings.pokokAmount });
  if (savings.wajibAmount !== undefined) {
    for (let period = start; period <= current; period = nextMonth(period))
      rows.push({ type: 'WAJIB', period, amount: savings.wajibAmount });
  }
  return rows;
}

@Injectable()
export class MembersService {
  async list(koperasiId: string, q: { search?: string; unpaid?: string; active?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.MemberWhereInput = { koperasiId };
    if (q.active !== 'all') where.isActive = q.active === 'false' ? false : true;
    if (q.search) where.nama = { contains: q.search, mode: 'insensitive' };
    if (q.unpaid === 'true') where.savings = { some: { status: 'UNPAID' } };
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: [{ nama: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: MEMBER_MASTER_SELECT,
      }),
      prisma.member.count({ where }),
    ]);
    return { data: rows.map(safeMember), page, pageSize, total };
  }

  async detail(koperasiId: string, memberId: string) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, koperasiId },
      select: MEMBER_MASTER_SELECT,
    });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    return safeMember(member);
  }

  async create(koperasiId: string, actorId: string, dto: CreateMemberDto) {
    const nama = normalizedName(dto.nama);
    const nik = normalizedNik(dto.nik);
    const waNumber = normalizedWaNumber(dto.waNumber);
    const rows = savingRows(dto.savings);
    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
          koperasiId,
          nama,
          ...(nik !== undefined ? { nik } : {}),
          ...(waNumber !== undefined ? { waNumber } : {}),
        },
        select: { id: true },
      });
      if (rows.length) {
        await tx.memberSaving.createMany({
          data: rows.map((row) => ({ ...row, memberId: created.id, status: 'UNPAID' })),
        });
      }
      return tx.member.findUniqueOrThrow({
        where: { id: created.id },
        select: MEMBER_MASTER_SELECT,
      });
    });
    await writeWebMutationAudit({
      koperasiId,
      actorId,
      resourceType: WEB_AUDIT_RESOURCE.MEMBER,
      mutation: WEB_AUDIT_MUTATION.CREATE,
      resourceRef: member.id,
      payload: {
        hasNik: Boolean(nik),
        hasWaNumber: Boolean(waNumber),
        savingRows: rows.length,
      },
    });
    return safeMember(member);
  }

  async update(koperasiId: string, actorId: string, memberId: string, dto: UpdateMemberDto) {
    const existing = await prisma.member.findFirst({
      where: { id: memberId, koperasiId },
      select: { id: true, isActive: true },
    });
    if (!existing) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    if (dto.isActive === false) return this.archive(koperasiId, actorId, memberId);

    const data: Prisma.MemberUpdateInput = {};
    if (dto.nama !== undefined) data.nama = normalizedName(dto.nama);
    if (dto.nik !== undefined) data.nik = normalizedNik(dto.nik);
    if (dto.waNumber !== undefined) data.waNumber = normalizedWaNumber(dto.waNumber);
    if (dto.isActive === true) data.isActive = true;
    const member = await prisma.member.update({
      where: { id: memberId },
      data,
      select: MEMBER_MASTER_SELECT,
    });
    const reactivated = !existing.isActive && dto.isActive === true;
    await writeWebMutationAudit({
      koperasiId,
      actorId,
      resourceType: WEB_AUDIT_RESOURCE.MEMBER,
      mutation: reactivated ? WEB_AUDIT_MUTATION.REACTIVATE : WEB_AUDIT_MUTATION.UPDATE,
      resourceRef: member.id,
      payload: {
        changedFields: Object.keys(dto),
        hasReplacementNik: dto.nik !== undefined,
        hasReplacementWaNumber: dto.waNumber !== undefined,
      },
    });
    return safeMember(member);
  }

  async archive(koperasiId: string, actorId: string, memberId: string) {
    const existing = await prisma.member.findFirst({
      where: { id: memberId, koperasiId },
      include: { user: { select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    if (existing.user) throw new ConflictException('MEMBER_HAS_LOGIN');
    if (!existing.isActive) return this.detail(koperasiId, memberId);
    const member = await prisma.member.update({
      where: { id: memberId },
      data: { isActive: false },
      select: MEMBER_MASTER_SELECT,
    });
    await writeWebMutationAudit({
      koperasiId,
      actorId,
      resourceType: WEB_AUDIT_RESOURCE.MEMBER,
      mutation: WEB_AUDIT_MUTATION.ARCHIVE,
      resourceRef: member.id,
      payload: { preservedSavings: member._count.savings },
    });
    return safeMember(member);
  }

  async savings(koperasiId: string, memberId: string) {
    const member = await prisma.member.findFirst({ where: { id: memberId, koperasiId }, select: { id: true, nama: true } });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    return serializeDecimals({ member, savings: await memberSavings(memberId) });
  }

  /** Rapel: bayar beberapa periode UNPAID sekaligus → satu jurnal confirmed + PAID. */
  async pay(koperasiId: string, actorId: string, memberId: string, savingIds: string[]) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, koperasiId },
    });
    if (!member) throw new NotFoundException('ANGGOTA_TIDAK_DITEMUKAN');
    if (!member.isActive) throw new ConflictException('ANGGOTA_DIARSIPKAN');
    const selected = await prisma.memberSaving.findMany({
      where: { id: { in: savingIds }, memberId },
    });
    if (selected.some((saving) => saving.status === 'PAID'))
      throw new ConflictException('SIMPANAN_SUDAH_DIBAYAR');
    const savings = selected.filter((saving) => saving.status === 'UNPAID');
    if (!savings.length) throw new BadRequestException('TIDAK_ADA_PERIODE_UNPAID');
    const types = new Set(savings.map((s) => s.type));
    if (types.size > 1) throw new BadRequestException('CAMPUR_TIPE_SIMPANAN');
    const savingType = savings[0].type as 'POKOK' | 'WAJIB';
    const periods = savings.map((s) => s.period).sort();
    const total = savings.reduce((a, s) => a + Number(s.amount), 0);

    const draft = await paySavingDraft(actorId, { koperasiId, memberId, periods, amount: total, savingType }, 'WEB');
    await confirmEntry(draft.journal.entry.id, koperasiId);
    // markPeriodsPaid = upsert per periode; jurnal sudah CONFIRMED (immutable) — retry supaya
    // kegagalan transien tidak meninggalkan periode UNPAID yang bisa dibayar ganda.
    let markErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await markPeriodsPaid(memberId, savingType, periods, draft.journal.entry.id, Number(savings[0].amount));
        markErr = undefined;
        break;
      } catch (e) {
        markErr = e;
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
    if (markErr)
      throw new InternalServerErrorException(
        `RAPEL_TANDA_PERIODE_GAGAL: jurnal ${draft.journal.entry.nomor} sudah CONFIRMED tapi periode belum tertanda PAID — jangan bayar ulang, tandai manual. (${(markErr as Error).message})`,
      );
    await writeWebMutationAudit({
      koperasiId,
      actorId,
      resourceType: WEB_AUDIT_RESOURCE.MEMBER_SAVING,
      mutation: WEB_AUDIT_MUTATION.PAY,
      resourceRef: memberId,
      payload: { savingType, periods, paid: periods.length, total },
    });
    return { paid: periods.length, total: String(total), journalId: draft.journal.entry.id, nomor: draft.journal.entry.nomor };
  }
}
