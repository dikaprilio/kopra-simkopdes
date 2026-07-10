import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { MembersService } from './members.service';
import { PaySavingsDto } from './dto/pay-savings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: Record<string, string>) {
    return this.members.list(u.koperasiId, q);
  }

  @Get(':id/simpanan')
  savings(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.members.savings(u.koperasiId, id);
  }

  @Post(':id/simpanan/pay')
  @Roles('PENGURUS', 'OWNER')
  pay(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: PaySavingsDto) {
    return this.members.pay(u.koperasiId, u.sub, id, dto.savingIds);
  }
}
