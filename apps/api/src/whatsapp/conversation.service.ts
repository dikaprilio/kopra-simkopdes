import { Injectable, Logger } from '@nestjs/common';
import { InboundMessage } from './gateway';
import { OutboxService } from './outbox.service';
import { DedupService } from './dedup.service';

/**
 * PLACEHOLDER M2 — diganti orchestrator penuh di M4
 * (YA/BATAL/koreksi state machine + agent Mastra + guest flow).
 * Sekarang: DM dibalas ack supaya jalur webhook→outbox bisa diverifikasi end-to-end.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly dedup: DedupService,
  ) {}

  async onMessage(m: InboundMessage): Promise<void> {
    try {
      if (m.isGroup) {
        // M7: konteks grup + mention-only. Sementara: diam.
        await this.dedup.markResult(m.deviceId, m.messageId, 'IGNORED');
        return;
      }
      await this.outbox.enqueue(
        m.chatJid,
        `🤖 Kopra (dev M2): pesan diterima — "${m.text.slice(0, 100)}"`,
      );
      await this.dedup.markResult(m.deviceId, m.messageId, 'PROCESSED');
    } catch (e) {
      this.logger.error(`onMessage gagal: ${(e as Error).message}`);
      await this.dedup.markResult(m.deviceId, m.messageId, 'ERROR').catch(() => undefined);
    }
  }
}
