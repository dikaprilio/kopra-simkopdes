import { Module } from '@nestjs/common';
import { WaCoreModule } from './wa-core.module';
import { RegistrationModule } from '../registration/registration.module';
import { AgentClient } from './agent-client';
import { GuestFlowService } from './guest-flow';
import { SuperAdminService } from './super-admin';
import { GroupService } from './group.service';
import { ConversationService } from './conversation.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [WaCoreModule, RegistrationModule],
  controllers: [WebhookController],
  providers: [AgentClient, GuestFlowService, SuperAdminService, GroupService, ConversationService],
})
export class WhatsappModule {}
