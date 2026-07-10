import { Injectable } from '@nestjs/common';
import { RegistrationService, RegError, type KoperasiOption } from '../registration/registration.service';
import { InboundMessage } from './gateway';

type Step = 'ASK_ROLE' | 'ASK_KOPERASI' | 'PICK_KOPERASI' | 'ASK_NEW_NAME';

interface Session {
  step: Step;
  role?: 'PENGURUS' | 'ANGGOTA';
  options?: KoperasiOption[];
  touchedAt: number;
}

const SESSION_TTL_MS = 10 * 60_000;

/**
 * Alur DAFTAR via WA (F-DAFTAR). State ringan in-memory per chatJid —
 * restart server = ketik DAFTAR ulang (penyederhanaan yang disengaja; data
 * penting tetap di RegistrationRequest DB).
 */
@Injectable()
export class GuestFlowService {
  private sessions = new Map<string, Session>();

  constructor(private readonly reg: RegistrationService) {}

  private get(chatJid: string): Session | undefined {
    const s = this.sessions.get(chatJid);
    if (s && Date.now() - s.touchedAt > SESSION_TTL_MS) {
      this.sessions.delete(chatJid);
      return undefined;
    }
    return s;
  }

  private set(chatJid: string, s: Omit<Session, 'touchedAt'>) {
    this.sessions.set(chatJid, { ...s, touchedAt: Date.now() });
  }

  /** null = bukan bagian alur DAFTAR (biarkan orchestrator lanjut ke intro/RAG). */
  async handle(m: InboundMessage): Promise<string | null> {
    const text = m.text.trim();
    const session = this.get(m.chatJid);

    if (/^daftar$/i.test(text)) {
      this.set(m.chatJid, { step: 'ASK_ROLE' });
      return `Siap! Kamu mendaftar sebagai apa?
1️⃣ *PENGURUS* koperasi
2️⃣ *ANGGOTA* koperasi
3️⃣ Daftarkan *KOPERASI BARU*
(balas angka atau kata di atas — *BATAL* untuk berhenti)`;
    }

    if (!session) return null;

    if (/^(batal|cancel|gajadi)$/i.test(text)) {
      this.sessions.delete(m.chatJid);
      return '👌 Oke, pendaftaran dibatalkan. Ketik *DAFTAR* kapan saja kalau berubah pikiran.';
    }

    switch (session.step) {
      case 'ASK_ROLE': {
        const lower = text.toLowerCase();
        if (/^(1|pengurus)$/.test(lower) || /^(2|anggota)$/.test(lower)) {
          const role = /^(1|pengurus)$/.test(lower) ? 'PENGURUS' : 'ANGGOTA';
          this.set(m.chatJid, { step: 'ASK_KOPERASI', role });
          return `Oke, ${role.toLowerCase()}. Koperasimu namanya apa? (ketik sebagian nama juga boleh)`;
        }
        if (/^(3|koperasi baru|baru)$/.test(lower)) {
          this.set(m.chatJid, { step: 'ASK_NEW_NAME' });
          return 'Siap! Nama koperasi barunya apa?';
        }
        return 'Balas *1* (pengurus), *2* (anggota), atau *3* (koperasi baru) ya. Atau *BATAL*.';
      }

      case 'ASK_KOPERASI': {
        if (text.length < 3) return 'Ketik minimal 3 huruf nama koperasinya ya.';
        const options = await this.reg.searchKoperasi(text);
        if (options.length === 0)
          return `Hmm, tidak ketemu koperasi dengan nama "${text}". Coba ejaan lain ya. (Kalau koperasimu memang belum terdaftar: *BATAL*, lalu *DAFTAR* ulang dan pilih *3 — koperasi baru*.)`;
        this.set(m.chatJid, { ...session, step: 'PICK_KOPERASI', options });
        return (
          'Ketemu! Pilih nomornya:\n' +
          options.map((o, i) => `${i + 1}. ${o.label}`).join('\n') +
          '\n(balas angka)'
        );
      }

      case 'PICK_KOPERASI': {
        const n = Number(text);
        const opt = session.options?.[n - 1];
        if (!opt) return `Balas angka 1–${session.options?.length ?? 0} ya.`;
        try {
          const { link } = await this.reg.startWaRegistration({
            waNumber: m.senderNumber,
            role: session.role ?? 'ANGGOTA',
            koperasiId: opt.koperasiId,
            koperasiRef: opt.koperasiRef,
          });
          this.sessions.delete(m.chatJid);
          return `👍 Lanjutkan pendaftaran lewat tautan aman ini (isi nama, NIK & password di sana — *jangan kirim NIK lewat chat*):
${link}
Tautan berlaku 15 menit.`;
        } catch (e) {
          this.sessions.delete(m.chatJid);
          if (e instanceof RegError) return e.message;
          throw e;
        }
      }

      case 'ASK_NEW_NAME': {
        if (text.length < 4) return 'Nama koperasinya minimal 4 huruf ya.';
        try {
          const { link } = await this.reg.startNewKoperasiRegistration(m.senderNumber, text);
          this.sessions.delete(m.chatJid);
          return `👍 Siap! Lengkapi data pendaftaran koperasi *${text}* lewat tautan aman ini (jangan kirim NIK lewat chat):
${link}
Tautan berlaku 15 menit. Setelah form terkirim, permohonan menunggu persetujuan admin.`;
        } catch (e) {
          this.sessions.delete(m.chatJid);
          if (e instanceof RegError) return e.message;
          throw e;
        }
      }
    }
  }
}
