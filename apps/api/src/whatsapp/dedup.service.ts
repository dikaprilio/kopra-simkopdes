import { Injectable } from '@nestjs/common';
import { prisma } from '@kopra/db';

/** Idempotensi inbound: satu (deviceId,eventId) diproses tepat sekali. */
@Injectable()
export class DedupService {
  /** true = pesan baru (lanjut proses); false = duplikat (abaikan). */
  async markSeen(deviceId: string, eventId: string): Promise<boolean> {
    try {
      await prisma.inboundWhatsappEvent.create({ data: { deviceId, eventId } });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return false; // unique violation
      throw e;
    }
  }

  async markResult(deviceId: string, eventId: string, result: 'PROCESSED' | 'IGNORED' | 'ERROR') {
    await prisma.inboundWhatsappEvent.updateMany({
      where: { deviceId, eventId },
      data: { result },
    });
  }
}
