import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RegistrationService, RegError } from './registration.service';
import { TokenError } from './tokens.service';

/**
 * Kontrak utk web (UI = workstream Aldio):
 *  - GET  /api/v1/registration/koperasi?q=    → pilihan koperasi (form & guest flow)
 *  - POST /api/v1/registration/complete-wa    → submit form magic-link WA
 *  - POST /api/v1/registration/start-web      → mulai registrasi web-first (kirim OTP)
 *  - POST /api/v1/registration/verify-otp     → verifikasi OTP web-first → toPending()
 *  - POST /api/v1/registration/resend-otp     → kirim ulang OTP (rate limit 60s)
 */
@Controller('registration')
export class RegistrationController {
  constructor(private readonly reg: RegistrationService) {}

  @Get('koperasi')
  async search(@Query('q') q?: string) {
    if (!q || q.trim().length < 3) return { options: [] };
    return { options: await this.reg.searchKoperasi(q.trim()) };
  }

  @Post('complete-wa')
  async completeWa(
    @Body() body: { token?: string; nama?: string; nik?: string; password?: string },
  ) {
    const { token, nama, nik, password } = body ?? {};
    if (!token || !nama || !nik || !password)
      throw new BadRequestException('token, nama, nik, dan password wajib diisi.');
    if (!/^\d{16}$/.test(nik)) throw new BadRequestException('NIK harus 16 digit angka.');
    if (password.length < 6) throw new BadRequestException('Password minimal 6 karakter.');
    try {
      return await this.reg.completeWaForm({ token, nama: nama.trim(), nik, password });
    } catch (e) {
      if (e instanceof TokenError || e instanceof RegError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Post('start-web')
  async startWeb(
    @Body()
    body: {
      nama?: string;
      nik?: string;
      password?: string;
      waNumber?: string;
      role?: string;
      koperasiRef?: string;
    },
  ) {
    const { nama, nik, password, waNumber, role, koperasiRef } = body ?? {};
    if (!nama || !nik || !password || !waNumber || !role || !koperasiRef)
      throw new BadRequestException(
        'nama, nik, password, waNumber, role, dan koperasiRef wajib diisi.',
      );
    if (!/^\d{16}$/.test(nik)) throw new BadRequestException('NIK harus 16 digit angka.');
    if (password.length < 6) throw new BadRequestException('Password minimal 6 karakter.');
    if (!/^62\d+$/.test(waNumber)) throw new BadRequestException('waNumber harus diawali 62 & berupa angka.');
    if (role !== 'PENGURUS' && role !== 'ANGGOTA')
      throw new BadRequestException('role harus PENGURUS atau ANGGOTA.');
    try {
      return await this.reg.startWebRegistration({
        nama: nama.trim(),
        nik,
        password,
        waNumber,
        role,
        koperasiRef,
      });
    } catch (e) {
      this.throwHttpError(e);
    }
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { waNumber?: string; code?: string }) {
    const { waNumber, code } = body ?? {};
    if (!waNumber || !code) throw new BadRequestException('waNumber dan code wajib diisi.');
    try {
      return await this.reg.verifyWebOtp(waNumber, code);
    } catch (e) {
      this.throwHttpError(e);
    }
  }

  @Post('resend-otp')
  async resendOtp(@Body() body: { waNumber?: string }) {
    const { waNumber } = body ?? {};
    if (!waNumber) throw new BadRequestException('waNumber wajib diisi.');
    try {
      return await this.reg.resendWebOtp(waNumber);
    } catch (e) {
      this.throwHttpError(e);
    }
  }

  /** RegError/TokenError → BadRequestException dgn body {code, message} (kode dipakai UI web). */
  private throwHttpError(e: unknown): never {
    if (e instanceof RegError || e instanceof TokenError)
      throw new BadRequestException({ code: e.code, message: e.message });
    throw e;
  }
}
