import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@kopra/db';
import { buildReportDocument, type ReportExportPayload } from '../reports/report-export';
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

  /** Antre kirim FILE laporan (xlsx dibangun ulang saat kirim oleh drain — data selalu segar). */
  async enqueueDocument(toJid: string, caption: string, payload: ReportExportPayload): Promise<void> {
    await prisma.outboundWhatsappMessage.create({
      data: { toJid, text: caption, kind: 'DOCUMENT', payload: payload as object },
    });
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
          if (msg.kind === 'DOCUMENT') {
            const doc = await buildReportDocument(msg.payload as unknown as ReportExportPayload);
            await this.gowa.sendFileDirect(msg.toJid, doc.buffer, doc.filename, msg.text || doc.caption);
          } else {
            await this.gowa.sendTextDirect(msg.toJid, msg.text);
          }
          // updateMany: baris bisa lenyap (prune/cleanup) saat retry — JANGAN lempar P2025.
          await prisma.outboundWhatsappMessage.updateMany({
            where: { id: msg.id },
            data: { status: 'SENT', attempts: msg.attempts + 1 },
          });
        } catch (e) {
          const attempts = msg.attempts + 1;
          const failed = attempts >= MAX_ATTEMPTS;
          await prisma.outboundWhatsappMessage.updateMany({
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
          if (failed && msg.kind === 'DOCUMENT') {
            // fallback: file menyerah total → beri tautan web (baris TEXT baru, retry sendiri)
            const reportType = (msg.payload as { reportType?: string } | null)?.reportType ?? '';
            const base = process.env.APP_PUBLIC_WEB_URL ?? 'http://localhost:3000';
            await this.enqueue(
              msg.toJid,
              `😔 Maaf, file laporan gagal dikirim. Coba unduh lewat web ya: ${base}/laporan/${reportType}`,
            ).catch(() => undefined);
          }
        }
        await new Promise((r) => setTimeout(r, RATE_GAP_MS));
      }
    } catch (e) {
      // worker interval TIDAK boleh membunuh proses api (unhandled rejection)
      this.logger.error(`drain outbox gagal: ${(e as Error).message}`);
    } finally {
      this.draining = false;
    }
  }
}
