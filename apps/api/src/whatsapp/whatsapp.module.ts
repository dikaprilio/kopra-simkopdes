import { Module } from '@nestjs/common';
import { GowaClient } from './gateway';
import { DedupService } from './dedup.service';
import { OutboxService } from './outbox.service';
import { ConversationService } from './conversation.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [WebhookController],
  providers: [GowaClient, DedupService, OutboxService, ConversationService],
  exports: [OutboxService, GowaClient],
})
export class WhatsappModule {}
