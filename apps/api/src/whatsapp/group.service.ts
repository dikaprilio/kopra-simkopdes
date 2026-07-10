import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { writeAudit } from '@kopra/core';
import { GowaClient, InboundMessage } from './gateway';
import { OutboxService } from './outbox.service';
import { AgentClient } from './agent-client';

const KEEP_LAST = 50;
const KEEP_HOURS = 24;
const CONTEXT_MSGS = 20;

/**
 * Grup (F-GRUP): baca semua pesan (konteks bounded 50/24 jam), balas HANYA saat
 * di-mention. Resolusi grup→koperasi via scan participant; write SELALU ditolak
 * (matriks akses — gate ada di policy + instruksi agent, tanpa PendingAction).
 */
@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    private readonly gowa: GowaClient,
    private readonly outbox: OutboxService,
    private readonly agent: AgentClient,
  ) {}

  /** Deteksi mention deterministik: "@Kopra" / "@<nomor bot>" (fallback per notes-gowa). */
  static isMention(text: string): boolean {
    if (/@kopra\b/i.test(text)) return true;
    const bot = process.env.WA_BOT_NUMBER;
    return !!bot && text.includes(`@${bot}`);
  }

  static stripMention(text: string): string {
    const bot = process.env.WA_BOT_NUMBER;
    return text
      .replace(/@kopra\b/gi, '')
      .replace(bot ? `@${bot}` : '', '')
      .trim();
  }

  async onGroupMessage(m: InboundMessage): Promise<'PROCESSED' | 'IGNORED'> {
    const mentioned = GroupService.isMention(m.text);
    let group = await prisma.waGroup.upsert({
      where: { groupJid: m.chatJid },
      update: {},
      create: { groupJid: m.chatJid },
    });
    await this.store(m, mentioned);

    // grup baru / belum terikat → coba resolusi otomatis via participant scan
    if (group.status === 'UNRESOLVED') {
      const bound = await this.tryAutoBind(group.id, m.chatJid);
      if (bound) {
        group = bound.group;
        await this.outbox.enqueue(
          m.chatJid,
          `👋 Halo semua! Saya Kopra. Grup ini saya kenali sebagai grup *${bound.koperasiNama}* (${bound.terdaftar} anggota terdaftar).\nMention saya (@Kopra) kalau butuh: cek stok, info koperasi, atau tanya aturan koperasi. Untuk CATAT transaksi, japri saya ya 😊`,
        );
      }
    }

    if (!mentioned) return 'IGNORED'; // diam — hanya menyimpan konteks

    const identity = await prisma.whatsappIdentity.findUnique({
      where: { waNumber: m.senderNumber },
      include: { user: true, koperasi: { select: { id: true, nama: true } } },
    });

    // masih UNRESOLVED → binding manual: user terdaftar mention + sebut nama koperasinya
    if (group.status === 'UNRESOLVED') {
      if (identity && this.textMentionsKoperasi(m.text, identity.koperasi.nama)) {
        await prisma.waGroup.update({
          where: { id: group.id },
          data: { status: 'ATTACHED', koperasiId: identity.koperasiId, boundByUserId: identity.userId },
        });
        await writeAudit({
          koperasiId: identity.koperasiId,
          actorId: identity.userId,
          channel: 'GROUP',
          action: 'group.bind_manual',
          resourceRef: m.chatJid,
          result: 'OK',
        });
        await this.outbox.enqueue(
          m.chatJid,
          `✅ Siap! Grup ini sekarang terhubung ke *${identity.koperasi.nama}*. Mention saya (@Kopra) kalau butuh apa-apa 😊`,
        );
        return 'PROCESSED';
      }
      await this.outbox.enqueue(
        m.chatJid,
        `Grup ini belum terhubung ke koperasi. Pengurus/anggota terdaftar: mention saya (@Kopra) + sebut nama koperasimu ya. (Grup hanya bisa dihubungkan ke koperasi si penjawab.)`,
      );
      return 'PROCESSED';
    }

    // ATTACHED → jawab via agent, ctx GROUP + konteks percakapan bounded
    const history = await prisma.waGroupMessage.findMany({
      where: { groupJid: m.chatJid },
      orderBy: { createdAt: 'desc' },
      take: CONTEXT_MSGS + 1, // termasuk pesan barusan
    });
    const context = history
      .slice(1) // buang pesan yang sedang dijawab
      .reverse()
      .map((h) => `${h.sender}: ${h.text}`)
      .join('\n');
    const question = GroupService.stripMention(m.text);
    const prompt = context
      ? `Konteks percakapan grup terakhir:\n${context}\n\nPertanyaan (dari ${m.fromName ?? m.senderNumber}): ${question}`
      : question;

    const reply = await this.agent.ask(prompt, {
      role: identity?.user.role ?? 'GUEST',
      channel: 'GROUP',
      actorId: identity?.userId,
      koperasiId: group.koperasiId ?? undefined,
      chatJid: m.chatJid,
      memberId: identity?.user.memberId ?? undefined,
    });
    await this.outbox.enqueue(m.chatJid, reply);
    return 'PROCESSED';
  }

  /** Simpan pesan + prune (50 terbaru / 24 jam). */
  private async store(m: InboundMessage, mentioned: boolean) {
    await prisma.waGroupMessage.create({
      data: { groupJid: m.chatJid, sender: m.senderNumber, text: m.text, mentioned },
    });
    const cutoff = new Date(Date.now() - KEEP_HOURS * 3600_000);
    await prisma.waGroupMessage.deleteMany({
      where: { groupJid: m.chatJid, createdAt: { lt: cutoff } },
    });
    const overflow = await prisma.waGroupMessage.findMany({
      where: { groupJid: m.chatJid },
      orderBy: { createdAt: 'desc' },
      skip: KEEP_LAST,
      select: { id: true },
    });
    if (overflow.length)
      await prisma.waGroupMessage.deleteMany({ where: { id: { in: overflow.map((o) => o.id) } } });
  }

  /** Scan participant → identities ACTIVE → tepat 1 koperasi = ATTACH otomatis. */
  private async tryAutoBind(groupId: string, groupJid: string) {
    let numbers: string[];
    try {
      numbers = await this.gowa.getGroupParticipants(groupJid);
    } catch (e) {
      this.logger.warn(`participant scan gagal (${groupJid}): ${(e as Error).message}`);
      return null;
    }
    if (!numbers.length) return null;
    const identities = await prisma.whatsappIdentity.findMany({
      where: { waNumber: { in: numbers } },
      include: { koperasi: { select: { nama: true } } },
    });
    const byKoperasi = new Set(identities.map((i) => i.koperasiId));
    if (byKoperasi.size !== 1) {
      await prisma.waGroup.update({ where: { id: groupId }, data: { lastParticipantsAt: new Date() } });
      return null; // 0 atau multi → UNRESOLVED (tanya saat mention)
    }
    const koperasiId = identities[0].koperasiId;
    const group = await prisma.waGroup.update({
      where: { id: groupId },
      data: { status: 'ATTACHED', koperasiId, lastParticipantsAt: new Date() },
    });
    await writeAudit({
      koperasiId,
      channel: 'GROUP',
      action: 'group.bind_auto',
      resourceRef: groupJid,
      result: 'OK',
      payload: { terdaftar: identities.length },
    });
    return { group, koperasiNama: identities[0].koperasi.nama, terdaftar: identities.length };
  }

  /** ≥1 kata (≥4 huruf) dari nama koperasi muncul di teks mention. */
  private textMentionsKoperasi(text: string, koperasiNama: string): boolean {
    const t = text.toLowerCase();
    return koperasiNama
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !['koperasi', 'desa', 'merah', 'putih', 'kelurahan', 'kalurahan'].includes(w))
      .some((w) => t.includes(w));
  }
}
