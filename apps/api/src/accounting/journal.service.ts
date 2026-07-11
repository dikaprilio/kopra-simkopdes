import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@kopra/db';
import {
  DomainError, WEB_AUDIT_MUTATION, WEB_AUDIT_RESOURCE, activeBusinessUnitScope,
  assertBalanced, createDraftFromSimple, createManualDraft, createReversalDraft, confirmEntry,
  rejectEntry, writeWebMutationAudit,
  type PostingLine,
} from '@kopra/core';
import { parsePage, serializeDecimals } from '../common/http';
import { CreateSimpleEntryDto } from './dto/create-simple-entry.dto';
import { CreateManualJournalDto, ReverseJournalDto } from './dto/create-manual-journal.dto';

const INCLUDE = { lines: { include: { coa: true } }, businessUnit: true } as const;

@Injectable()
export class JournalService {
  async list(koperasiId: string, q: { month?: string; from?: string; to?: string; search?: string; unitId?: string; status?: string; source?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = parsePage(q.page, q.pageSize);
    const where: Prisma.JournalEntryWhereInput = { koperasiId };
    if (q.unitId) where.businessUnitId = q.unitId;
    if (q.status === 'DRAFT' || q.status === 'CONFIRMED') where.status = q.status;
    if (q.source === 'WHATSAPP' || q.source === 'WEB' || q.source === 'SEED' || q.source === 'IMPORT') where.sourceChannel = q.source;
    if (q.search?.trim()) {
      const search = q.search.trim();
      where.OR = [
        { nomor: { contains: search, mode: 'insensitive' } },
        { keterangan: { contains: search, mode: 'insensitive' } },
        { referensi: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (q.month) {
      const [y, m] = q.month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    } else if (q.from || q.to) {
      const date: Prisma.DateTimeFilter = {};
      if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
      if (q.to) {
        const exclusive = new Date(`${q.to}T00:00:00.000Z`);
        exclusive.setUTCDate(exclusive.getUTCDate() + 1);
        date.lt = exclusive;
      }
      where.date = date;
    }
    const [rows, total] = await Promise.all([
      prisma.journalEntry.findMany({ where, orderBy: [{ date: 'desc' }, { nomor: 'desc' }, { id: 'desc' }], skip, take, include: INCLUDE }),
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
    if (dto.kind !== 'INCOME' && dto.kind !== 'EXPENSE')
      throw new BadRequestException('JENIS_JURNAL_SEDERHANA_TIDAK_VALID');
    const { entry } = await createDraftFromSimple(
      actorId,
      { koperasiId, kind: dto.kind, amount: dto.amount, description: dto.description, businessUnitId: dto.businessUnitId, via: dto.via, date: dto.date ? new Date(dto.date) : undefined },
      'WEB',
    );
    await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.CREATE, entry.id, { kind: dto.kind });
    return this.get(koperasiId, entry.id);
  }

  async createManual(koperasiId: string, actorId: string, dto: CreateManualJournalDto) {
    if (dto.businessUnitId) {
      const unit = await prisma.businessUnit.findFirst({
        where: { id: dto.businessUnitId, ...activeBusinessUnitScope(koperasiId) },
      });
      if (!unit) throw new BadRequestException('UNIT_TIDAK_DITEMUKAN');
    }
    const entry = await createManualDraft(
      actorId, koperasiId,
      { keterangan: dto.keterangan, referensi: dto.referensi, businessUnitId: dto.businessUnitId, date: dto.date ? new Date(dto.date) : undefined },
      dto.lines as PostingLine[],
      'WEB',
    );
    await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.CREATE, entry.id, { kind: 'MANUAL' });
    return this.get(koperasiId, entry.id);
  }

  /** PATCH draft: replace header+lines. Guard DRAFT; balance via core.assertBalanced. */
  async updateDraft(koperasiId: string, actorId: string, id: string, dto: CreateManualJournalDto) {
    assertBalanced(dto.lines as PostingLine[]);
    const kodes = [...new Set(dto.lines.map((l) => l.coaKode))];
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({ where: { id, koperasiId } });
      if (!entry) throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
      if (entry.status !== 'DRAFT') throw new ConflictException('JURNAL_TERKONFIRMASI_IMMUTABLE');
      const accounts = await tx.coaAccount.findMany({ where: { koperasiId, kode: { in: kodes }, isActive: true } });
      const byKode = new Map(accounts.map((a) => [a.kode, a.id]));
      const missing = kodes.filter((k) => !byKode.has(k));
      if (missing.length) throw new BadRequestException(`AKUN_COA_HILANG: ${missing.join(',')}`);
      if (dto.businessUnitId) {
        const unit = await tx.businessUnit.findFirst({
          where: { id: dto.businessUnitId, ...activeBusinessUnitScope(koperasiId) },
        });
        if (!unit) throw new BadRequestException('UNIT_TIDAK_DITEMUKAN');
      }
      // Compare-and-swap: re-assert DRAFT di write, bukan cuma di baca awal (TOCTOU).
      // Mirror core confirmEntry() — updateMany(status: DRAFT) ⇒ count !== 1 = sudah dikonfirmasi konkuren.
      const res = await tx.journalEntry.updateMany({
        where: { id, koperasiId, status: 'DRAFT' },
        data: {
          keterangan: dto.keterangan,
          referensi: dto.referensi ?? null,
          businessUnitId: dto.businessUnitId ?? null,
          ...(dto.date ? { date: new Date(dto.date) } : {}),
        },
      });
      if (res.count !== 1) throw new ConflictException('JURNAL_TERKONFIRMASI_IMMUTABLE');
      await tx.journalLine.deleteMany({ where: { entryId: id } });
      await tx.journalLine.createMany({
        data: dto.lines.map((l) => ({
          entryId: id, coaId: byKode.get(l.coaKode)!, debit: l.debit, kredit: l.kredit,
          catatan: l.catatan,
        })),
      });
      const updated = await tx.journalEntry.findFirst({ where: { id, koperasiId }, include: INCLUDE });
      return serializeDecimals(updated);
    });
    await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.UPDATE, id, { replacedLines: dto.lines.length });
    return updated;
  }

  async confirm(koperasiId: string, actorId: string, id: string) {
    await confirmEntry(id, koperasiId); // DomainError NOT_DRAFT → 409 via filter
    await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.CONFIRM, id);
    return this.get(koperasiId, id);
  }

