import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() u: JwtPayload, @Query() query: { search?: string; active?: string; lowStock?: string; page?: string; pageSize?: string }) {
    return this.products.list(u.koperasiId, query);
  }

  @Get(':id/card')
  card(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.products.card(u.koperasiId, id);
  }

  @Get(':id')
  detail(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.products.detail(u.koperasiId, id);
  }

  @Post()
  @Roles('PENGURUS', 'OWNER')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateProductDto) {
    return this.products.create(u.koperasiId, u.sub, dto);
  }

  @Patch(':id')
  @Roles('PENGURUS', 'OWNER')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(u.koperasiId, u.sub, id, dto);
  }

  @Delete(':id')
  @Roles('PENGURUS', 'OWNER')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.products.remove(u.koperasiId, u.sub, id);
  }
}
