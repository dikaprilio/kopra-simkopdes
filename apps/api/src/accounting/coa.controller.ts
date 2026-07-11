import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { CoaService } from './coa.service';
import { CreateCoaDto, UpdateCoaDto } from './dto/create-coa.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('coa')
export class CoaController {
  constructor(private readonly coa: CoaService) {}

  @Get() // read: semua role login (transparansi ANGGOTA)
  list(@CurrentUser() u: JwtPayload, @Query() query: Record<string, string>) {
    return this.coa.list(u.koperasiId, query);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateCoaDto) {
    return this.coa.create(u.koperasiId, u.sub, dto);
  }

  @Get(':id')
  detail(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.coa.detail(u.koperasiId, id);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateCoaDto) {
    return this.coa.update(u.koperasiId, u.sub, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  archive(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.coa.archive(u.koperasiId, u.sub, id);
  }
}
