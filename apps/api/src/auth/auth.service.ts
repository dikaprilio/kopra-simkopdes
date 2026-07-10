import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { prisma } from '@kopra/db';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.koperasiId) throw new UnauthorizedException('KREDENSIAL_SALAH');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('KREDENSIAL_SALAH');
    const payload: JwtPayload = { sub: user.id, koperasiId: user.koperasiId, role: user.role, status: user.status };
    return {
      token: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, koperasiId: user.koperasiId },
    };
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, name: user.name, email: user.email, role: user.role, koperasiId: user.koperasiId };
  }
}
