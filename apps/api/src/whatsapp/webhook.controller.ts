import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { parseWebhook, verifySignature } from './gateway';
import { DedupService } from './dedup.service';
import { ConversationService } from './conversation.service';

@Controller('whatsapp')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly dedup: DedupService,
    private readonly conversation: ConversationService,
  ) {}

  /** GoWA webhook — URL penuh: POST /api/v1/whatsapp/webhook (cocok start-gowa.cmd). */
  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const raw = req.rawBody;
    const secret = process.env.WA_WEBHOOK_SECRET ?? 'kopra-webhook-dev-secret';
    if (!raw || !verifySignature(raw, signature, secret)) {
      throw new UnauthorizedException('Signature tidak valid');
    }

    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return { status: 'ignored' };
    }

    const msg = parseWebhook(body);
    if (!msg) return { status: 'ignored' };

    const fresh = await this.dedup.markSeen(msg.deviceId, msg.messageId);
    if (!fresh) return { status: 'duplicate' };

    // fire-and-forget: GoWA harus cepat dapat 200; proses lanjut async
    void this.conversation.onMessage(msg).catch((e: Error) => {
      this.logger.error(`Proses pesan ${msg.messageId} gagal: ${e.message}`);
    });
    return { status: 'ok' };
  }
}
