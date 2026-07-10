import { Module } from '@nestjs/common';
import { GowaClient } from './gateway';
import { DedupService } from './dedup.service';
import { OutboxService } from './outbox.service';

/** Plumbing WA murni (tanpa logika percakapan) — dipakai WhatsappModule & RegistrationModule. */
@Module({
  providers: [GowaClient, DedupService, OutboxService],
  exports: [GowaClient, DedupService, OutboxService],
})
export class WaCoreModule {}
