import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [MembersController, UnitsController, ProductsController, StockController],
  providers: [MembersService, UnitsService, ProductsService, StockService],
})
export class KoperasiModule {}
