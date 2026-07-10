import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

/** Pesan masuk ternormalisasi (bentuk payload TERVERIFIKASI di docs/plans/notes-gowa.md). */
export interface InboundMessage {
  deviceId: string;
  messageId: string;
  chatJid: string; // "628xx@s.whatsapp.net" | "1203xx@g.us"
  senderNumber: string; // digit saja, tanpa suffix @/device
  fromName?: string;
  text: string;
  isGroup: boolean;
  timestamp?: string;
}

/** Verifikasi X-Hub-Signature-256 = "sha256=" + hex HMAC-SHA256(rawBody, secret). Constant-time. */
export function verifySignature(
  rawBody: Buffer,
  sigHeader: string | undefined,
  secret: string,
): boolean {
  if (!sigHeader || !sigHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sigHeader.slice('sha256='.length), 'hex');
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** Ambil nomor dari JID GoWA ("62811:12@s.whatsapp.net" → "62811"). */
export function jidToNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

/**
 * Normalisasi body webhook GoWA → InboundMessage.
 * null = abaikan (bukan pesan teks, pesan dari bot sendiri, atau bentuk tak dikenal).
 */
export function parseWebhook(body: unknown): InboundMessage | null {
  const b = body as {
    event?: string;
    device_id?: string;
    payload?: {
      id?: string;
      chat_id?: string;
      from?: string;
      from_name?: string;
      timestamp?: string;
      is_from_me?: boolean;
      body?: string;
    };
  };
  const p = b?.payload;
  if (!p || !p.id || !p.chat_id) return null;
  if (b.event && b.event !== 'message') return null; // ack/receipt/dll — abaikan
  if (p.is_from_me) return null;
  if (typeof p.body !== 'string' || p.body.trim() === '') return null; // media/voice = backlog

  return {
    deviceId: b.device_id ?? 'unknown',
    messageId: p.id,
    chatJid: p.chat_id,
    senderNumber: jidToNumber(p.from ?? p.chat_id),
    fromName: p.from_name,
    text: p.body.trim(),
    isGroup: p.chat_id.endsWith('@g.us'),
    timestamp: p.timestamp,
  };
}

/** HTTP client GoWA REST (v8: header X-Device-Id WAJIB di semua endpoint). */
@Injectable()
export class GowaClient {
  private readonly logger = new Logger(GowaClient.name);

  private get baseUrl(): string {
    return process.env.WA_GATEWAY_BASE_URL ?? 'http://localhost:3002';
  }

  private headers(): Record<string, string> {
    const basic = process.env.WA_GATEWAY_BASIC_AUTH ?? 'admin:kopra-dev';
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(basic).toString('base64'),
    };
    const deviceId = process.env.WA_DEVICE_ID;
    if (deviceId) h['X-Device-Id'] = deviceId;
    return h;
  }

  /** Kirim teks LANGSUNG ke GoWA. Jangan panggil dari flow bot — pakai OutboxService. */
  async sendTextDirect(toJid: string, text: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/send/message`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ phone: toJid, message: text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`GoWA send/message ${res.status}: ${detail.slice(0, 200)}`);
    }
  }

  /** Participant grup (utk resolusi grup→koperasi, M7). */
  async getGroupParticipants(groupJid: string): Promise<string[]> {
    const url = `${this.baseUrl}/group/participants?group_id=${encodeURIComponent(groupJid)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`GoWA group/participants ${res.status}`);
    const json = (await res.json()) as {
      results?: { participants?: Array<{ jid?: string } | string> };
    };
    const list = json.results?.participants ?? [];
    return list
      .map((x) => (typeof x === 'string' ? x : (x.jid ?? '')))
      .filter(Boolean)
      .map(jidToNumber);
  }
}
