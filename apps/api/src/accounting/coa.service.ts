import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  REQUIRED_POSTING_COA_CODES,
  WEB_AUDIT_MUTATION,
  WEB_AUDIT_RESOURCE,
  writeWebMutationAudit,
} from '@kopra/core';
import { parsePage } from '../common/http';
import { CreateCoaDto, UpdateCoaDto } from './dto/create-coa.dto';

const COA_INCLUDE = {
  parent: { select: { id: true, kode: true, nama: true } },
  _count: { select: { children: true, lines: true } },
} satisfies Prisma.CoaAccountInclude;

function normalizedName(value: string): string {
  const result = value?.trim().replace(/\s+/g, ' ');
  if (!result) throw new BadRequestException('NAMA_COA_TIDAK_VALID');
  return result;
}

@Injectable()
export class CoaService {
  async list(koperasiId: string, q: { tree?: string; search?: string; active?: string; page?: string; pageSize?: string }) {
    const where: Prisma.CoaAccountWhereInput = { koperasiId };
    if (q.active !== 'all') where.isActive = q.active === 'false' ? false : true;
    if (q.search?.trim()) {
      where.OR = [
        { kode: { contains: q.search.trim() } },
        { nama: { contains: q.search.trim(), mode: 'insensitive' } },
      ];
    }
    const accounts = await prisma.coaAccount.findMany({ where, orderBy: [{ kode: 'asc' }, { id: 'asc' }] });
    if (q.tree === 'true') {
      type Node = (typeof accounts)[number] & { children: Node[] };
      const byId = new Map<string, Node>(accounts.map((account) => [account.id, { ...account, children: [] }]));
      const roots: Node[] = [];
      for (const node of byId.values()) {
        if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
        else roots.push(node);
      }
      return roots;
    }
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    return { data: accounts.slice(skip, skip + take), page, pageSize, total: accounts.length };
  }

  async detail(koperasiId: string, id: string) {
    const account = await prisma.coaAccount.findFirst({ where: { id, koperasiId }, include: COA_INCLUDE });
    if (!account) throw new NotFoundException('COA_TIDAK_DITEMUKAN');
    return account;
  }

  private async validateParent(koperasiId: string, accountId: string | undefined, parentId: string | null) {
    if (!parentId) return;
    const parent = await prisma.coaAccount.findFirst({ where: { id: parentId, koperasiId } });
    if (!parent || !parent.isActive) throw new BadRequestException('AKUN_INDUK_TIDAK_VALID');
    if (parentId === accountId) throw new BadRequestException('SIKLUS_AKUN_TIDAK_VALID');
    let cursor = parent.parentId;
    while (cursor) {
      if (cursor === accountId) throw new BadRequestException('SIKLUS_AKUN_TIDAK_VALID');
      const ancestor = await prisma.coaAccount.findFirst({
        where: { id: cursor, koperasiId }, select: { parentId: true },
      });
      cursor = ancestor?.parentId ?? null;
    }
  }

  async create(koperasiId: string, actorId: string, dto: CreateCoaDto) {
    const nama = normalizedName(dto.nama);
    const exists = await prisma.coaAccount.findUnique({
      where: { koperasiId_kode: { koperasiId, kode: dto.kode } },
    });
    if (exists) throw new ConflictException('KODE_COA_SUDAH_ADA');
    await this.validateParent(koperasiId, undefined, dto.parentId ?? null);
    const account = await prisma.coaAccount.create({
      data: { koperasiId, kode: dto.kode, nama, type: dto.type, parentId: dto.parentId ?? null },
    });
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.COA,
      mutation: WEB_AUDIT_MUTATION.CREATE, resourceRef: account.id,
      payload: { kode: account.kode, type: account.type, hasParent: Boolean(account.parentId) },
    });
    return account;
  }

  async update(koperasiId: string, actorId: string, id: string, dto: UpdateCoaDto) {
    const existing = await prisma.coaAccount.findFirst({ where: { id, koperasiId } });
    if (!existing) throw new NotFoundException('COA_TIDAK_DITEMUKAN');
    if (dto.isActive === false) return this.archive(koperasiId, actorId, id);
    if (dto.parentId !== undefined) await this.validateParent(koperasiId, id, dto.parentId);
    if ((dto.kode !== undefined && dto.kode !== existing.kode) || (dto.type !== undefined && dto.type !== existing.type)) {
      if (await prisma.journalLine.count({ where: { coaId: id } }))
        throw new ConflictException('COA_SUDAH_DIGUNAKAN');
    }
    if (dto.kode !== undefined && dto.kode !== existing.kode) {
      const duplicate = await prisma.coaAccount.findUnique({
        where: { koperasiId_kode: { koperasiId, kode: dto.kode } }, select: { id: true },
      });
      if (duplicate) throw new ConflictException('KODE_COA_SUDAH_ADA');
    }
    const data: Prisma.CoaAccountUpdateInput = {};
    if (dto.kode !== undefined) data.kode = dto.kode;
    if (dto.nama !== undefined) data.nama = normalizedName(dto.nama);
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.parentId !== undefined) data.parent = dto.parentId ? { connect: { id: dto.parentId } } : { disconnect: true };
    if (dto.isActive === true) data.isActive = true;
    const account = await prisma.coaAccount.update({ where: { id }, data });
    const mutation = !existing.isActive && dto.isActive === true
      ? WEB_AUDIT_MUTATION.REACTIVATE : WEB_AUDIT_MUTATION.UPDATE;
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.COA,
      mutation, resourceRef: id, payload: { changedFields: Object.keys(dto) },
    });
    return account;
  }

  async archive(koperasiId: string, actorId: string, id: string) {
    const existing = await prisma.coaAccount.findFirst({
      where: { id, koperasiId }, include: { revenueForUnit: true },
    });
    if (!existing) throw new NotFoundException('COA_TIDAK_DITEMUKAN');
    if (REQUIRED_POSTING_COA_CODES.includes(existing.kode as never) || existing.revenueForUnit)
      throw new ConflictException('COA_REQUIRED_FOR_POSTING');
    if (await prisma.coaAccount.count({ where: { parentId: id, isActive: true } }))
      throw new ConflictException('COA_MEMILIKI_ANAK_AKTIF');
    if (!existing.isActive) return this.detail(koperasiId, id);
    const account = await prisma.coaAccount.update({ where: { id }, data: { isActive: false } });
    await writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.COA,
      mutation: WEB_AUDIT_MUTATION.ARCHIVE, resourceRef: id,
      payload: { preservedLines: await prisma.journalLine.count({ where: { coaId: id } }) },
    });
    return account;
  }
}
