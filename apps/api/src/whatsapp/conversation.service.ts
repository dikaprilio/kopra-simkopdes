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
import { GowaClient, InboundMessage } from './gateway';
import { OutboxService } from './outbox.service';
import { DedupService } from './dedup.service';
import { AzureSttService, SttError } from './stt.service';
import { AgentClient, type ActorContext } from './agent-client';
import { GuestFlowService } from './guest-flow';
import { SuperAdminService } from './super-admin';
import { GroupService } from './group.service';

const YA_RE = /^(ya|y|iya|yes|ok|oke|yaa+)$/i;
const BATAL_RE = /^(batal|gajadi|ga jadi|gak jadi|nggak jadi|cancel|tidak)$/i;
/** Token utk cocok YA/BATAL — transkrip STT bertanda baca ("Iya.") tetap dikenali. */
const confirmToken = (s: string) => s.trim().replace(/["'.,!?…]+$/g, '').trim();
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
    private readonly gowa: GowaClient,
    private readonly stt: AzureSttService,
  ) {}

  async onMessage(m: InboundMessage): Promise<void> {
    try {
      // voice note: grup diabaikan (keputusan produk); DM ditranskrip dulu
      let voicePrefix = '';
      if (m.kind === 'voice') {
        if (m.isGroup) {
          await this.dedup.markResult(m.deviceId, m.messageId, 'IGNORED');
          return;
        }
        const transcript = await this.transcribeVoice(m);
        if (transcript === null) {
          await this.dedup.markResult(m.deviceId, m.messageId, 'PROCESSED');
          return; // pesan error sopan sudah di-enqueue
        }
        m.text = transcript;
        voicePrefix = `🎤 *Saya dengar:* "_${transcript}_"\n\n`;
      }
      if (m.isGroup) {
        const result = await this.group.onGroupMessage(m);
        await this.dedup.markResult(m.deviceId, m.messageId, result);
        return;
      }
      if (SuperAdminService.isSuperAdmin(m.senderNumber)) {
        // super-admin = parser deterministik saja (matriks: tanpa PUBLIC_QA)
        const saReply = await this.superAdmin.handle(m.text);
        await this.outbox.enqueue(m.chatJid, voicePrefix + saReply);
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
      if (reply?.trim()) await this.outbox.enqueue(m.chatJid, voicePrefix + reply);
      await this.dedup.markResult(m.deviceId, m.messageId, 'PROCESSED');
    } catch (e) {
      this.logger.error(`onMessage gagal: ${(e as Error).message}`);
      await this.dedup.markResult(m.deviceId, m.messageId, 'ERROR').catch(() => undefined);
      await this.outbox
        .enqueue(m.chatJid, '😔 Maaf, ada gangguan sistem. Coba lagi sebentar ya.')
        .catch(() => undefined);
    }
  }

  /** Unduh VN dari GoWA + transkrip Azure. null = gagal (balasan sopan sudah di-enqueue). */
  private async transcribeVoice(m: InboundMessage): Promise<string | null> {
    try {
      if (!m.audioPath) throw new SttError('API_ERROR', 'audioPath kosong');
      const { buffer, mime } = await this.gowa.fetchMedia(m.audioPath);
      const transcript = await this.stt.transcribe(buffer, mime);
      if (!transcript) {
        await this.outbox.enqueue(
          m.chatJid,
          '🙏 Maaf, suaranya kurang jelas — bisa diulang atau diketik saja?',
        );
        return null;
      }
      return transcript;
    } catch (e) {
      const tooLarge = e instanceof SttError && e.code === 'TOO_LARGE';
      this.logger.warn(`STT gagal (${m.messageId}): ${(e as Error).message}`);
      await this.outbox.enqueue(
        m.chatJid,
        tooLarge
          ? '🙏 Voice note-nya kepanjangan (maks ±2 menit). Bisa dipersingkat atau diketik?'
          : '🙏 Maaf, voice note-nya tidak bisa saya proses sekarang. Bisa diketik saja?',
      );
      return null;
    }
  }

  /** Nomor terdaftar: cek pending dulu (YA/BATAL/koreksi), baru serahkan ke agent. */
  private async linkedFlow(m: InboundMessage, actor: ActorContext): Promise<string> {
    const pending = await getAwaiting(m.chatJid);
    const text = m.text.trim();
    const token = confirmToken(text);

    if (pending) {
      const payload = pending.preview as unknown as PendingPayload;
      if (YA_RE.test(token)) return this.doConfirm(m, actor);
      if (BATAL_RE.test(token)) return this.doCancel(m, actor);
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

    if (YA_RE.test(token) || BATAL_RE.test(token))
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
