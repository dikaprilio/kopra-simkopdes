import { prisma } from '@kopra/db';
import { createDraftFromSimple, createPending, getAwaiting } from '@kopra/core';
import { ConversationService } from './conversation.service';
import { OutboxService } from './outbox.service';
import { DedupService } from './dedup.service';
import { AgentClient, type ActorContext } from './agent-client';
import { GowaClient, type InboundMessage } from './gateway';
import { AzureSttService } from './stt.service';

/**
 * Integrasi orchestrator DM vs DB kopra_test — agent DI-MOCK (deterministik),
 * core & prisma ASLI (yang diuji memang state machine + efek DB).
 */

const WA_PENGURUS = '628990001';
const WA_GUEST = '628990009';
const JID = (n: string) => `${n}@s.whatsapp.net`;

let svc: ConversationService;
let agentMock: jest.Mock<Promise<string>, [string, ActorContext]>;
const fetchMediaMock = jest.fn(async () => ({ buffer: Buffer.from('ogg'), mime: 'audio/ogg' }));
const sttMock = jest.fn(async (_b: Buffer, _m: string) => 'TRANSKRIP');
let kid: string;
let pengurusId: string;

const msg = (from: string, text: string, id?: string): InboundMessage => ({
  deviceId: 'jest-conv',
  messageId: id ?? `C-${Math.random().toString(36).slice(2)}`,
  chatJid: JID(from),
  senderNumber: from,
  text,
  isGroup: false,
});

async function lastReply(toJid: string): Promise<string> {
  const row = await prisma.outboundWhatsappMessage.findFirst({
    where: { toJid },
    orderBy: { createdAt: 'desc' },
  });
  return row?.text ?? '';
}

beforeAll(async () => {
  // fixtures minimal: koperasi + COA kas/pendapatan + user pengurus + identity WA
  await prisma.whatsappIdentity.deleteMany({ where: { waNumber: { startsWith: '62899' } } });
  const kop = await prisma.koperasi.upsert({
    where: { sourceRef: 'JEST-CONV' },
    update: {},
    create: { nama: 'Koperasi Jest Conv', sourceRef: 'JEST-CONV', origin: 'LOCAL' },
  });
  kid = kop.id;
  for (const [kode, nama, type] of [
    ['111000', 'Kas Rupiah', 'ASSET'],
    ['410000', 'Pendapatan Penjualan', 'REVENUE'],
  ] as const) {
    await prisma.coaAccount.upsert({
      where: { koperasiId_kode: { koperasiId: kid, kode } },
      update: {},
      create: { koperasiId: kid, kode, nama, type },
    });
  }
  const user = await prisma.user.upsert({
    where: { email: 'jest-conv@kopra.id' },
    update: { koperasiId: kid },
    create: {
      email: 'jest-conv@kopra.id',
      passwordHash: 'x',
      name: 'Pengurus Jest',
      role: 'PENGURUS',
      koperasiId: kid,
    },
  });
  pengurusId = user.id;
  await prisma.whatsappIdentity.create({
    data: { waNumber: WA_PENGURUS, userId: pengurusId, koperasiId: kid },
  });

  agentMock = jest.fn(async () => 'JAWABAN_AGENT');
  const agent = { ask: agentMock } as unknown as AgentClient;
  const outbox = new OutboxService(new GowaClient());
  const guestReg = { handle: async () => null } as never; // alur DAFTAR diuji di registration.spec
  const superAdmin = { handle: async () => 'SA' } as never;
  const group = { onGroupMessage: async () => 'IGNORED' as const } as never; // diuji di group.service.spec
  const gowaMedia = { fetchMedia: fetchMediaMock } as unknown as GowaClient;
  const stt = { transcribe: sttMock } as unknown as AzureSttService;
  svc = new ConversationService(outbox, new DedupService(), agent, guestReg, superAdmin, group, gowaMedia, stt);
});

