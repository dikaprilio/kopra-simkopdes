import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@kopra/db';
import { ROLES_KEY } from './roles.decorator';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as JwtPayload;
    if (user.status !== 'ACTIVE') throw new ForbiddenException('AKUN_PENDING');
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    if (!required.includes(user.role)) throw new ForbiddenException('PERAN_TIDAK_CUKUP');
    return true;
  }
}
