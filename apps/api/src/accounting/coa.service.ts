import { ConflictException, Injectable } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { CreateCoaDto } from './dto/create-coa.dto';

@Injectable()
export class CoaService {
  async list(koperasiId: string, tree: boolean) {
    const accounts = await prisma.coaAccount.findMany({ where: { koperasiId }, orderBy: { kode: 'asc' } });
    if (!tree) return accounts;
    type Node = (typeof accounts)[number] & { children: Node[] };
    const byId = new Map<string, Node>(accounts.map((a) => [a.id, { ...a, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async create(koperasiId: string, dto: CreateCoaDto) {
    const exists = await prisma.coaAccount.findUnique({
      where: { koperasiId_kode: { koperasiId, kode: dto.kode } },
    });
    if (exists) throw new ConflictException('KODE_COA_SUDAH_ADA');
    return prisma.coaAccount.create({
      data: { koperasiId, kode: dto.kode, nama: dto.nama, type: dto.type, parentId: dto.parentId ?? null },
    });
  }
}
