import { prisma } from '@kopra/db';
import { GroupService } from './group.service';
import { OutboxService } from './outbox.service';
import { GowaClient, type InboundMessage } from './gateway';
import { AgentClient, type ActorContext } from './agent-client';

/** F-GRUP: auto-bind, mention-only, binding manual, konteks bounded. */

const GJID = '120363999000111@g.us';
const GJID2 = '120363999000222@g.us';
const WA_PENGURUS = '628660001';
const WA_LAIN = '628660009'; // tidak terdaftar

let kid: string;
let participantsMock: jest.Mock;
let agentMock: jest.Mock<Promise<string>, [string, ActorContext]>;
let svc: GroupService;

const gmsg = (from: string, text: string, gjid = GJID): InboundMessage => ({
  deviceId: 'jest-grp',
  messageId: `GM-${Math.random().toString(36).slice(2)}`,
  chatJid: gjid,
  senderNumber: from,
  text,
  isGroup: true,
  fromName: 'Tester',
});

const lastOutbox = async (toJid: string) =>
  (
    await prisma.outboundWhatsappMessage.findFirst({
      where: { toJid },
      orderBy: { createdAt: 'desc' },
    })
  )?.text ?? '';

beforeAll(async () => {
  const kop = await prisma.koperasi.upsert({
    where: { sourceRef: 'JEST-GRP' },
    update: {},
    create: { nama: 'KDMP Grup Jest', sourceRef: 'JEST-GRP', origin: 'LOCAL' },
  });
  kid = kop.id;
  const user = await prisma.user.upsert({
    where: { email: 'jest-grp@kopra.id' },
    update: { koperasiId: kid },
    create: { email: 'jest-grp@kopra.id', passwordHash: 'x', name: 'Pengurus Grup', role: 'PENGURUS', koperasiId: kid },
  });
  await prisma.whatsappIdentity.upsert({
    where: { waNumber: WA_PENGURUS },
    update: { userId: user.id, koperasiId: kid },
    create: { waNumber: WA_PENGURUS, userId: user.id, koperasiId: kid },
  });

  participantsMock = jest.fn();
  agentMock = jest.fn<Promise<string>, [string, ActorContext]>(async () => 'JAWABAN_GRUP');
  const gowa = { getGroupParticipants: participantsMock } as unknown as GowaClient;
  const agent = { ask: agentMock } as unknown as AgentClient;
  svc = new GroupService(gowa, new OutboxService(new GowaClient()), agent);
});

beforeEach(async () => {
  participantsMock.mockReset();
  agentMock.mockClear();
  await prisma.waGroup.deleteMany({ where: { groupJid: { in: [GJID, GJID2] } } });
  await prisma.outboundWhatsappMessage.deleteMany({ where: { toJid: { in: [GJID, GJID2] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GroupService', () => {
  it('mention detection: @Kopra case-insensitive; teks biasa tidak', () => {
    expect(GroupService.isMention('@Kopra stok gas?')).toBe(true);
    expect(GroupService.isMention('halo @kopra')).toBe(true);
    expect(GroupService.isMention('kopra bagus ya')).toBe(false);
  });

  it('auto-bind: participant scan 1 koperasi → ATTACHED + pengumuman', async () => {
    participantsMock.mockResolvedValue([WA_PENGURUS, WA_LAIN]);
    const res = await svc.onGroupMessage(gmsg(WA_LAIN, 'halo semua'));
    expect(res).toBe('IGNORED'); // non-mention tetap diam…
    const group = await prisma.waGroup.findUnique({ where: { groupJid: GJID } });
    expect(group?.status).toBe('ATTACHED');
    expect(group?.koperasiId).toBe(kid);
    expect(await lastOutbox(GJID)).toContain('KDMP Grup Jest'); // …tapi pengumuman bind terkirim
  });

  it('non-mention di grup ATTACHED → diam, hanya disimpan sebagai konteks', async () => {
    participantsMock.mockResolvedValue([WA_PENGURUS]);
    await svc.onGroupMessage(gmsg(WA_LAIN, 'pesan pembuka'));
    await prisma.outboundWhatsappMessage.deleteMany({ where: { toJid: GJID } });
    const res = await svc.onGroupMessage(gmsg(WA_LAIN, 'ngobrol biasa saja'));
    expect(res).toBe('IGNORED');
    expect(agentMock).not.toHaveBeenCalled();
    expect(await lastOutbox(GJID)).toBe('');
    const stored = await prisma.waGroupMessage.count({ where: { groupJid: GJID } });
    expect(stored).toBe(2);
  });

  it('mention di grup ATTACHED → agent ctx GROUP + konteks pesan sebelumnya', async () => {
    participantsMock.mockResolvedValue([WA_PENGURUS]);
    await svc.onGroupMessage(gmsg(WA_LAIN, 'gas lpg masih ada nggak ya'));
    await svc.onGroupMessage(gmsg(WA_PENGURUS, '@Kopra stok gas masih berapa?'));
    expect(agentMock).toHaveBeenCalledTimes(1);
    const [prompt, actor] = agentMock.mock.calls[0];
    expect(prompt).toContain('gas lpg masih ada'); // konteks grup ikut
    expect(prompt).toContain('stok gas masih berapa'); // pertanyaan tanpa @Kopra
    expect(prompt).not.toContain('@Kopra');
    expect(actor).toMatchObject({ role: 'PENGURUS', channel: 'GROUP', koperasiId: kid });
    expect(await lastOutbox(GJID)).toBe('JAWABAN_GRUP');
  });

  it('mention pengirim tak terdaftar → tetap dijawab sebagai GUEST (Q&A publik)', async () => {
    participantsMock.mockResolvedValue([WA_PENGURUS]);
    await svc.onGroupMessage(gmsg(WA_LAIN, '@Kopra apa itu simpanan wajib?'));
    const [, actor] = agentMock.mock.calls[0];
    expect(actor.role).toBe('GUEST');
    expect(actor.channel).toBe('GROUP');
  });

  it('scan gagal/multi → UNRESOLVED; mention user terdaftar + nama koperasi → bind manual', async () => {
    participantsMock.mockRejectedValue(new Error('gowa mati'));
    await svc.onGroupMessage(gmsg(WA_LAIN, '@Kopra halo', GJID2));
    expect(await lastOutbox(GJID2)).toContain('belum terhubung');

    participantsMock.mockRejectedValue(new Error('gowa mati'));
    await svc.onGroupMessage(gmsg(WA_PENGURUS, '@Kopra ini grup KDMP Grup Jest ya', GJID2));
    const group = await prisma.waGroup.findUnique({ where: { groupJid: GJID2 } });
    expect(group?.status).toBe('ATTACHED');
    expect(group?.koperasiId).toBe(kid);
    expect(group?.boundByUserId).toBeTruthy();
    expect(await lastOutbox(GJID2)).toContain('terhubung ke *KDMP Grup Jest*');
  });

  it('prune: konteks dibatasi 50 pesan terbaru', async () => {
    participantsMock.mockResolvedValue([WA_PENGURUS]);
    for (let i = 0; i < 55; i++) {
      await svc.onGroupMessage(gmsg(WA_LAIN, `pesan ke-${i}`));
    }
    const count = await prisma.waGroupMessage.count({ where: { groupJid: GJID } });
    expect(count).toBe(50);
  });
});
