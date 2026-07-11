import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock-movements')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() query: Record<string, string>) {
    return this.stock.list(u.koperasiId, query);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateStockMovementDto) {
    return this.stock.create(u.koperasiId, u.sub, dto);
  }

  @Post(':id/confirm')
  @Roles('PENGURUS', 'OWNER')
  confirm(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.stock.confirm(u.koperasiId, u.sub, id);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  cancel(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.stock.cancel(u.koperasiId, u.sub, id);
  }
}
