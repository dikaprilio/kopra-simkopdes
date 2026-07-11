import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { MembersService } from './members.service';
import { PaySavingsDto } from './dto/pay-savings.dto';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: Record<string, string>) {
    return this.members.list(u.koperasiId, q);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateMemberDto) {
    return this.members.create(u.koperasiId, u.sub, dto);
  }

  @Get(':id/simpanan')
  savings(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.members.savings(u.koperasiId, id);
  }

  @Get(':id')
  detail(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.members.detail(u.koperasiId, id);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(u.koperasiId, u.sub, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.members.archive(u.koperasiId, u.sub, id);
  }

  @Post(':id/simpanan/pay')
  @Roles('PENGURUS', 'OWNER')
  pay(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: PaySavingsDto) {
    return this.members.pay(u.koperasiId, u.sub, id, dto.savingIds);
  }
}
