import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { prisma } from '@kopra/db';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // fixture users di kopra_test (idempotent)
    const kop = await prisma.koperasi.upsert({
      where: { sourceRef: 'KOP-E2E-AUTH' },
      update: {},
      create: { nama: 'Kop E2E Auth', sourceRef: 'KOP-E2E-AUTH', origin: 'LOCAL', status: 'ACTIVE', managementMode: 'OWNER' },
    });
    const hash = await argon2.hash('kopra123', { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: 'e2e-pengurus@kopra.id' },
      update: { passwordHash: hash, koperasiId: kop.id, role: 'PENGURUS', status: 'ACTIVE' },
      create: { email: 'e2e-pengurus@kopra.id', passwordHash: hash, name: 'E2E Pengurus', role: 'PENGURUS', status: 'ACTIVE', koperasiId: kop.id },
    });
    await prisma.user.upsert({
      where: { email: 'e2e-anggota@kopra.id' },
      update: { passwordHash: hash, koperasiId: kop.id, role: 'ANGGOTA', status: 'ACTIVE' },
      create: { email: 'e2e-anggota@kopra.id', passwordHash: hash, name: 'E2E Anggota', role: 'ANGGOTA', status: 'ACTIVE', koperasiId: kop.id },
    });

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app?.close(); await prisma.$disconnect(); });

  it('login pengurus → JWT + role, tanpa nik/passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-pengurus@kopra.id', password: 'kopra123' })
      .expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('PENGURUS');
    expect(res.body.user).not.toHaveProperty('nik');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('password salah → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-pengurus@kopra.id', password: 'salah' })
      .expect(401);
  });

  it('GET /auth/me butuh bearer valid', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-anggota@kopra.id', password: 'kopra123' });
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.role).toBe('ANGGOTA');
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
