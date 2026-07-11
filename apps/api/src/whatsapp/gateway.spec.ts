import { createHmac } from 'node:crypto';
import { jidToNumber, parseWebhook, verifySignature } from './gateway';

const SECRET = 'kopra-webhook-dev-secret';
const sign = (raw: Buffer) => 'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex');

// fixture sesuai payload TERVERIFIKASI di docs/plans/notes-gowa.md
const dmPayload = {
  event: 'message',
  device_id: 'dev-01',
  session_id: 's1',
  payload: {
    id: 'MSG-001',
    chat_id: '62811111@s.whatsapp.net',
    from: '62811111:12@s.whatsapp.net',
    from_name: 'Pak Tedjo',
    timestamp: '2026-07-10T10:00:00Z',
    is_from_me: false,
    body: 'catat pemasukan banyu 500rb',
  },
};

describe('verifySignature (HMAC-SHA256)', () => {
  const raw = Buffer.from(JSON.stringify(dmPayload));

  it('menerima signature valid', () => {
    expect(verifySignature(raw, sign(raw), SECRET)).toBe(true);
  });

  it('menolak signature salah', () => {
    const wrong = 'sha256=' + 'ab'.repeat(32);
    expect(verifySignature(raw, wrong, SECRET)).toBe(false);
  });

  it('menolak signature absen / tanpa prefix', () => {
    expect(verifySignature(raw, undefined, SECRET)).toBe(false);
    expect(verifySignature(raw, sign(raw).slice('sha256='.length), SECRET)).toBe(false);
  });

  it('menolak body yang diubah setelah ditandatangani', () => {
    const sig = sign(raw);
    const tampered = Buffer.from(JSON.stringify({ ...dmPayload, extra: 1 }));
    expect(verifySignature(tampered, sig, SECRET)).toBe(false);
  });
});

describe('parseWebhook', () => {
  it('parse DM: nomor tanpa suffix device, isGroup=false', () => {
    const m = parseWebhook(dmPayload)!;
    expect(m).toMatchObject({
      deviceId: 'dev-01',
      messageId: 'MSG-001',
      chatJid: '62811111@s.whatsapp.net',
      senderNumber: '62811111',
      isGroup: false,
      text: 'catat pemasukan banyu 500rb',
    });
  });

  it('parse grup: chat_id @g.us → isGroup=true, sender dari from', () => {
    const m = parseWebhook({
      ...dmPayload,
      payload: {
        ...dmPayload.payload,
        chat_id: '120363123456789@g.us',
        from: '62822222@s.whatsapp.net',
      },
    })!;
    expect(m.isGroup).toBe(true);
    expect(m.chatJid).toBe('120363123456789@g.us');
    expect(m.senderNumber).toBe('62822222');
  });

  it('abaikan pesan dari bot sendiri (is_from_me)', () => {
    expect(
      parseWebhook({ ...dmPayload, payload: { ...dmPayload.payload, is_from_me: true } }),
    ).toBeNull();
  });

  it('abaikan event non-message dan body kosong (media/voice = backlog)', () => {
    expect(parseWebhook({ ...dmPayload, event: 'message.ack' })).toBeNull();
    expect(
      parseWebhook({ ...dmPayload, payload: { ...dmPayload.payload, body: '' } }),
    ).toBeNull();
    expect(parseWebhook({})).toBeNull();
    expect(parseWebhook(null)).toBeNull();
  });

  it('voice note: payload.audio (tanpa body) → kind voice + audioPath (spike 11 Jul)', () => {
    // struktur persis payload GoWA nyata (nomor disamarkan)
    const m = parseWebhook({
      device_id: '628000000001@s.whatsapp.net',
      event: 'message',
      payload: {
        audio: 'statics/media/1783731573-28c5c820-aaaa-bbbb-cccc-000000000000.oga',
        chat_id: '628000000002@s.whatsapp.net',
        chat_lid: '97700000000000@lid',
        from: '628000000002@s.whatsapp.net',
        from_lid: '97700000000000@lid',
        from_name: 'Tester',
        id: '3A076C74402B00FA0000',
        is_from_me: false,
        timestamp: '2026-07-11T00:59:42Z',
      },
    })!;
    expect(m.kind).toBe('voice');
    expect(m.audioPath).toBe('statics/media/1783731573-28c5c820-aaaa-bbbb-cccc-000000000000.oga');
    expect(m.text).toBe('');
    expect(m.senderNumber).toBe('628000000002');
  });

  it('pesan teks tetap kind text', () => {
    expect(parseWebhook(dmPayload)!.kind).toBe('text');
  });

  it('jidToNumber membersihkan suffix', () => {
    expect(jidToNumber('62811:99@s.whatsapp.net')).toBe('62811');
    expect(jidToNumber('62811@s.whatsapp.net')).toBe('62811');
  });
});
