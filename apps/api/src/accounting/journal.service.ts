import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  assertBalanced, createDraftFromSimple, createManualDraft, confirmEntry, rejectEntry,
  type PostingLine,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import { CreateSimpleEntryDto } from './dto/create-simple-entry.dto';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

const INCLUDE = { lines: { include: { coa: true } }, businessUnit: true } as const;

@Injectable()
export class JournalService {
  async list(koperasiId: string, q: { month?: string; unitId?: string; status?: string; source?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.JournalEntryWhereInput = { koperasiId };
    if (q.unitId) where.businessUnitId = q.unitId;
    if (q.status === 'DRAFT' || q.status === 'CONFIRMED') where.status = q.status;
    if (q.source === 'WHATSAPP' || q.source === 'WEB' || q.source === 'SEED' || q.source === 'IMPORT') where.sourceChannel = q.source;
    if (q.month) {
      const [y, m] = q.month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    const [rows, total] = await Promise.all([
      prisma.journalEntry.findMany({ where, orderBy: [{ date: 'desc' }, { nomor: 'desc' }], skip, take, include: INCLUDE }),
      prisma.journalEntry.count({ where }),
    ]);
    return { data: serializeDecimals(rows), page, pageSize, total };
  }

  async get(koperasiId: string, id: string) {
    const entry = await prisma.journalEntry.findFirst({ where: { id, koperasiId }, include: INCLUDE });
    if (!entry) throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
    return serializeDecimals(entry);
  }

  async createSimple(koperasiId: string, actorId: string, dto: CreateSimpleEntryDto) {
    const { entry } = await createDraftFromSimple(
      actorId,
      { koperasiId, kind: dto.kind, amount: dto.amount, description: dto.description, businessUnitId: dto.businessUnitId, via: dto.via },
      'WEB',
    );
    return this.get(koperasiId, entry.id);
  }

  async createManual(koperasiId: string, actorId: string, dto: CreateManualJournalDto) {
    if (dto.businessUnitId) {
      const unit = await prisma.businessUnit.findFirst({ where: { id: dto.businessUnitId, koperasiId } });
      if (!unit) throw new BadRequestException('UNIT_TIDAK_DITEMUKAN');
    }
    const entry = await createManualDraft(
      actorId, koperasiId,
      { keterangan: dto.keterangan, referensi: dto.referensi, businessUnitId: dto.businessUnitId },
      dto.lines as PostingLine[],
      'WEB',
    );
    return this.get(koperasiId, entry.id);
  }

  /** PATCH draft: replace header+lines. Guard DRAFT; balance via core.assertBalanced. */
  async updateDraft(koperasiId: string, id: string, dto: CreateManualJournalDto) {
    assertBalanced(dto.lines as PostingLine[]);
    const kodes = [...new Set(dto.lines.map((l) => l.coaKode))];
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({ where: { id, koperasiId } });
      if (!entry) throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
      if (entry.status !== 'DRAFT') throw new ConflictException('JURNAL_TERKONFIRMASI_IMMUTABLE');
      const accounts = await tx.coaAccount.findMany({ where: { koperasiId, kode: { in: kodes }, isActive: true } });
      const byKode = new Map(accounts.map((a) => [a.kode, a.id]));
      const missing = kodes.filter((k) => !byKode.has(k));
      if (missing.length) throw new BadRequestException(`AKUN_COA_HILANG: ${missing.join(',')}`);
      if (dto.businessUnitId) {
        const unit = await tx.businessUnit.findFirst({ where: { id: dto.businessUnitId, koperasiId } });
        if (!unit) throw new BadRequestException('UNIT_TIDAK_DITEMUKAN');
      }
      // Compare-and-swap: re-assert DRAFT di write, bukan cuma di baca awal (TOCTOU).
      // Mirror core confirmEntry() — updateMany(status: DRAFT) ⇒ count !== 1 = sudah dikonfirmasi konkuren.
      const res = await tx.journalEntry.updateMany({
        where: { id, koperasiId, status: 'DRAFT' },
        data: { keterangan: dto.keterangan, referensi: dto.referensi ?? null, businessUnitId: dto.businessUnitId ?? null },
      });
      if (res.count !== 1) throw new ConflictException('JURNAL_TERKONFIRMASI_IMMUTABLE');
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      await tx.journalLine.createMany({
        data: dto.lines.map((l) => ({ entryId: id, coaId: byKode.get(l.coaKode)!, debit: l.debit, kredit: l.kredit })),
      });
      const updated = await tx.journalEntry.findFirst({ where: { id, koperasiId }, include: INCLUDE });
      return serializeDecimals(updated);
    });
  }

  async confirm(koperasiId: string, id: string) {
    await confirmEntry(id, koperasiId); // DomainError NOT_DRAFT → 409 via filter
    return this.get(koperasiId, id);
  }

  async remove(koperasiId: string, id: string) {
    await rejectEntry(id, koperasiId); // NOT_FOUND → 404, IMMUTABLE → 409 via filter
    return { deleted: true };
  }
}
