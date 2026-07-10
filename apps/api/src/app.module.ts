import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { RegistrationModule } from './registration/registration.module';
import { AuthModule } from './auth/auth.module';
import { AccountingModule } from './accounting/accounting.module';

@Module({
  imports: [WhatsappModule, RegistrationModule, AuthModule, AccountingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
