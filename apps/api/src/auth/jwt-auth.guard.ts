import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
