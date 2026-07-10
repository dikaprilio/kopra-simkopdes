import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { prisma } from '@kopra/db';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export class TokenError extends Error {
  constructor(
    public code: 'INVALID' | 'EXPIRED' | 'USED' | 'LOCKED' | 'WRONG',
    message: string,
  ) {
    super(message);
  }
}

/** Magic link (WA→web form) & OTP (web→WA) — semua disimpan HASH, bukan plaintext. */
@Injectable()
export class TokensService {
  /** Magic link single-use TTL 900s. Return URL lengkap (token hanya lewat WA user). */
  async issueMagicLink(waNumber: string, regRequestId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const ttl = Number(process.env.MAGIC_LINK_TTL_SECONDS ?? 900) * 1000;
    await prisma.authToken.create({
      data: {
        tokenHash: sha256(token),
        waNumber,
        payload: { regRequestId },
        expiresAt: new Date(Date.now() + ttl),
      },
    });
    const base = process.env.APP_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    return `${base}/register/complete?token=${token}`;
  }

  /** Konsumsi magic link (atomic: updateMany guard usedAt supaya single-use). */
  async consumeMagicLink(token: string): Promise<{ waNumber: string; regRequestId: string }> {
    const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row) throw new TokenError('INVALID', 'Tautan tidak dikenal.');
    if (row.usedAt) throw new TokenError('USED', 'Tautan sudah dipakai.');
    if (row.expiresAt < new Date())
      throw new TokenError('EXPIRED', 'Tautan kedaluwarsa (15 menit). Ketik DAFTAR lagi di WhatsApp ya.');
    const res = await prisma.authToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (res.count !== 1) throw new TokenError('USED', 'Tautan sudah dipakai.');
    const payload = row.payload as { regRequestId: string };
    return { waNumber: row.waNumber, regRequestId: payload.regRequestId };
  }

  /** OTP 6 digit TTL 600s (10 menit), hash argon2 — pengirimannya urusan pemanggil (outbox DM). */
  async issueOtp(waNumber: string, requestId?: string): Promise<string> {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const ttl = Number(process.env.OTP_TTL_SECONDS ?? 600) * 1000;
    const otpHash = await argon2.hash(otp);
    await prisma.otpChallenge.create({
      data: { waNumber, otpHash, requestId, expiresAt: new Date(Date.now() + ttl) },
    });
    return otp;
  }

  /** Waktu OTP aktif terakhir dikirim utk waNumber ini (dipakai guard resend 60s). */
  async lastOtpSentAt(waNumber: string): Promise<Date | undefined> {
    const ch = await prisma.otpChallenge.findFirst({
      where: { waNumber },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return ch?.createdAt;
  }

  /** Verifikasi OTP: max 3 percobaan per challenge, single-use. */
  async verifyOtp(waNumber: string, otp: string): Promise<{ requestId?: string }> {
    const ch = await prisma.otpChallenge.findFirst({
      where: { waNumber, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!ch) throw new TokenError('INVALID', 'Tidak ada OTP aktif. Minta kode baru ya.');
    if (ch.expiresAt < new Date()) throw new TokenError('EXPIRED', 'OTP kedaluwarsa. Minta kode baru ya.');
    if (ch.attempts >= 3) throw new TokenError('LOCKED', 'OTP terkunci (3× salah). Minta kode baru ya.');
    const ok = await argon2.verify(ch.otpHash, otp).catch(() => false);
    if (!ok) {
      await prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: ch.attempts + 1 } });
      const sisa = 3 - (ch.attempts + 1);
      throw new TokenError('WRONG', sisa > 0 ? `Kode salah. Sisa percobaan: ${sisa}.` : 'OTP terkunci (3× salah). Minta kode baru ya.');
    }
    await prisma.otpChallenge.update({ where: { id: ch.id }, data: { usedAt: new Date() } });
    return { requestId: ch.requestId ?? undefined };
  }
}
