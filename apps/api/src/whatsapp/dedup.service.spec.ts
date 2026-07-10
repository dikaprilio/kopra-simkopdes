import { prisma } from '@kopra/db';
import { DedupService } from './dedup.service';

describe('DedupService (DB kopra_test)', () => {
  const svc = new DedupService();
  const deviceId = 'jest-dev';

  beforeAll(async () => {
    await prisma.inboundWhatsappEvent.deleteMany({ where: { deviceId } });
  });

  afterAll(async () => {
    await prisma.inboundWhatsappEvent.deleteMany({ where: { deviceId } });
    await prisma.$disconnect();
  });

  it('pesan baru → true; pesan sama dobel → false (webhook redelivery aman)', async () => {
    expect(await svc.markSeen(deviceId, 'EVT-1')).toBe(true);
    expect(await svc.markSeen(deviceId, 'EVT-1')).toBe(false);
    expect(await svc.markSeen(deviceId, 'EVT-2')).toBe(true); // eventId lain tetap masuk
  });

  it('markResult menyimpan status proses', async () => {
    await svc.markSeen(deviceId, 'EVT-3');
    await svc.markResult(deviceId, 'EVT-3', 'PROCESSED');
    const row = await prisma.inboundWhatsappEvent.findUnique({
      where: { deviceId_eventId: { deviceId, eventId: 'EVT-3' } },
    });
    expect(row?.result).toBe('PROCESSED');
  });
});
