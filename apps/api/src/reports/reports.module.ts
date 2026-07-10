import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { DashboardController } from './dashboard.controller';

@Module({ controllers: [ReportsController, DashboardController] })
export class ReportsModule {}