beforeEach(async () => {
  agentMock.mockClear();
  fetchMediaMock.mockClear();
  sttMock.mockClear();
  sttMock.mockImplementation(async () => 'TRANSKRIP');
  await prisma.pendingAction.deleteMany({ where: { koperasiId: kid } });
  await prisma.outboundWhatsappMessage.deleteMany({
    where: { OR: [{ toJid: { contains: '62899' } }, { toJid: '1203@g.us' }] },
  });
  await prisma.journalEntry.deleteMany({ where: { koperasiId: kid } });
  await prisma.inboundWhatsappEvent.deleteMany({ where: { deviceId: 'jest-conv' } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function buatDraftPending(amount = 500000) {
  const draft = await createDraftFromSimple(pengurusId, {
    koperasiId: kid,
    kind: 'INCOME',
    amount,
    description: 'penjualan tes',
  });
  await createPending({
    chatJid: JID(WA_PENGURUS),
    actorId: pengurusId,
    koperasiId: kid,
    actionType: 'JOURNAL_SIMPLE',
    payload: { previewText: `Draft ${amount}`, entryId: draft.entry.id, via: 'KAS' },
  });
  return draft.entry.id;
}

describe('ConversationService (DM state machine)', () => {
  it('guest: sapaan pertama → intro berisi DAFTAR, tanpa panggil agent', async () => {
    await svc.onMessage(msg(WA_GUEST, 'halo'));
    const reply = await lastReply(JID(WA_GUEST));
    expect(reply).toContain('DAFTAR');
    expect(reply).toContain('Kopra');
    expect(agentMock).not.toHaveBeenCalled();
  });

  it('guest: pertanyaan → agent ctx GUEST tetap dijawab (RAG publik)', async () => {
    await svc.onMessage(msg(WA_GUEST, 'apa bedanya simpanan pokok dan wajib?'));
    expect(agentMock).toHaveBeenCalledTimes(1);
    expect(agentMock.mock.calls[0][1].role).toBe('GUEST');
    expect(await lastReply(JID(WA_GUEST))).toContain('JAWABAN_AGENT');
  });

  it('pengurus tanpa pending → diteruskan ke agent dgn identitas benar', async () => {
    await svc.onMessage(msg(WA_PENGURUS, 'pemasukan bulan ini berapa?'));
    const [text, actor] = agentMock.mock.calls[0];
    expect(text).toContain('pemasukan');
    expect(actor).toMatchObject({ role: 'PENGURUS', koperasiId: kid, actorId: pengurusId });
    expect(await lastReply(JID(WA_PENGURUS))).toBe('JAWABAN_AGENT');
  });

  it('YA → jurnal CONFIRMED + balasan nomor jurnal + saldo; YA kedua tidak dobel', async () => {
    const entryId = await buatDraftPending();
    await svc.onMessage(msg(WA_PENGURUS, 'YA'));
    const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
    expect(entry?.status).toBe('CONFIRMED');
    const reply = await lastReply(JID(WA_PENGURUS));
    expect(reply).toContain('✅ Tersimpan!');
    expect(reply).toContain(entry?.nomor);
    expect(reply).toContain('Rp500.000');

    await svc.onMessage(msg(WA_PENGURUS, 'ya'));
    expect(await lastReply(JID(WA_PENGURUS))).toContain('Tidak ada draft');
    const count = await prisma.journalEntry.count({ where: { koperasiId: kid, status: 'CONFIRMED' } });
    expect(count).toBe(1); // tidak dobel
  });

  it('BATAL → draft dihapus, pending CANCELLED', async () => {
    const entryId = await buatDraftPending();
    await svc.onMessage(msg(WA_PENGURUS, 'gajadi'));
    expect(await lastReply(JID(WA_PENGURUS))).toContain('dibatalkan');
    expect(await prisma.journalEntry.findUnique({ where: { id: entryId } })).toBeNull();
    expect(await getAwaiting(JID(WA_PENGURUS))).toBeNull();
  });

  it('koreksi saat ada pending → draft lama dibuang, agent diminta buat ulang', async () => {
    const entryId = await buatDraftPending();
    await svc.onMessage(msg(WA_PENGURUS, 'eh salah, 450rb lewat bank'));
    expect(await prisma.journalEntry.findUnique({ where: { id: entryId } })).toBeNull(); // draft lama hilang
    const [prompt] = agentMock.mock.calls[0];
    expect(prompt).toContain('mengoreksi');
    expect(prompt).toContain('450rb');
    expect(prompt).toContain('Draft 500000'); // preview lama ikut sebagai konteks
  });

  it('pesan grup → diam (IGNORED), tanpa outbox tanpa agent', async () => {
    await svc.onMessage({ ...msg(WA_PENGURUS, 'halo semua'), isGroup: true, chatJid: '1203@g.us' });
    expect(agentMock).not.toHaveBeenCalled();
    expect(await lastReply('1203@g.us')).toBe('');
  });
});

describe('Voice note (STT)', () => {
  const vn = (from: string, id?: string): InboundMessage => ({
    ...msg(from, ''),
    ...(id ? { messageId: id } : {}),
    kind: 'voice',
    audioPath: 'statics/media/jest-vn.oga',
  });

  it('VN pengurus → transkrip jadi teks agent + balasan ber-prefix 🎤', async () => {
    sttMock.mockImplementation(async () => 'pemasukan bulan ini berapa');
    await svc.onMessage(vn(WA_PENGURUS));
    expect(fetchMediaMock).toHaveBeenCalledWith('statics/media/jest-vn.oga');
    const [text, actor] = agentMock.mock.calls[0];
    expect(text).toBe('pemasukan bulan ini berapa');
    expect(actor).toMatchObject({ role: 'PENGURUS' });
    const reply = await lastReply(JID(WA_PENGURUS));
    expect(reply).toContain('🎤');
    expect(reply).toContain('pemasukan bulan ini berapa');
    expect(reply).toContain('JAWABAN_AGENT');
  });

  it('VN "Iya." (transkrip bertanda baca) mengkonfirmasi pending → CONFIRMED', async () => {
    const entryId = await buatDraftPending();
    sttMock.mockImplementation(async () => 'Iya.');
    await svc.onMessage(vn(WA_PENGURUS));
    const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
    expect(entry?.status).toBe('CONFIRMED');
    const reply = await lastReply(JID(WA_PENGURUS));
    expect(reply).toContain('🎤');
    expect(reply).toContain('✅ Tersimpan!');
  });

  it('STT gagal → pesan sopan, tanpa agent', async () => {
    sttMock.mockImplementation(async () => {
      throw new Error('azure down');
    });
    await svc.onMessage(vn(WA_PENGURUS));
    expect(agentMock).not.toHaveBeenCalled();
    expect(await lastReply(JID(WA_PENGURUS))).toContain('tidak bisa saya proses');
  });

  it('transkrip kosong → minta ulang, tanpa agent', async () => {
    sttMock.mockImplementation(async () => '');
    await svc.onMessage(vn(WA_PENGURUS));
    expect(agentMock).not.toHaveBeenCalled();
    expect(await lastReply(JID(WA_PENGURUS))).toContain('kurang jelas');
  });

  it('VN di grup → diam total (tanpa STT, tanpa outbox)', async () => {
    await svc.onMessage({ ...vn(WA_PENGURUS), isGroup: true, chatJid: '1203@g.us' });
    expect(sttMock).not.toHaveBeenCalled();
    expect(agentMock).not.toHaveBeenCalled();
    expect(await lastReply('1203@g.us')).toBe('');
  });
});
