import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@kopra/db';
import {
  DomainError,
  cancelPending,
  confirmPending,
  getAwaiting,
  writeAudit,
  type PendingPayload,
} from '@kopra/core';
import { InboundMessage } from './gateway';
import { OutboxService } from './outbox.service';
import { DedupService } from './dedup.service';
import { AgentClient, type ActorContext } from './agent-client';
import { GuestFlowService } from './guest-flow';
import { SuperAdminService } from './super-admin';
import { GroupService } from './group.service';

const YA_RE = /^(ya|y|iya|yes|ok|oke|yaa+)$/i;
const BATAL_RE = /^(batal|gajadi|ga jadi|gak jadi|nggak jadi|cancel|tidak)$/i;
const SAPAAN_RE = /^(halo|hai|hi|hei|hallo|assalamualaikum|selamat (pagi|siang|sore|malam)|p|tes|test|ping)[.!? ]*$/i;

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');

const INTRO_GUEST = `Halo! 👋 Saya *Kopra*, asisten digital Koperasi Merah Putih.
Saya bisa bantu jawab pertanyaan seputar koperasi (aturan, simpanan, SHU, RAT, cara pakai aplikasi koperasi).
Nomor kamu belum terhubung ke koperasi mana pun.
👉 Ketik *DAFTAR* untuk menghubungkan akun, atau langsung tanya saja.`;

/**
 * Orchestrator DM — state machine deterministik (bukan LLM):
 * YA/BATAL/koreksi diputuskan regex + PendingAction di DB (restart-safe).
 * LLM (agent kopra) hanya untuk intent-extraction, Q&A, dan pembuatan draft via tools.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly dedup: DedupService,
    private readonly agent: AgentClient,
    private readonly guestReg: GuestFlowService,
    private readonly superAdmin: SuperAdminService,
    private readonly group: GroupService,
  ) {}

  async onMessage(m: InboundMessage): Promise<void> {
    try {
      if (m.isGroup) {
        const result = await this.group.onGroupMessage(m);
        await this.dedup.markResult(m.deviceId, m.messageId, result);
        return;
      }
      if (SuperAdminService.isSuperAdmin(m.senderNumber)) {
        // super-admin = parser deterministik saja (matriks: tanpa PUBLIC_QA)
        const saReply = await this.superAdmin.handle(m.text);
        await this.outbox.enqueue(m.chatJid, saReply);
        await this.dedup.markResult(m.deviceId, m.messageId, 'PROCESSED');
        return;
      }
      const identity = await prisma.whatsappIdentity.findUnique({
        where: { waNumber: m.senderNumber },
        include: { user: true, koperasi: { select: { nama: true } } },
      });
      const reply = identity
        ? await this.linkedFlow(m, {
            role: identity.user.role,
            channel: 'DM',
            actorId: identity.userId,
            koperasiId: identity.koperasiId,
            koperasiNama: identity.koperasi.nama,
            chatJid: m.chatJid,
            memberId: identity.user.memberId ?? undefined,
          })
        : await this.guestFlow(m);
      if (reply) await this.outbox.enqueue(m.chatJid, reply);
      await this.dedup.markResult(m.deviceId, m.messageId, 'PROCESSED');
    } catch (e) {
      this.logger.error(`onMessage gagal: ${(e as Error).message}`);
      await this.dedup.markResult(m.deviceId, m.messageId, 'ERROR').catch(() => undefined);
      await this.outbox
        .enqueue(m.chatJid, '😔 Maaf, ada gangguan sistem. Coba lagi sebentar ya.')
        .catch(() => undefined);
    }
  }

  /** Nomor terdaftar: cek pending dulu (YA/BATAL/koreksi), baru serahkan ke agent. */
  private async linkedFlow(m: InboundMessage, actor: ActorContext): Promise<string> {
    const pending = await getAwaiting(m.chatJid);
    const text = m.text.trim();

    if (pending) {
      const payload = pending.preview as unknown as PendingPayload;
      if (YA_RE.test(text)) return this.doConfirm(m, actor);
      if (BATAL_RE.test(text)) return this.doCancel(m, actor);
      // koreksi: buang draft lama, minta agent buat draft baru berbekal preview lama
      try {
        await cancelPending(m.chatJid, actor.actorId!);
      } catch (e) {
        if (e instanceof DomainError && e.code === 'WRONG_ACTOR')
          return '⏳ Ada draft milik pengguna lain yang masih menunggu. Coba lagi sebentar ya.';
        throw e;
      }
      const prompt =
        `Draft sebelumnya (sudah dibatalkan, buat ulang):\n${payload.previewText}\n\n` +
        `User mengoreksi: "${text}"\n` +
        `Buat draft BARU yang sudah menerapkan koreksi itu (panggil tool draft yang sesuai), lalu tampilkan previewText-nya.`;
      return this.agent.ask(prompt, actor);
    }

    if (YA_RE.test(text) || BATAL_RE.test(text))
      return 'Tidak ada draft yang menunggu konfirmasi. Ada yang mau dicatat atau ditanyakan? 😊';

    return this.agent.ask(text, actor);
  }

  private async doConfirm(m: InboundMessage, actor: ActorContext): Promise<string> {
    try {
      const pending = await getAwaiting(m.chatJid);
      const via = (pending?.preview as unknown as PendingPayload | null)?.via ?? 'KAS';
      const res = await confirmPending(m.chatJid, actor.actorId!);
      await writeAudit({
        koperasiId: actor.koperasiId,
        actorId: actor.actorId,
        channel: 'DM',
        action: 'pending.confirm',
        resourceType: 'PendingAction',
        resourceRef: res.nomorJurnal,
        result: 'OK',
      });
      const saldoLabel = via === 'BANK' ? 'Bank' : 'Kas';
      const lines = ['✅ Tersimpan!'];
      if (res.nomorJurnal) lines[0] = `✅ Tersimpan! No. jurnal *${res.nomorJurnal}*.`;
      lines.push(`Saldo ${saldoLabel} sekarang: *${rp(res.saldoKas)}*.`);
      return lines.join('\n');
    } catch (e) {
      if (e instanceof DomainError) return e.message;
      throw e;
    }
  }

  private async doCancel(m: InboundMessage, actor: ActorContext): Promise<string> {
    try {
      await cancelPending(m.chatJid, actor.actorId!);
      await writeAudit({
        koperasiId: actor.koperasiId,
        actorId: actor.actorId,
        channel: 'DM',
        action: 'pending.cancel',
        result: 'OK',
      });
      return '👌 Oke, draft dibatalkan. Tidak ada yang tersimpan.';
    } catch (e) {
      if (e instanceof DomainError) return e.message;
      throw e;
    }
  }

  /** Nomor asing: alur DAFTAR (M6) > intro sekali > Q&A publik (RAG). */
  private async guestFlow(m: InboundMessage): Promise<string> {
    const text = m.text.trim();
    const regReply = await this.guestReg.handle(m);
    if (regReply) return regReply;
    const pernahDisapa = await prisma.outboundWhatsappMessage.count({
      where: { toJid: m.chatJid },
    });
    if (pernahDisapa === 0 && SAPAAN_RE.test(text)) return INTRO_GUEST;
    const answer = await this.agent.ask(text, { role: 'GUEST', channel: 'DM', chatJid: m.chatJid });
    return pernahDisapa === 0
      ? `${answer}\n\n👉 Ketik *DAFTAR* kalau mau menghubungkan akun ke koperasimu.`
      : answer;
  }
}