  async remove(koperasiId: string, actorId: string, id: string) {
    await rejectEntry(id, koperasiId); // NOT_FOUND → 404, IMMUTABLE → 409 via filter
    await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.DELETE, id);
    return { deleted: true };
  }

  async reverse(koperasiId: string, actorId: string, id: string, dto: ReverseJournalDto) {
    try {
      const reversal = await createReversalDraft(actorId, koperasiId, id, {
        date: dto.date ? new Date(dto.date) : undefined,
        keterangan: dto.keterangan,
      });
      await this.audit(koperasiId, actorId, WEB_AUDIT_MUTATION.REVERSE, reversal.id, { reversalOfId: id });
      return this.get(koperasiId, reversal.id);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      if (error.code === 'JOURNAL_NOT_FOUND') throw new NotFoundException('JURNAL_TIDAK_DITEMUKAN');
      const messages: Record<string, string> = {
        REVERSAL_EXISTS: 'REVERSAL_EXISTS',
        REVERSAL_CHAIN: 'REVERSAL_CHAIN',
        JOURNAL_NOT_CONFIRMED: 'JOURNAL_NOT_CONFIRMED',
        STOCK_LINKED_REVERSAL: 'JURNAL_STOK_GUNAKAN_KOREKSI_STOK',
      };
      throw new ConflictException(messages[error.code] ?? error.code);
    }
  }

  private audit(
    koperasiId: string,
    actorId: string,
    mutation: (typeof WEB_AUDIT_MUTATION)[keyof typeof WEB_AUDIT_MUTATION],
    resourceRef: string,
    payload?: unknown,
  ) {
    return writeWebMutationAudit({
      koperasiId, actorId, resourceType: WEB_AUDIT_RESOURCE.JOURNAL,
      mutation, resourceRef, payload,
    });
  }
}
