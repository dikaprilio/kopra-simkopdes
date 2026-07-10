import { Controller, Get, UseGuards } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-units')
export class UnitsController {
  @Get()
  list(@CurrentUser() u: JwtPayload) {
    return prisma.businessUnit.findMany({ where: { koperasiId: u.koperasiId }, orderBy: { nama: 'asc' } });
  }
}
