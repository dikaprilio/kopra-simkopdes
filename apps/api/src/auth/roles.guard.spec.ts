/**
 * Unit spec — RolesGuard. Mock ExecutionContext + Reflector, tanpa DB.
 * Menutup footgun temuan review Task 1: canActivate() dereference
 * req.user.status tanpa guard — kalau guard ini terpasang di route yang
 * lupa JwtAuthGuard, user undefined → TypeError (500), bukan 401.
 */
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { JwtPayload } from './jwt-payload';

function makeContext(user: JwtPayload | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(roles: string[] | undefined): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('user undefined → UnauthorizedException (bukan TypeError 500)', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
  });

  it('status PENDING_APPROVAL → ForbiddenException AKUN_PENDING', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    const user: JwtPayload = { sub: 'u1', koperasiId: 'k1', role: 'ANGGOTA', status: 'PENDING_APPROVAL' };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext(user))).toThrow('AKUN_PENDING');
  });

  it('ACTIVE + tanpa metadata @Roles → lolos', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    const user: JwtPayload = { sub: 'u1', koperasiId: 'k1', role: 'ANGGOTA', status: 'ACTIVE' };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('ACTIVE ANGGOTA vs @Roles(PENGURUS,OWNER) → ForbiddenException PERAN_TIDAK_CUKUP', () => {
    const guard = new RolesGuard(makeReflector(['PENGURUS', 'OWNER']));
    const user: JwtPayload = { sub: 'u1', koperasiId: 'k1', role: 'ANGGOTA', status: 'ACTIVE' };
    expect(() => guard.canActivate(makeContext(user))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext(user))).toThrow('PERAN_TIDAK_CUKUP');
  });

  it('ACTIVE PENGURUS vs @Roles(PENGURUS,OWNER) → lolos', () => {
    const guard = new RolesGuard(makeReflector(['PENGURUS', 'OWNER']));
    const user: JwtPayload = { sub: 'u1', koperasiId: 'k1', role: 'PENGURUS', status: 'ACTIVE' };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });
});
