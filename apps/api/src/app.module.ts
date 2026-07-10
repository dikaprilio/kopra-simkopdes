import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { RegistrationModule } from './registration/registration.module';
import { AuthModule } from './auth/auth.module';
import { AccountingModule } from './accounting/accounting.module';
import { KoperasiModule } from './koperasi/koperasi.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [WhatsappModule, RegistrationModule, AuthModule, AccountingModule, KoperasiModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
