import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { RegistrationModule } from './registration/registration.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [WhatsappModule, RegistrationModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
