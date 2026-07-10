import { Module } from '@nestjs/common';
import { WaCoreModule } from '../whatsapp/wa-core.module';
import { TokensService } from './tokens.service';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';

@Module({
  imports: [WaCoreModule],
  controllers: [RegistrationController],
  providers: [TokensService, RegistrationService],
  exports: [TokensService, RegistrationService],
})
export class RegistrationModule {}
