import { Controller, Get, UseGuards } from '@nestjs/common';
import { dashboardSummary } from '@kopra/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  @Get('summary')
  summary(@CurrentUser() u: JwtPayload) {
    return dashboardSummary(u.koperasiId);
  }
}
