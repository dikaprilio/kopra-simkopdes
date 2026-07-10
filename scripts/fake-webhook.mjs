#!/usr/bin/env node
/**
 * Simulasi webhook GoWA TANPA HP — jalur verifikasi utama semua flow bot.
 *
 *   node scripts/fake-webhook.mjs --text "catat pemasukan banyu 500rb" --from 62811111
 *   node scripts/fake-webhook.mjs --text "YA" --from 62811111
 *   node scripts/fake-webhook.mjs --text "@Kopra stok gas?" --from 62822222 --group 120363001@g.us
 *   node scripts/fake-webhook.mjs --text "halo" --from 62899999 --id MSG-X --repeat 2   # uji dedup
 *
 * Payload + HMAC persis perilaku GoWA v8.6.0 (docs/plans/notes-gowa.md).
 */
import { createHmac, randomUUID } from "node:crypto";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i++; }
  }
}

if (!args.text || !args.from) {
  console.error('Wajib: --text "..." --from 628xxx  [--group <jid@g.us>] [--name "Nama"] [--id MSG] [--repeat N] [--url ...]');
  process.exit(1);
}

const url = args.url ?? "http://localhost:3001/api/v1/whatsapp/webhook";
const secret = process.env.WA_WEBHOOK_SECRET ?? "kopra-webhook-dev-secret";
const deviceId = process.env.WA_DEVICE_ID ?? "fake-device-01";
const messageId = args.id ?? `FAKE-${randomUUID()}`;
const senderJid = `${args.from}@s.whatsapp.net`;

const body = JSON.stringify({
  event: "message",
  device_id: deviceId,
  session_id: "fake-session",
  payload: {
    id: messageId,
    chat_id: args.group ?? senderJid,
    from: senderJid,
    from_name: args.name ?? "Fake User",
    timestamp: new Date().toISOString(),
    is_from_me: false,
    body: args.text,
  },
});

const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const repeat = Number(args.repeat ?? 1);

for (let n = 1; n <= repeat; n++) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
    body,
  });
  const text = await res.text();
  console.log(`[${n}/${repeat}] ${res.status} ${text}  (id=${messageId})`);
}
