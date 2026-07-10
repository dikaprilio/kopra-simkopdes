import { Module } from '@nestjs/common';
import { GowaClient } from './gateway';
import { DedupService } from './dedup.service';
import { OutboxService } from './outbox.service';
import { AgentClient } from './agent-client';
import { ConversationService } from './conversation.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [WebhookController],
  providers: [GowaClient, DedupService, OutboxService, AgentClient, ConversationService],
  exports: [OutboxService, GowaClient],
})
export class WhatsappModule {}
