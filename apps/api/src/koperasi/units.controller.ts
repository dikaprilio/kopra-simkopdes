import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { UnitsService } from './units.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() query: Record<string, string>) {
    return this.units.list(u.koperasiId, query);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateUnitDto) {
    return this.units.create(u.koperasiId, u.sub, dto);
  }

  @Get(':id')
  detail(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.units.detail(u.koperasiId, id);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(u.koperasiId, u.sub, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  archive(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.units.archive(u.koperasiId, u.sub, id);
  }
}
