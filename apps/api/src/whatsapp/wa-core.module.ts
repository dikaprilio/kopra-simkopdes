import { Module } from '@nestjs/common';
import { GowaClient } from './gateway';
import { DedupService } from './dedup.service';
import { OutboxService } from './outbox.service';
import { AzureSttService } from './stt.service';

/** Plumbing WA murni (tanpa logika percakapan) — dipakai WhatsappModule & RegistrationModule. */
@Module({
  providers: [GowaClient, DedupService, OutboxService, AzureSttService],
  exports: [GowaClient, DedupService, OutboxService, AzureSttService],
})
export class WaCoreModule {}
