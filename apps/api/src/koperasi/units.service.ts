import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  UNIT_REVENUE_NAME_PREFIX,
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  nextUnitRevenueCode,
  writeWebMutationAudit,
} from '@kopra/core';
import { parsePage } from '../common/http';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

const UNIT_INCLUDE = {
  revenueCoa: { select: { id: true, kode: true, nama: true, type: true, isActive: true } },
} satisfies Prisma.BusinessUnitInclude;

function normalizedName(value: string): string {
  const result = value?.trim().replace(/\s+/g, ' ');
  if (!result) throw new BadRequestException('NAMA_UNIT_USAHA_TIDAK_VALID');
  return result;
}

@Injectable()
export class UnitsService {
  async list(koperasiId: string, q: { search?: string; active?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.BusinessUnitWhereInput = { koperasiId };
    if (q.active !== 'all') where.isActive = q.active === 'false' ? false : true;
    if (q.search?.trim()) where.nama = { contains: q.search.trim(), mode: 'insensitive' };
    const [data, total] = await Promise.all([
      prisma.businessUnit.findMany({
        where, orderBy: [{ nama: 'asc' }, { id: 'asc' }], skip, take, include: UNIT_INCLUDE,
      }),
      prisma.businessUnit.count({ where }),
    ]);
    return { data, page, pageSize, total };
  }

  async detail(koperasiId: string, id: string) {
    const unit = await prisma.businessUnit.findFirst({
      where: { id, koperasiId }, include: UNIT_INCLUDE,
    });
    if (!unit) throw new NotFoundException('UNIT_USAHA_TIDAK_DITEMUKAN');
    return unit;
  }

  async create(koperasiId: string, actorId: string, dto: CreateUnitDto) {
    const nama = normalizedName(dto.nama);
    if (await prisma.businessUnit.findUnique({ where: { koperasiId_nama: { koperasiId, nama } } }))
      throw new ConflictException('UNIT_USAHA_SUDAH_ADA');
    const unit = await prisma.$transaction(async (tx) => {
      const kode = await nextUnitRevenueCode(tx, koperasiId);
      const revenueCoa = await tx.coaAccount.create({
        data: { koperasiId, kode, nama: `${UNIT_REVENUE_NAME_PREFIX}${nama}`, type: 'REVENUE' },
      });
      return tx.businessUnit.create({
        data: { koperasiId, nama, revenueCoaId: revenueCoa.id }, include: UNIT_INCLUDE,
      });
    });
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.BUSINESS_UNIT,
      mutation: WEB_AUDIT_MUTATION.CREATE, resourceRef: unit.id,
      payload: { revenueCoaId: unit.revenueCoaId, revenueCode: unit.revenueCoa?.kode },
    });
    return unit;
  }

  async update(koperasiId: string, actorId: string, id: string, dto: UpdateUnitDto) {
    const existing = await prisma.businessUnit.findFirst({
      where: { id, koperasiId }, include: UNIT_INCLUDE,
    });
    if (!existing) throw new NotFoundException('UNIT_USAHA_TIDAK_DITEMUKAN');
    if (dto.isActive === false) return this.archive(koperasiId, actorId, id);
    const nama = dto.nama === undefined ? undefined : normalizedName(dto.nama);
    if (nama && nama !== existing.nama) {
      const duplicate = await prisma.businessUnit.findUnique({
        where: { koperasiId_nama: { koperasiId, nama } }, select: { id: true },
      });
      if (duplicate) throw new ConflictException('UNIT_USAHA_SUDAH_ADA');
    }
    const reactivated = !existing.isActive && dto.isActive === true;
    const unit = await prisma.$transaction(async (tx) => {
      if (existing.revenueCoaId && (nama !== undefined || reactivated)) {
        await tx.coaAccount.update({
          where: { id: existing.revenueCoaId },
          data: {
            ...(nama !== undefined ? { nama: `${UNIT_REVENUE_NAME_PREFIX}${nama}` } : {}),
            ...(reactivated ? { isActive: true } : {}),
          },
        });
      }
      return tx.businessUnit.update({
        where: { id },
        data: {
          ...(nama !== undefined ? { nama } : {}),
          ...(dto.isActive === true ? { isActive: true } : {}),
        },
        include: UNIT_INCLUDE,
      });
    });
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.BUSINESS_UNIT,
      mutation: reactivated ? WEB_AUDIT_MUTATION.REACTIVATE : WEB_AUDIT_MUTATION.UPDATE,
      resourceRef: id, payload: { changedFields: Object.keys(dto) },
    });
    return unit;
  }

  async archive(koperasiId: string, actorId: string, id: string) {
    const existing = await prisma.businessUnit.findFirst({ where: { id, koperasiId } });
    if (!existing) throw new NotFoundException('UNIT_USAHA_TIDAK_DITEMUKAN');
    if (!existing.isActive) return this.detail(koperasiId, id);
    const unit = await prisma.$transaction(async (tx) => {
      if (existing.revenueCoaId)
        await tx.coaAccount.update({ where: { id: existing.revenueCoaId }, data: { isActive: false } });
      return tx.businessUnit.update({
        where: { id }, data: { isActive: false }, include: UNIT_INCLUDE,
      });
    });
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.BUSINESS_UNIT,
      mutation: WEB_AUDIT_MUTATION.ARCHIVE, resourceRef: id,
      payload: { revenueCoaId: existing.revenueCoaId },
    });
    return unit;
  }
}
