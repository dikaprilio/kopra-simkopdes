import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { JournalService } from './journal.service';
import { CreateSimpleEntryDto } from './dto/create-simple-entry.dto';
import { CreateManualJournalDto, ReverseJournalDto } from './dto/create-manual-journal.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('journals')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() q: Record<string, string>) {
    return this.journal.list(u.koperasiId, q);
  }

  @Get(':id')
  get(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.get(u.koperasiId, id);
  }

  @Post('simple')
  @Roles('PENGURUS', 'OWNER')
  createSimple(@CurrentUser() u: JwtPayload, @Body() dto: CreateSimpleEntryDto) {
    return this.journal.createSimple(u.koperasiId, u.sub, dto);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  createManual(@CurrentUser() u: JwtPayload, @Body() dto: CreateManualJournalDto) {
    return this.journal.createManual(u.koperasiId, u.sub, dto);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CreateManualJournalDto) {
    return this.journal.updateDraft(u.koperasiId, u.sub, id, dto);
  }

  @Post(':id/confirm')
  @Roles('PENGURUS', 'OWNER')
  confirm(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.confirm(u.koperasiId, u.sub, id);
  }

  @Post(':id/reversal')
  @Roles('PENGURUS', 'OWNER')
  reverse(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ReverseJournalDto) {
    return this.journal.reverse(u.koperasiId, u.sub, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.journal.remove(u.koperasiId, u.sub, id);
  }
}
