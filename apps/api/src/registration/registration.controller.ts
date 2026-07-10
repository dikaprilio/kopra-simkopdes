import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RegistrationService, RegError } from './registration.service';
import { TokenError } from './tokens.service';

/**
 * Kontrak utk web (UI = workstream Aldio):
 *  - GET  /api/v1/registration/koperasi?q=  → pilihan koperasi (form & guest flow)
 *  - POST /api/v1/registration/complete-wa  → submit form magic-link WA
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
}
