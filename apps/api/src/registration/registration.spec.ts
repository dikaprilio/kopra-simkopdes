import { prisma } from '@kopra/db';
import { GowaClient } from '../whatsapp/gateway';
import { OutboxService } from '../whatsapp/outbox.service';
import { GuestFlowService } from '../whatsapp/guest-flow';
import { TokensService, TokenError } from './tokens.service';
import { RegistrationService, masksMatch, maskNik } from './registration.service';

/** TDD registrasi (plan M6): NIK-match, magic link single-use/expiry, OTP 3×, hook member. */

const NIK_MEMBER = '3402111111111111'; // ada di Member koperasi onboarded
const NIK_IMPORT = '3402222222222222'; // cocok masked ImportedIdentity directory
const NIK_ASING = '9999888877776666';

let tokens: TokensService;
let reg: RegistrationService;
let kidOnboard: string;

const tokenFromLink = (link: string) => new URL(link).searchParams.get('token')!;

beforeAll(async () => {
  tokens = new TokensService();
  reg = new RegistrationService(tokens, new OutboxService(new GowaClient()));

  // bersihkan jejak run sebelumnya
  await prisma.whatsappIdentity.deleteMany({ where: { waNumber: { startsWith: '62888' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'wa-62888' } } });
  await prisma.registrationRequest.deleteMany({ where: { waNumber: { startsWith: '62888' } } });
  await prisma.authToken.deleteMany({ where: { waNumber: { startsWith: '62888' } } });
  await prisma.otpChallenge.deleteMany({ where: { waNumber: { startsWith: '62888' } } });
  await prisma.importedIdentity.deleteMany({ where: { koperasiRef: 'KOP-JESTDIR' } });
  const oldDir = await prisma.koperasi.findUnique({ where: { sourceRef: 'KOP-JESTDIR' } });
  if (oldDir) {
    await prisma.whatsappIdentity.deleteMany({ where: { koperasiId: oldDir.id } });
    await prisma.coaAccount.deleteMany({ where: { koperasiId: oldDir.id } });
    await prisma.koperasi.delete({ where: { id: oldDir.id } });
  }
  await prisma.koperasiDirectory.deleteMany({ where: { sourceRef: 'KOP-JESTDIR' } });

  // fixture 1: koperasi ONBOARDED (IMPORTED) + member ber-NIK
  const kop = await prisma.koperasi.upsert({
    where: { sourceRef: 'KOP-JESTREG' },
    update: {},
    create: { nama: 'KDMP Jest Onboard', sourceRef: 'KOP-JESTREG', origin: 'IMPORTED' },
  });
  kidOnboard = kop.id;
  await prisma.member.deleteMany({ where: { koperasiId: kidOnboard } });
  await prisma.member.create({
    data: { koperasiId: kidOnboard, nama: 'Bu Sari Jest', nik: NIK_MEMBER },
  });

  // fixture 2: koperasi masih di DIRECTORY + identitas resmi masked
  await prisma.koperasiDirectory.create({
    data: { sourceRef: 'KOP-JESTDIR', nama: 'KDMP Jest Directory', wilayah: 'Bantul, DIY' },
  });
  await prisma.importedIdentity.create({
    data: {
      koperasiRef: 'KOP-JESTDIR',
      sourceTable: 'pengurus',
      sourceRef: 'PGR-JEST-01',
      nama: 'Agus Jest',
      nikMasked: '3402**********22',
      roleHint: 'pengurus',
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('masksMatch / maskNik (pure)', () => {
  it('cocok bila prefix+suffix sama dan panjang sama', () => {
    expect(masksMatch(NIK_IMPORT, '3402**********22')).toBe(true);
    expect(masksMatch(NIK_ASING, '3402**********22')).toBe(false);
    expect(masksMatch(NIK_IMPORT, '3402*********22')).toBe(false); // panjang beda
    expect(masksMatch(NIK_IMPORT, null)).toBe(false);
  });
  it('maskNik tidak pernah menampilkan NIK utuh', () => {
    expect(maskNik(NIK_MEMBER)).toBe('3402**********11');
    expect(maskNik(NIK_MEMBER)).not.toContain(NIK_MEMBER.slice(4, 14));
  });
});

describe('registrasi WA → form web (NIK-match)', () => {
  it('NIK cocok Member → langsung ACTIVE + identity WA + notifikasi', async () => {
    const { link } = await reg.startWaRegistration({
      waNumber: '628880001',
      role: 'ANGGOTA',
      koperasiId: kidOnboard,
    });
    const res = await reg.completeWaForm({
      token: tokenFromLink(link),
      nama: 'Bu Sari Jest',
      nik: NIK_MEMBER,
      password: 'rahasia1',
    });
    expect(res.status).toBe('ACTIVE');
    const identity = await prisma.whatsappIdentity.findUnique({
      where: { waNumber: '628880001' },
      include: { user: true },
    });
    expect(identity?.koperasiId).toBe(kidOnboard);
    expect(identity?.user.memberId).toBeTruthy();
    const notif = await prisma.outboundWhatsappMessage.findFirst({
      where: { toJid: '628880001@s.whatsapp.net' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notif?.text).toContain('Selamat datang');
  });

  it('NIK tidak cocok (koperasi directory) → PENDING_SUPER_ADMIN + kandidat tunggal tertaut', async () => {
    const { link, shortCode } = await reg.startWaRegistration({
      waNumber: '628880002',
      role: 'PENGURUS',
      koperasiRef: 'KOP-JESTDIR',
    });
    const res = await reg.completeWaForm({
      token: tokenFromLink(link),
      nama: 'Agus Jest',
      nik: NIK_IMPORT,
      password: 'rahasia1',
    });
    expect(res.status).toBe('PENDING');
    const row = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    expect(row?.status).toBe('PENDING_SUPER_ADMIN');
    expect(row?.candidateRef).toBe('PGR-JEST-01'); // masked match unik → kandidat otomatis
  });

  it('SETUJUI → onboard koperasi dari directory + COA + user PENGURUS aktif', async () => {
    const row = await prisma.registrationRequest.findFirst({
      where: { waNumber: '628880002', status: 'PENDING_SUPER_ADMIN' },
    });
    const msg = await reg.approve(row!.shortCode, 'PGR-JEST-01');
    expect(msg).toContain('disetujui');
    const kop = await prisma.koperasi.findUnique({ where: { sourceRef: 'KOP-JESTDIR' } });
    expect(kop?.status).toBe('ACTIVE');
    const coa = await prisma.coaAccount.count({ where: { koperasiId: kop!.id } });
    expect(coa).toBeGreaterThanOrEqual(10); // DEFAULT_COA ter-seed
    const identity = await prisma.whatsappIdentity.findUnique({
      where: { waNumber: '628880002' },
      include: { user: true },
    });
    expect(identity?.user.role).toBe('PENGURUS');
  });

  it('magic link single-use & expiry', async () => {
    const { link } = await reg.startWaRegistration({
      waNumber: '628880003',
      role: 'ANGGOTA',
      koperasiId: kidOnboard,
    });
    const token = tokenFromLink(link);
    await tokens.consumeMagicLink(token);
    await expect(tokens.consumeMagicLink(token)).rejects.toMatchObject({ code: 'USED' });

    const { link: link2 } = await reg.startWaRegistration({
      waNumber: '628880004',
      role: 'ANGGOTA',
      koperasiId: kidOnboard,
    });
    const token2 = tokenFromLink(link2);
    await prisma.authToken.updateMany({
      where: { waNumber: '628880004' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(tokens.consumeMagicLink(token2)).rejects.toMatchObject({ code: 'EXPIRED' });
  });

  it('OTP: salah 3× terkunci; benar = sukses single-use', async () => {
    const otp = await tokens.issueOtp('628880005');
    for (let i = 0; i < 3; i++) {
      await expect(tokens.verifyOtp('628880005', '000000')).rejects.toBeInstanceOf(TokenError);
    }
    await expect(tokens.verifyOtp('628880005', otp)).rejects.toMatchObject({ code: 'LOCKED' });

    const otp2 = await tokens.issueOtp('628880006');
    await expect(tokens.verifyOtp('628880006', otp2)).resolves.toBeTruthy();
    await expect(tokens.verifyOtp('628880006', otp2)).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('hook onMemberCreated: PENDING dgn NIK sama auto-approve saat anggota dibuat', async () => {
    const { link, shortCode } = await reg.startWaRegistration({
      waNumber: '628880007',
      role: 'ANGGOTA',
      koperasiId: kidOnboard,
    });
    await reg.completeWaForm({
      token: tokenFromLink(link),
      nama: 'Wati Jest',
      nik: NIK_ASING,
      password: 'rahasia1',
    });
    let row = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    expect(row?.status).toBe('PENDING_SUPER_ADMIN');

    await prisma.member.create({
      data: { koperasiId: kidOnboard, nama: 'Wati Jest', nik: NIK_ASING },
    });
    await reg.onMemberCreated(kidOnboard, NIK_ASING);
    row = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    expect(row?.status).toBe('APPROVED');
    expect(await prisma.whatsappIdentity.findUnique({ where: { waNumber: '628880007' } })).toBeTruthy();
  });
});

describe('guest flow DAFTAR (state machine WA)', () => {
  const msg = (text: string, from = '628880010') => ({
    deviceId: 'jest-reg',
    messageId: `G-${Math.random().toString(36).slice(2)}`,
    chatJid: `${from}@s.whatsapp.net`,
    senderNumber: from,
    text,
    isGroup: false,
  });

  it('DAFTAR → role → cari koperasi → pilih → magic link', async () => {
    const flow = new GuestFlowService(reg);
    expect(await flow.handle(msg('halo'))).toBeNull(); // bukan bagian alur
    expect(await flow.handle(msg('DAFTAR'))).toContain('mendaftar sebagai apa');
    expect(await flow.handle(msg('2'))).toContain('Koperasimu namanya apa');
    const daftar = await flow.handle(msg('jest onboard'));
    expect(daftar).toContain('1. KDMP Jest Onboard');
    const link = await flow.handle(msg('1'));
    expect(link).toContain('/register/complete?token=');
    expect(link).toContain('jangan kirim NIK lewat chat');
  });

  it('BATAL menghentikan alur', async () => {
    const flow = new GuestFlowService(reg);
    await flow.handle(msg('DAFTAR', '628880011'));
    expect(await flow.handle(msg('BATAL', '628880011'))).toContain('dibatalkan');
    expect(await flow.handle(msg('2', '628880011'))).toBeNull(); // state sudah bersih
  });
});
