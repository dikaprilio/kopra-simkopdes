import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { GowaClient } from './gateway';

const POLL_MS = 2_000;
const RATE_GAP_MS = 1_100; // ≤1 pesan/detik
const MAX_ATTEMPTS = 5;

/**
 * Outbox pattern: semua balasan bot ditulis ke DB dulu, worker ini yang
 * mengirim ke GoWA dengan retry backoff. Restart-safe (state di DB).
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(private readonly gowa: GowaClient) {}

  async enqueue(toJid: string, text: string): Promise<void> {
    await prisma.outboundWhatsappMessage.create({ data: { toJid, text } });
  }

  onModuleInit() {
    if (process.env.WA_OUTBOX_DISABLED === '1') {
      this.logger.warn('Outbox worker NONAKTIF (WA_OUTBOX_DISABLED=1) — pesan hanya antre di DB');
      return;
    }
    this.timer = setInterval(() => void this.drain(), POLL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sekali jalan proses antrean; dipakai juga oleh test. */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const batch = await prisma.outboundWhatsappMessage.findMany({
        where: { status: 'QUEUED', nextTryAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });
      for (const msg of batch) {
        try {
          await this.gowa.sendTextDirect(msg.toJid, msg.text);
          await prisma.outboundWhatsappMessage.update({
            where: { id: msg.id },
            data: { status: 'SENT', attempts: msg.attempts + 1 },
          });
        } catch (e) {
          const attempts = msg.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          await prisma.outboundWhatsappMessage.update({
            where: { id: msg.id },
            data: {
              attempts,
              status: failed ? 'FAILED' : 'QUEUED',
              nextTryAt: new Date(Date.now() + 2 ** attempts * 5_000), // 10s,20s,40s,…
            },
          });
          this.logger.warn(
            `Kirim ke ${msg.toJid} gagal (attempt ${attempts}${failed ? ', FAILED' : ''}): ${(e as Error).message}`,
          );
        }
        await new Promise((r) => setTimeout(r, RATE_GAP_MS));
      }
    } finally {
      this.draining = false;
    }
  }
}
