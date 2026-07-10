#!/usr/bin/env node
/**
 * E2E registrasi dua arah TANPA HP (Fase 3 Stage 3) — jalankan dengan api :3001 hidup:
 *   node scripts/e2e-registration.mjs
 *
 * WA-FIRST : DAFTAR → role → cari koperasi → pilih → magic link → form web
 *            → SETUJUI (super-admin) → login OK
 * WEB-FIRST: start-web → OTP dari outbox → verify-otp → SETUJUI → login OK
 *
 * Prasyarat env (.env): WA_WEBHOOK_SECRET, SUPER_ADMIN_WA_NUMBER (nomor tes),
 * DB kopra ter-seed (ada koperasi "%Demo%").
 */
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

// muat .env root (script dijalankan via `node` polos — nilai HARUS sama dgn yang dibaca api)
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].split(/\s+#/)[0].trim();
  }
} catch { /* .env opsional */ }

const API = process.env.API_BASE ?? 'http://localhost:3001/api/v1';
const WEBHOOK = `${API}/whatsapp/webhook`;
const SECRET = process.env.WA_WEBHOOK_SECRET ?? 'kopra-webhook-dev-secret';
const SUPER_ADMIN = process.env.SUPER_ADMIN_WA_NUMBER ?? '62899000001';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/kopra';

const WA1 = '62899777101'; // WA-first
const WA2 = '62899777102'; // web-first
const PASSWORD = 'rahasia-e2e-1';

const db = new Client({ connectionString: DB_URL });
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function sendWa(from, text) {
  const body = JSON.stringify({
    event: 'message',
    device_id: process.env.WA_DEVICE_ID ?? 'fake-device-01',
    session_id: 'e2e-session',
    payload: {
      id: `E2E-${randomUUID()}`,
      chat_id: `${from}@s.whatsapp.net`,
      from: `${from}@s.whatsapp.net`,
      from_name: 'E2E Bot',
      timestamp: new Date().toISOString(),
      is_from_me: false,
      body: text,
    },
  });
  const sig = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
    body,
  });
  if (!res.ok) fail(`webhook ${res.status}: ${await res.text()}`);
}

/** Tunggu balasan outbox BARU (createdAt > since) utk nomor ini yang match regex (poll 500ms, max 15s). */
async function waitReply(waNumber, re, since = new Date(0)) {
  for (let i = 0; i < 30; i++) {
    const r = await db.query(
      `select text, "createdAt" from outbound_wa_messages where "toJid" = $1 and "createdAt" > $2 order by "createdAt" desc limit 5`,
      [`${waNumber}@s.whatsapp.net`, since],
    );
    const hit = r.rows.find((row) => re.test(row.text));
    if (hit) return hit;
    await new Promise((s) => setTimeout(s, 500));
  }
  fail(`timeout menunggu balasan /${re.source}/ untuk ${waNumber}`);
}

/** Penanda waktu outbox terakhir (kursor utk waitReply). */
async function lastOutboxId() {
  const r = await db.query(`select coalesce(max("createdAt"), 'epoch'::timestamp) as t from outbound_wa_messages`);
  return r.rows[0].t;
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function approveAndLogin(waNumber, label) {
  const reg = await db.query(
    `select "shortCode" from registration_requests where "waNumber" = $1 order by "createdAt" desc limit 1`,
    [waNumber],
  );
  const shortCode = reg.rows[0]?.shortCode;
  if (!shortCode) fail(`${label}: registration request tidak ditemukan`);
  const since = await lastOutboxId();
  await sendWa(SUPER_ADMIN, `SETUJUI ${shortCode}`);
  await waitReply(waNumber, /DISETUJUI/i, since);
  ok(`${label}: ${shortCode} disetujui + notifikasi pemohon terkirim`);

  const login = await api('/auth/login', { email: `wa-${waNumber}@kopra.local`, password: PASSWORD });
  if (login.status !== 201 && login.status !== 200) fail(`${label}: login gagal (${login.status})`);
  if (!login.json.token) fail(`${label}: login tanpa token`);
  ok(`${label}: login OK (role ${login.json.user?.role})`);
}

async function main() {
  await db.connect();

  // ---------- bersihkan jejak run sebelumnya ----------
  await db.query(`delete from otp_challenges where "waNumber" like '62899777%'`);
  await db.query(`delete from auth_tokens where "waNumber" like '62899777%'`);
  await db.query(`delete from registration_requests where "waNumber" like '62899777%'`);
  await db.query(`delete from whatsapp_identities where "waNumber" like '62899777%'`);
  await db.query(`delete from users where email like 'wa-62899777%'`);
  await db.query(`delete from outbound_wa_messages where "toJid" like '62899777%'`);

  const kop = await db.query(`select id, nama from koperasi where nama like '%Demo%' limit 1`);
  if (!kop.rows.length) fail('koperasi Demo tidak ditemukan — seed dulu');
  const kopId = kop.rows[0].id;

  // ================= WA-FIRST =================
  console.log('— WA-FIRST (DAFTAR → magic link → form → SETUJUI → login) —');
  let since = await lastOutboxId();
  await sendWa(WA1, 'DAFTAR');
  await waitReply(WA1, /mendaftar sebagai/i, since);
  ok('DAFTAR → ditanya role');

  since = await lastOutboxId();
  await sendWa(WA1, '2'); // anggota
  await waitReply(WA1, /namanya apa/i, since);
  since = await lastOutboxId();
  await sendWa(WA1, 'Demo');
  await waitReply(WA1, /1\./, since);
  since = await lastOutboxId();
  await sendWa(WA1, '1');
  const linkMsg = await waitReply(WA1, /register\/complete\?token=/, since);
  const token = linkMsg.text.match(/token=([a-f0-9]+)/)?.[1];
  if (!token) fail('token magic link tidak ter-extract');
  ok('magic link diterima');

  const done = await api('/registration/complete-wa', {
    token, nama: 'E2E WaFirst', nik: '9200000000000001', password: PASSWORD,
  });
  if (done.status !== 201 && done.status !== 200) fail(`complete-wa gagal (${done.status}): ${JSON.stringify(done.json)}`);
  ok(`form web tersimpan → status ${done.json.status}`);
  if (done.json.status === 'PENDING') await approveAndLogin(WA1, 'WA-FIRST');
  else ok('WA-FIRST: langsung ACTIVE (NIK match)');
  console.log('WA-FIRST PASS ✅\n');

  // ================= WEB-FIRST =================
  console.log('— WEB-FIRST (start-web → OTP → verify → SETUJUI → login) —');
  const start = await api('/registration/start-web', {
    nama: 'E2E WebFirst', nik: '9200000000000002', password: PASSWORD,
    waNumber: WA2, role: 'ANGGOTA', koperasiRef: kopId,
  });
  if (start.status !== 201 && start.status !== 200) fail(`start-web gagal (${start.status}): ${JSON.stringify(start.json)}`);
  ok(`start-web → OTP dikirim ke ${start.json.sentTo}`);

  const otpMsg = await waitReply(WA2, /\d{6}/);
  const otp = otpMsg.text.match(/\d{6}/)[0];
  const verify = await api('/registration/verify-otp', { waNumber: WA2, code: otp });
  if (!verify.json.shortCode) fail(`verify-otp gagal: ${JSON.stringify(verify.json)}`);
  ok(`verify-otp → ${verify.json.status} (${verify.json.shortCode})`);
  await approveAndLogin(WA2, 'WEB-FIRST');
  console.log('WEB-FIRST PASS ✅');

  await db.end();
}

main().catch((e) => fail(e.message));
