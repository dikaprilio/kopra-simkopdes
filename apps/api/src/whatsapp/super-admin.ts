import { Injectable } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { writeAudit } from '@kopra/core';
import { RegistrationService, RegError, maskNik } from '../registration/registration.service';

const usia = (d: Date) => {
  const menit = Math.round((Date.now() - d.getTime()) / 60_000);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.round(menit / 60);
  return jam < 24 ? `${jam} jam lalu` : `${Math.round(jam / 24)} hari lalu`;
};

/**
 * Parser deterministik perintah super-admin (F-SUPERADMIN) — TANPA LLM.
 * Hanya dipanggil bila pengirim === SUPER_ADMIN_WA_NUMBER.
 */
@Injectable()
export class SuperAdminService {
  constructor(private readonly reg: RegistrationService) {}

  static isSuperAdmin(senderNumber: string): boolean {
    const sa = process.env.SUPER_ADMIN_WA_NUMBER ?? '';
    return sa !== '' && senderNumber === sa;
  }

  async handle(text: string): Promise<string> {
    const t = text.trim();
    try {
      if (/^permohonan$/i.test(t)) return await this.list();

      const detail = t.match(/^detail\s+(R-\d+)$/i);
      if (detail) return await this.detail(detail[1].toUpperCase());

      const setuju = t.match(/^setujui\s+(R-\d+)(?:\s+(\S+))?$/i);
      if (setuju) {
        const reply = await this.reg.approve(setuju[1].toUpperCase(), setuju[2]);
        await this.audit('super_admin.approve', setuju[1]);
        return reply;
      }

      const tolak = t.match(/^tolak\s+(R-\d+)(?:\s+(.+))?$/i);
      if (tolak) {
        const reply = await this.reg.reject(tolak[1].toUpperCase(), tolak[2] ?? '');
        await this.audit('super_admin.reject', tolak[1]);
        return reply;
      }

      const peran = t.match(/^peran\s+(\d{8,15})\s+(ANGGOTA|PENGURUS|OWNER)$/i);
      if (peran) return await this.setRole(peran[1], peran[2].toUpperCase() as 'ANGGOTA' | 'PENGURUS' | 'OWNER');

      return `Perintah super-admin:
• *PERMOHONAN* — daftar permohonan menunggu
• *DETAIL R-001* — rincian + kandidat data resmi
• *SETUJUI R-001 [ref]* — setujui (opsional tautkan kandidat)
• *TOLAK R-001 <alasan>* — tolak
• *PERAN <nomorWA> <ANGGOTA|PENGURUS|OWNER>* — ubah peran user`;
    } catch (e) {
      if (e instanceof RegError) return `⚠️ ${e.message}`;
      throw e;
    }
  }

  private async list(): Promise<string> {
    const rows = await this.reg.listPending();
    if (rows.length === 0) return 'Tidak ada permohonan menunggu. ✅';
    const lines = await Promise.all(
      rows.map(async (r) => {
        let target = r.koperasiRef ?? '-';
        if (r.type === 'NEW_KOPERASI') target = `KOPERASI BARU "${(r.newKoperasi as { nama?: string } | null)?.nama ?? '-'}"`;
        else if (r.koperasiId) {
          const kop = await prisma.koperasi.findUnique({ where: { id: r.koperasiId } });
          target = kop?.nama ?? target;
        } else if (r.koperasiRef) {
          const dir = await prisma.koperasiDirectory.findUnique({ where: { sourceRef: r.koperasiRef } });
          target = dir?.nama ?? target;
        }
        const role = r.type === 'NEW_KOPERASI' ? '' : `${r.roleRequested ?? 'ANGGOTA'} → `;
        return `• ${r.shortCode} — ${role}${target} — via ${r.channel} — ${usia(r.createdAt)}`;
      }),
    );
    return `${rows.length} permohonan menunggu:\n${lines.join('\n')}\nDetail: DETAIL R-xxx · Setujui: SETUJUI R-xxx [ref] · Tolak: TOLAK R-xxx <alasan>`;
  }

  private async detail(shortCode: string): Promise<string> {
    const { reg, koperasiNama, candidates } = await this.reg.detail(shortCode);
    const nik = reg.nik ? maskNik(reg.nik) : '(belum isi form)';
    const nama = reg.nama ? `${reg.nama.charAt(0)}***` : '(belum isi form)';
    const kandidat =
      candidates.length === 0
        ? '   (tidak ada kandidat cocok di data resmi)'
        : candidates
            .map(
              (c, i) =>
                `   ${String.fromCharCode(97 + i)}. ${c.sourceRef} — ${c.nama.charAt(0)}*** (${c.sourceTable}, NIK ${c.nikMasked ?? '-'})`,
            )
            .join('\n');
    return `${shortCode} — ${reg.type === 'NEW_KOPERASI' ? 'KOPERASI BARU' : reg.roleRequested} — ${koperasiNama}
pemohon: ${nama} (NIK ${nik}) — status ${reg.status}
Kandidat data resmi yang mirip:
${kandidat}`;
  }

  private async setRole(waNumber: string, role: 'ANGGOTA' | 'PENGURUS' | 'OWNER'): Promise<string> {
    const identity = await prisma.whatsappIdentity.findUnique({
      where: { waNumber },
      include: { user: true },
    });
    if (!identity) return `⚠️ Nomor ${waNumber} tidak terhubung ke user mana pun.`;
    await prisma.user.update({ where: { id: identity.userId }, data: { role } });
    await this.audit('super_admin.set_role', `${waNumber}→${role}`);
    return `✅ Peran ${identity.user.name} diubah menjadi *${role}*.`;
  }

  private async audit(action: string, ref: string) {
    await writeAudit({ action, resourceRef: ref, channel: 'DM', result: 'OK' });
  }
}
