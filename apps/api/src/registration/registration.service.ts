import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { prisma, DEFAULT_COA } from '@kopra/db';
import { writeAudit } from '@kopra/core';
import { OutboxService } from '../whatsapp/outbox.service';
import { TokensService, TokenError } from './tokens.service';

export class RegError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface KoperasiOption {
  label: string;
  koperasiId?: string; // sudah onboarded
  koperasiRef?: string; // masih di directory
}

const jid = (waNumber: string) => `${waNumber}@s.whatsapp.net`;

/** Tampilan NIK SELALU masked (4 depan + 2 belakang). */
export function maskNik(nik: string): string {
  if (nik.length < 8) return '*'.repeat(nik.length);
  return nik.slice(0, 4) + '*'.repeat(nik.length - 6) + nik.slice(-2);
}

/** Cocokkan NIK penuh vs nikMasked import ("3402**********01"). */
export function masksMatch(nik: string, masked?: string | null): boolean {
  if (!masked || masked.length !== nik.length) return false;
  const m = masked.match(/^(\d*)(\*+)(\d*)$/);
  if (!m) return masked === nik;
  const [, prefix, , suffix] = m;
  return nik.startsWith(prefix) && (suffix === '' || nik.endsWith(suffix));
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly tokens: TokensService,
    private readonly outbox: OutboxService,
  ) {}

  /** Top-5 gabungan: koperasi onboarded (prioritas) + directory panitia. */
  async searchKoperasi(q: string): Promise<KoperasiOption[]> {
    const [onboarded, dir] = await Promise.all([
      prisma.koperasi.findMany({
        where: { nama: { contains: q, mode: 'insensitive' }, status: 'ACTIVE' },
        take: 5,
      }),
      prisma.koperasiDirectory.findMany({
        where: { nama: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
    ]);
    const taken = new Set(onboarded.map((k) => k.sourceRef).filter(Boolean));
    const opts: KoperasiOption[] = onboarded.map((k) => ({
      label: k.desa ? `${k.nama} — ${k.desa}` : k.nama,
      koperasiId: k.id,
    }));
    for (const d of dir) {
      if (taken.has(d.sourceRef)) continue;
      opts.push({ label: d.wilayah ? `${d.nama} — ${d.wilayah}` : d.nama, koperasiRef: d.sourceRef });
    }
    return opts.slice(0, 5);
  }

  private async nextShortCode(): Promise<string> {
    const last = await prisma.registrationRequest.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { shortCode: true },
    });
    const n = last ? Number(last.shortCode.replace(/\D/g, '')) + 1 : 1;
    return `R-${String(n).padStart(3, '0')}`;
  }

  /** Mulai registrasi dari WA (guest flow) → magic link form web. */
  async startWaRegistration(input: {
    waNumber: string;
    role: 'PENGURUS' | 'ANGGOTA';
    koperasiId?: string;
    koperasiRef?: string;
  }): Promise<{ shortCode: string; link: string }> {
    const existing = await prisma.whatsappIdentity.findUnique({ where: { waNumber: input.waNumber } });
    if (existing) throw new RegError('ALREADY_LINKED', 'Nomor ini sudah terhubung ke koperasi. 😊');
    const req = await prisma.registrationRequest.create({
      data: {
        type: 'MEMBER_JOIN',
        channel: 'WA',
        waNumber: input.waNumber,
        roleRequested: input.role,
        koperasiId: input.koperasiId,
        koperasiRef: input.koperasiRef,
        status: 'AWAITING_FORM',
        shortCode: await this.nextShortCode(),
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    const link = await this.tokens.issueMagicLink(input.waNumber, req.id);
    return { shortCode: req.shortCode, link };
  }

  /** Registrasi KOPERASI BARU dari WA. */
  async startNewKoperasiRegistration(waNumber: string, namaKoperasi: string) {
    const existing = await prisma.whatsappIdentity.findUnique({ where: { waNumber } });
    if (existing) throw new RegError('ALREADY_LINKED', 'Nomor ini sudah terhubung ke koperasi. 😊');
    const req = await prisma.registrationRequest.create({
      data: {
        type: 'NEW_KOPERASI',
        channel: 'WA',
        waNumber,
        roleRequested: 'OWNER',
        newKoperasi: { nama: namaKoperasi },
        status: 'AWAITING_FORM',
        shortCode: await this.nextShortCode(),
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    const link = await this.tokens.issueMagicLink(waNumber, req.id);
    return { shortCode: req.shortCode, link };
  }

  /**
   * Form web selesai diisi (kontrak POST /registration/complete-wa; UI = Aldio).
   * NIK-match: Member.nik (onboarded) → langsung AKTIF; selain itu → PENDING.
   */
  async completeWaForm(input: { token: string; nama: string; nik: string; password: string }) {
    const { waNumber, regRequestId } = await this.tokens.consumeMagicLink(input.token);
    const reg = await prisma.registrationRequest.findUnique({ where: { id: regRequestId } });
    if (!reg || reg.status !== 'AWAITING_FORM')
      throw new TokenError('INVALID', 'Permohonan tidak ditemukan / sudah diproses.');
    if (reg.expiresAt < new Date()) throw new TokenError('EXPIRED', 'Permohonan kedaluwarsa. Ketik DAFTAR lagi ya.');

    const passwordHash = await argon2.hash(input.password);
    await prisma.registrationRequest.update({
      where: { id: reg.id },
      data: { nama: input.nama, nik: input.nik, passwordHash },
    });

    if (reg.type === 'NEW_KOPERASI') {
      await this.toPending(reg.id, 'PENDING_SUPER_ADMIN');
      await this.outbox.enqueue(
        jid(waNumber),
        `📝 Pendaftaran koperasi barumu tercatat (kode ${reg.shortCode}) dan menunggu persetujuan admin. Kami kabari lewat chat ini ya!`,
      );
      return { status: 'PENDING' as const, shortCode: reg.shortCode };
    }

    // MEMBER_JOIN — coba auto-match anggota di koperasi onboarded
    const koperasi = reg.koperasiId
      ? await prisma.koperasi.findUnique({ where: { id: reg.koperasiId } })
      : null;
    if (koperasi) {
      const member = await prisma.member.findFirst({
        where: { koperasiId: koperasi.id, nik: input.nik },
      });
      if (member) {
        await this.activate(reg.id, {
          waNumber,
          nama: input.nama,
          nik: input.nik,
          passwordHash,
          role: (reg.roleRequested as 'PENGURUS' | 'ANGGOTA') ?? 'ANGGOTA',
          koperasiId: koperasi.id,
          memberId: member.id,
        });
        await this.outbox.enqueue(
          jid(waNumber),
          `✅ Selamat datang di *${koperasi.nama}*, ${input.nama.split(' ')[0]}!\nAkunmu langsung aktif karena NIK-mu terdaftar sebagai anggota.\nCoba: "info koperasi", "simpanan saya", atau tanya apa saja.`,
        );
        return { status: 'ACTIVE' as const, koperasiNama: koperasi.nama };
      }
    }

    // tidak match → PENDING (kandidat dari data resmi utk membantu super-admin)
    const ref = koperasi?.sourceRef ?? reg.koperasiRef;
    let candidateRef: string | undefined;
    if (ref) {
      const imported = await prisma.importedIdentity.findMany({ where: { koperasiRef: ref } });
      const matches = imported.filter((i) => masksMatch(input.nik, i.nikMasked));
      if (matches.length === 1) candidateRef = matches[0].sourceRef;
    }
    const nextStatus =
      koperasi && koperasi.managementMode === 'OWNER' ? 'PENDING_OWNER' : 'PENDING_SUPER_ADMIN';
    await this.toPending(reg.id, nextStatus, candidateRef);
    await this.outbox.enqueue(
      jid(waNumber),
      `📝 Pendaftaranmu tercatat (kode ${reg.shortCode}) dan menunggu persetujuan.\nKami kabari lewat chat ini begitu disetujui ya!`,
    );
    return { status: 'PENDING' as const, shortCode: reg.shortCode };
  }

  private async toPending(regId: string, status: 'PENDING_SUPER_ADMIN' | 'PENDING_OWNER', candidateRef?: string) {
    await prisma.registrationRequest.update({
      where: { id: regId },
      data: { status, candidateRef },
    });
  }

  /** Efek aktivasi: User + WhatsappIdentity + APPROVED (idempotent via email unik). */
  private async activate(
    regId: string,
    a: {
      waNumber: string;
      nama: string;
      nik?: string;
      passwordHash: string;
      role: 'OWNER' | 'PENGURUS' | 'ANGGOTA';
      koperasiId: string;
      memberId?: string;
    },
  ) {
    const email = `wa-${a.waNumber}@kopra.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { koperasiId: a.koperasiId, role: a.role, memberId: a.memberId, status: 'ACTIVE' },
      create: {
        email,
        passwordHash: a.passwordHash,
        name: a.nama,
        nik: a.nik,
        role: a.role,
        status: 'ACTIVE',
        koperasiId: a.koperasiId,
        memberId: a.memberId,
      },
    });
    await prisma.whatsappIdentity.upsert({
      where: { waNumber: a.waNumber },
      update: { userId: user.id, koperasiId: a.koperasiId },
      create: { waNumber: a.waNumber, userId: user.id, koperasiId: a.koperasiId },
    });
    await prisma.registrationRequest.update({ where: { id: regId }, data: { status: 'APPROVED' } });
    await writeAudit({
      koperasiId: a.koperasiId,
      action: 'registration.activate',
      resourceType: 'RegistrationRequest',
      resourceRef: regId,
      channel: 'SYSTEM',
      result: 'OK',
    });
    return user;
  }

  /** SETUJUI R-xxx [candidateRef] — dari super-admin WA (atau owner web nanti). */
  async approve(shortCode: string, candidateRef?: string): Promise<string> {
    const reg = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    if (!reg) throw new RegError('NOT_FOUND', `Permohonan ${shortCode} tidak ditemukan.`);
    if (!reg.status.startsWith('PENDING'))
      throw new RegError('NOT_PENDING', `${shortCode} berstatus ${reg.status} — tidak bisa disetujui.`);
    if (!reg.passwordHash || !reg.nama)
      throw new RegError('FORM_INCOMPLETE', `${shortCode} belum melengkapi form web.`);

    let koperasiId = reg.koperasiId;
    let koperasiNama: string;

    if (reg.type === 'NEW_KOPERASI') {
      const nk = (reg.newKoperasi as { nama?: string } | null) ?? {};
      const kop = await prisma.koperasi.create({
        data: { nama: nk.nama ?? `Koperasi ${reg.nama}`, origin: 'LOCAL', managementMode: 'OWNER', status: 'ACTIVE' },
      });
      await this.seedCoa(kop.id);
      koperasiId = kop.id;
      koperasiNama = kop.nama;
    } else if (!koperasiId && reg.koperasiRef) {
      // onboard koperasi IMPORTED dari directory saat approval pertama
      const dir = await prisma.koperasiDirectory.findUnique({ where: { sourceRef: reg.koperasiRef } });
      if (!dir) throw new RegError('DIR_NOT_FOUND', `Directory ${reg.koperasiRef} tidak ditemukan.`);
      const kop = await prisma.koperasi.upsert({
        where: { sourceRef: dir.sourceRef },
        update: {},
        create: { nama: dir.nama, sourceRef: dir.sourceRef, origin: 'IMPORTED', status: 'ACTIVE' },
      });
      await this.seedCoa(kop.id);
      koperasiId = kop.id;
      koperasiNama = kop.nama;
    } else {
      const kop = await prisma.koperasi.findUnique({ where: { id: koperasiId! } });
      koperasiNama = kop?.nama ?? 'koperasimu';
    }

    const role = reg.type === 'NEW_KOPERASI' ? 'OWNER' : ((reg.roleRequested as 'PENGURUS' | 'ANGGOTA') ?? 'ANGGOTA');
    await prisma.registrationRequest.update({
      where: { id: reg.id },
      data: { candidateRef: candidateRef ?? reg.candidateRef },
    });
    await this.activate(reg.id, {
      waNumber: reg.waNumber,
      nama: reg.nama,
      nik: reg.nik ?? undefined,
      passwordHash: reg.passwordHash,
      role,
      koperasiId: koperasiId!,
    });
    await this.outbox.enqueue(
      jid(reg.waNumber),
      `🎉 Permohonanmu (${shortCode}) DISETUJUI! Selamat datang di *${koperasiNama}*.\nCoba: "info koperasi" atau langsung tanya apa saja.`,
    );
    return `✅ ${shortCode} disetujui${candidateRef ? ` & ditautkan ke ${candidateRef}` : ''}. Pemohon sudah dinotifikasi.`;
  }

  async reject(shortCode: string, alasan: string): Promise<string> {
    const reg = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    if (!reg) throw new RegError('NOT_FOUND', `Permohonan ${shortCode} tidak ditemukan.`);
    if (!reg.status.startsWith('PENDING'))
      throw new RegError('NOT_PENDING', `${shortCode} berstatus ${reg.status}.`);
    await prisma.registrationRequest.update({ where: { id: reg.id }, data: { status: 'REJECTED' } });
    await this.outbox.enqueue(
      jid(reg.waNumber),
      `🙏 Maaf, permohonanmu (${shortCode}) belum bisa disetujui.${alasan ? `\nAlasan: ${alasan}` : ''}\nSilakan hubungi pengurus koperasimu atau coba daftar ulang.`,
    );
    return `✅ ${shortCode} ditolak. Pemohon sudah dinotifikasi.`;
  }

  /** Hook: pengurus menambah anggota ber-NIK → permohonan PENDING yang cocok auto-aktif. */
  async onMemberCreated(koperasiId: string, nik: string): Promise<void> {
    const regs = await prisma.registrationRequest.findMany({
      where: { koperasiId, nik, status: { in: ['PENDING_SUPER_ADMIN', 'PENDING_OWNER'] } },
    });
    for (const reg of regs) {
      try {
        await this.approve(reg.shortCode);
      } catch (e) {
        this.logger.warn(`auto-approve ${reg.shortCode} gagal: ${(e as Error).message}`);
      }
    }
  }

  async listPending() {
    return prisma.registrationRequest.findMany({
      where: { status: { in: ['PENDING_SUPER_ADMIN', 'PENDING_OWNER'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Detail utk super-admin — NIK selalu masked, kandidat dari data resmi. */
  async detail(shortCode: string) {
    const reg = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    if (!reg) throw new RegError('NOT_FOUND', `Permohonan ${shortCode} tidak ditemukan.`);
    let koperasiNama = reg.koperasiRef ?? '-';
    if (reg.koperasiId) {
      const kop = await prisma.koperasi.findUnique({ where: { id: reg.koperasiId } });
      koperasiNama = kop?.nama ?? koperasiNama;
    } else if (reg.koperasiRef) {
      const dir = await prisma.koperasiDirectory.findUnique({ where: { sourceRef: reg.koperasiRef } });
      koperasiNama = dir?.nama ?? reg.koperasiRef;
    } else if (reg.type === 'NEW_KOPERASI') {
      koperasiNama = `(baru) ${(reg.newKoperasi as { nama?: string } | null)?.nama ?? '-'}`;
    }
    const ref = reg.koperasiRef ?? (reg.koperasiId
      ? (await prisma.koperasi.findUnique({ where: { id: reg.koperasiId } }))?.sourceRef
      : undefined);
    const candidates =
      ref && reg.nik
        ? (await prisma.importedIdentity.findMany({ where: { koperasiRef: ref } })).filter((i) =>
            masksMatch(reg.nik!, i.nikMasked),
          )
        : [];
    return { reg, koperasiNama, candidates };
  }

  private async seedCoa(koperasiId: string) {
    const idByKode = new Map<string, string>();
    for (const c of DEFAULT_COA) {
      const row = await prisma.coaAccount.upsert({
        where: { koperasiId_kode: { koperasiId, kode: c.kode } },
        update: {},
        create: {
          koperasiId,
          kode: c.kode,
          nama: c.nama,
          type: c.type,
          parentId: c.parentKode ? idByKode.get(c.parentKode) : undefined,
        },
      });
      idByKode.set(c.kode, row.id);
    }
  }
}
