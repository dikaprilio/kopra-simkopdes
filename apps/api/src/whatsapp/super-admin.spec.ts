import { prisma } from '@kopra/db';
import { GowaClient } from './gateway';
import { OutboxService } from './outbox.service';
import { TokensService } from '../registration/tokens.service';
import { RegistrationService } from '../registration/registration.service';
import { SuperAdminService } from './super-admin';

/** Parser super-admin (F-SUPERADMIN) — deterministik, hanya dari SUPER_ADMIN_WA_NUMBER. */

let sa: SuperAdminService;
let reg: RegistrationService;
let shortCode: string;

beforeAll(async () => {
  reg = new RegistrationService(new TokensService(), new OutboxService(new GowaClient()));
  sa = new SuperAdminService(reg);

  await prisma.registrationRequest.deleteMany({ where: { waNumber: '628770077' } });
  const row = await prisma.registrationRequest.create({
    data: {
      type: 'MEMBER_JOIN',
      channel: 'WA',
      waNumber: '628770077',
      roleRequested: 'ANGGOTA',
      koperasiRef: 'KOP-JESTSA',
      nama: 'Siti Jest',
      nik: '3402333333333333',
      passwordHash: 'x',
      status: 'PENDING_SUPER_ADMIN',
      shortCode: 'R-990',
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  shortCode = row.shortCode;
  await prisma.koperasiDirectory.upsert({
    where: { sourceRef: 'KOP-JESTSA' },
    update: {},
    create: { sourceRef: 'KOP-JESTSA', nama: 'KDMP Jest SA', wilayah: 'Sleman' },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SuperAdminService', () => {
  it('isSuperAdmin hanya utk nomor env', () => {
    process.env.SUPER_ADMIN_WA_NUMBER = '62800000001';
    expect(SuperAdminService.isSuperAdmin('62800000001')).toBe(true);
    expect(SuperAdminService.isSuperAdmin('62800000002')).toBe(false);
    process.env.SUPER_ADMIN_WA_NUMBER = '';
    expect(SuperAdminService.isSuperAdmin('62800000001')).toBe(false);
  });

  it('PERMOHONAN menampilkan antrean dgn shortCode', async () => {
    const out = await sa.handle('PERMOHONAN');
    expect(out).toContain('R-990');
    expect(out).toContain('KDMP Jest SA');
    expect(out).toContain('SETUJUI R-xxx');
  });

  it('DETAIL me-mask NIK & nama (tidak pernah utuh)', async () => {
    const out = await sa.handle(`DETAIL ${shortCode}`);
    expect(out).toContain('3402**********33');
    expect(out).not.toContain('3402333333333333');
    expect(out).toContain('S***');
    expect(out).not.toContain('Siti Jest');
  });

  it('perintah tak dikenal → menu bantuan (bukan LLM)', async () => {
    const out = await sa.handle('halo bot');
    expect(out).toContain('PERMOHONAN');
    expect(out).toContain('SETUJUI');
  });

  it('TOLAK mengubah status & menotifikasi pemohon', async () => {
    const out = await sa.handle(`TOLAK ${shortCode} data tidak cocok`);
    expect(out).toContain('ditolak');
    const row = await prisma.registrationRequest.findUnique({ where: { shortCode } });
    expect(row?.status).toBe('REJECTED');
    const notif = await prisma.outboundWhatsappMessage.findFirst({
      where: { toJid: '628770077@s.whatsapp.net' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notif?.text).toContain('data tidak cocok');
  });

  it('SETUJUI atas permohonan non-pending → pesan error rapi', async () => {
    const out = await sa.handle(`SETUJUI ${shortCode}`);
    expect(out).toContain('⚠️');
    expect(out).toContain('REJECTED');
  });
});
