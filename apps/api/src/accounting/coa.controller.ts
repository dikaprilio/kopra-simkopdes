import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { CoaService } from './coa.service';
import { CreateCoaDto } from './dto/create-coa.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('coa')
export class CoaController {
  constructor(private readonly coa: CoaService) {}

  @Get() // read: semua role login (transparansi ANGGOTA)
  list(@CurrentUser() u: JwtPayload, @Query('tree') tree?: string) {
    return this.coa.list(u.koperasiId, tree === 'true');
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateCoaDto) {
    return this.coa.create(u.koperasiId, dto);
  }
}
