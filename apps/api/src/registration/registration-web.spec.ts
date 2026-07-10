import { prisma } from '@kopra/db';
import { GowaClient } from '../whatsapp/gateway';
import { OutboxService } from '../whatsapp/outbox.service';
import { TokensService } from './tokens.service';
import { RegistrationService } from './registration.service';

/** TDD Fase 3 Stage 1: registrasi WEB-FIRST (OTP via WA) — start-web/verify-otp/resend-otp. */

const WA_PREFIX = '62899';
const wa = (n: string) => `${WA_PREFIX}${n}`;

let tokens: TokensService;
let reg: RegistrationService;
let kopLocalId: string;

async function readOtpFromOutbox(waNumber: string): Promise<string> {
  const msg = await prisma.outboundWhatsappMessage.findFirst({
    where: { toJid: `${waNumber}@s.whatsapp.net` },
    orderBy: { createdAt: 'desc' },
  });
  const match = msg?.text.match(/\d{6}/);
  if (!match) throw new Error(`OTP tidak ditemukan di outbox utk ${waNumber}`);
  return match[0];
}

beforeAll(async () => {
  tokens = new TokensService();
  reg = new RegistrationService(tokens, new OutboxService(new GowaClient()));

  // bersihkan jejak run sebelumnya
  await prisma.whatsappIdentity.deleteMany({ where: { waNumber: { startsWith: WA_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `wa-${WA_PREFIX}` } } });
  await prisma.otpChallenge.deleteMany({ where: { waNumber: { startsWith: WA_PREFIX } } });
  await prisma.registrationRequest.deleteMany({ where: { waNumber: { startsWith: WA_PREFIX } } });
  await prisma.outboundWhatsappMessage.deleteMany({
    where: { toJid: { startsWith: `${WA_PREFIX}` } },
  });

  await prisma.importedIdentity.deleteMany({ where: { koperasiRef: 'KOP-WEBJEST-DIR' } });
  await prisma.koperasiDirectory.deleteMany({ where: { sourceRef: 'KOP-WEBJEST-DIR' } });
  const oldLocal = await prisma.koperasi.findUnique({ where: { sourceRef: 'KOP-WEBJEST-LOCAL' } });
  if (oldLocal) {
    await prisma.whatsappIdentity.deleteMany({ where: { koperasiId: oldLocal.id } });
    await prisma.coaAccount.deleteMany({ where: { koperasiId: oldLocal.id } });
    await prisma.member.deleteMany({ where: { koperasiId: oldLocal.id } });
    await prisma.koperasi.delete({ where: { id: oldLocal.id } });
  }

  // fixture: koperasi LOCAL (managementMode OWNER) — join tidak match NIK apa pun
  const kopLocal = await prisma.koperasi.upsert({
    where: { sourceRef: 'KOP-WEBJEST-LOCAL' },
    update: {},
    create: {
      nama: 'Koperasi WebJest Lokal',
      sourceRef: 'KOP-WEBJEST-LOCAL',
      origin: 'LOCAL',
      managementMode: 'OWNER',
      status: 'ACTIVE',
    },
  });
  kopLocalId = kopLocal.id;

  // fixture: koperasi IMPORTED yang MASIH di directory (belum onboarded)
  await prisma.koperasiDirectory.create({
    data: { sourceRef: 'KOP-WEBJEST-DIR', nama: 'Koperasi WebJest Directory', wilayah: 'Sleman, DIY' },
  });

  // fixture: nomor WA yang SUDAH terhubung ke user ACTIVE
  const activeUser = await prisma.user.create({
    data: {
      email: `wa-${wa('099')}@kopra.local`,
      passwordHash: 'x',
      name: 'User Aktif WebJest',
      role: 'ANGGOTA',
      status: 'ACTIVE',
      koperasiId: kopLocalId,
    },
  });
  await prisma.whatsappIdentity.create({
    data: { waNumber: wa('099'), userId: activeUser.id, koperasiId: kopLocalId },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('registrasi WEB-FIRST (OTP via WA)', () => {
  it('happy path: start-web → OTP di outbox → verify-otp → PENDING_OWNER (LOCAL join)', async () => {
    const waNumber = wa('001');
    const { sentTo } = await reg.startWebRegistration({
      nama: 'Budi WebJest',
      nik: '9100000000000001',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA',
      koperasiRef: kopLocalId,
    });
    expect(sentTo).not.toBe(waNumber);
    expect(sentTo).toContain('***');
    expect(sentTo).not.toContain('9100000000000001'); // no NIK leak

    const otp = await readOtpFromOutbox(waNumber);
    expect(otp).toMatch(/^\d{6}$/);

    const res = await reg.verifyWebOtp(waNumber, otp);
    expect(res.status).toBe('PENDING_OWNER');
    expect(res.shortCode).toBeTruthy();
    expect((res as Record<string, unknown>).nik).toBeUndefined();

    const row = await prisma.registrationRequest.findUnique({ where: { shortCode: res.shortCode } });
    expect(row?.status).toBe('PENDING_OWNER');
    expect(row?.channel).toBe('WEB');
  });

  it('OTP salah 3× lalu percobaan berikutnya → OTP_TERKUNCI', async () => {
    const waNumber = wa('002');
    await reg.startWebRegistration({
      nama: 'Citra WebJest',
      nik: '9100000000000002',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA',
      koperasiRef: kopLocalId,
    });
    for (let i = 0; i < 3; i++) {
      await expect(reg.verifyWebOtp(waNumber, '000000')).rejects.toMatchObject({ code: 'OTP_SALAH' });
    }
    await expect(reg.verifyWebOtp(waNumber, '000000')).rejects.toMatchObject({ code: 'OTP_TERKUNCI' });
  });

  it('OTP kedaluwarsa → OTP_KEDALUWARSA', async () => {
    const waNumber = wa('003');
    await reg.startWebRegistration({
      nama: 'Dedi WebJest',
      nik: '9100000000000003',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA',
      koperasiRef: kopLocalId,
    });
    const otp = await readOtpFromOutbox(waNumber);
    await prisma.otpChallenge.updateMany({
      where: { waNumber },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(reg.verifyWebOtp(waNumber, otp)).rejects.toMatchObject({ code: 'OTP_KEDALUWARSA' });
  });

  it('resend < 60 detik sejak kirim terakhir → TUNGGU_SEBELUM_KIRIM_ULANG', async () => {
    const waNumber = wa('004');
    await reg.startWebRegistration({
      nama: 'Eka WebJest',
      nik: '9100000000000004',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA',
      koperasiRef: kopLocalId,
    });
    await expect(reg.resendWebOtp(waNumber)).rejects.toMatchObject({ code: 'TUNGGU_SEBELUM_KIRIM_ULANG' });
  });

  it('nomor WA sudah terdaftar user ACTIVE → NOMOR_SUDAH_TERDAFTAR', async () => {
    await expect(
      reg.startWebRegistration({
        nama: 'Fajar WebJest',
        nik: '9100000000000005',
        password: 'rahasia1',
        waNumber: wa('099'),
        role: 'ANGGOTA',
        koperasiRef: kopLocalId,
      }),
    ).rejects.toMatchObject({ code: 'NOMOR_SUDAH_TERDAFTAR' });
  });

  it('koperasi IMPORTED (masih di directory) → PENDING_SUPER_ADMIN', async () => {
    const waNumber = wa('006');
    await reg.startWebRegistration({
      nama: 'Agus WebJest',
      nik: '9100000000000006',
      password: 'rahasia1',
      waNumber,
      role: 'PENGURUS',
      koperasiRef: 'KOP-WEBJEST-DIR',
    });
    const otp = await readOtpFromOutbox(waNumber);
    const res = await reg.verifyWebOtp(waNumber, otp);
    expect(res.status).toBe('PENDING_SUPER_ADMIN');
  });

  it('resend setelah rate-limit lewat mengirim OTP baru yg valid', async () => {
    const waNumber = wa('007');
    await reg.startWebRegistration({
      nama: 'Gita WebJest',
      nik: '9100000000000007',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA',
      koperasiRef: kopLocalId,
    });
    // paksa mundur waktu kirim terakhir supaya rate-limit sudah lewat
    await prisma.otpChallenge.updateMany({
      where: { waNumber },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    const { sentTo } = await reg.resendWebOtp(waNumber);
    expect(sentTo).toContain('***');
    const otp = await readOtpFromOutbox(waNumber);
    const res = await reg.verifyWebOtp(waNumber, otp);
    expect(res.status).toBe('PENDING_OWNER');
  });

  it('start-web berulang < 60 detik → TUNGGU_SEBELUM_KIRIM_ULANG (anti OTP-flood)', async () => {
    const waNumber = wa('009');
    const input = {
      nama: 'Ika WebJest',
      nik: '9100000000000009',
      password: 'rahasia1',
      waNumber,
      role: 'ANGGOTA' as const,
      koperasiRef: kopLocalId,
    };
    await reg.startWebRegistration(input);
    await expect(reg.startWebRegistration(input)).rejects.toMatchObject({
      code: 'TUNGGU_SEBELUM_KIRIM_ULANG',
    });
  });

  it('verify-otp tanpa permohonan AWAITING_OTP aktif → error', async () => {
    await expect(reg.verifyWebOtp(wa('999-unknown'), '123456')).rejects.toMatchObject({
      code: 'PERMOHONAN_TIDAK_DITEMUKAN',
    });
  });

  it('koperasiRef tidak ditemukan → KOPERASI_TIDAK_DITEMUKAN', async () => {
    await expect(
      reg.startWebRegistration({
        nama: 'Hadi WebJest',
        nik: '9100000000000008',
        password: 'rahasia1',
        waNumber: wa('008'),
        role: 'ANGGOTA',
        koperasiRef: 'KOP-TIDAK-ADA',
      }),
    ).rejects.toMatchObject({ code: 'KOPERASI_TIDAK_DITEMUKAN' });
  });
});
