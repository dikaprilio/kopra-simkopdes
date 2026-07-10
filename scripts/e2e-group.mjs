#!/usr/bin/env node
/**
 * E2E group support TANPA HP (Fase 4) — api :3001 + agent :4111 + GoWA :3002 hidup:
 *   node scripts/e2e-group.mjs
 *
 * Skenario (fake group JID → auto-bind participant-scan gagal graceful = tetap UNRESOLVED):
 *  1. pesan grup non-mention        → tersimpan di wa_group_messages, TANPA balasan
 *  2. mention @Kopra (UNRESOLVED)   → bot tanya koperasi
 *  3. user terdaftar mention + nama koperasi → ATTACHED + pengumuman
 *  4. mention read-query (terdaftar)→ balasan agent non-fallback
 *  5. mention write-attempt         → ditolak/diarahkan japri, TANPA PendingAction baru
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
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/kopra';

const GROUP = `120363999${Date.now() % 1_000_000}@g.us`;
const WA_PENGURUS = '62899778001'; // terdaftar (dibuat script)
const WA_GUEST = '62899778002'; // tidak terdaftar

const db = new Client({ connectionString: DB_URL });
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

async function sendGroupMsg(from, text) {
  const body = JSON.stringify({
    event: 'message',
    device_id: process.env.WA_DEVICE_ID ?? 'fake-device-01',
    session_id: 'e2e-group',
    payload: {
      id: `E2EG-${randomUUID()}`,
      chat_id: GROUP,
      from: `${from}@s.whatsapp.net`,
      from_name: `User ${from.slice(-3)}`,
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

async function outboxCursor() {
  const r = await db.query(`select coalesce(max("createdAt"), 'epoch'::timestamp) as t from outbound_wa_messages`);
  return r.rows[0].t;
}

/** Tunggu balasan grup baru match regex (poll 500ms; agent reply bisa lambat → 30s). */
async function waitGroupReply(re, since, timeoutS = 30) {
  for (let i = 0; i < timeoutS * 2; i++) {
    const r = await db.query(
      `select text from outbound_wa_messages where "toJid" = $1 and "createdAt" > $2 order by "createdAt" desc limit 5`,
      [GROUP, since],
    );
    const hit = r.rows.find((row) => re.test(row.text));
    if (hit) return hit;
    await new Promise((s) => setTimeout(s, 500));
  }
  fail(`timeout menunggu balasan grup /${re.source}/`);
}

async function noGroupReply(since, waitMs = 4000) {
  await new Promise((s) => setTimeout(s, waitMs));
  const r = await db.query(
    `select count(*)::int as n from outbound_wa_messages where "toJid" = $1 and "createdAt" > $2`,
    [GROUP, since],
  );
  return r.rows[0].n === 0;
}

const count = async (sql, params = []) => (await db.query(sql, params)).rows[0].n;

async function main() {
  await db.connect();

  // ---------- fixtures & cleanup ----------
  await db.query(`delete from wa_group_messages where "groupJid" like '120363999%'`);
  await db.query(`delete from wa_groups where "groupJid" like '120363999%'`);
  await db.query(`delete from outbound_wa_messages where "toJid" like '120363999%'`);
  await db.query(`delete from whatsapp_identities where "waNumber" like '62899778%'`);
  await db.query(`delete from users where email like 'wa-62899778%'`);

  const kop = await db.query(`select id, nama from koperasi where nama like '%Demo%' limit 1`);
  if (!kop.rows.length) fail('koperasi Demo tidak ditemukan — seed dulu');
  const { id: kopId, nama: kopNama } = kop.rows[0];

  const usr = await db.query(
    `insert into users (id, email, "passwordHash", name, role, status, "koperasiId", "createdAt")
     values (gen_random_uuid(), $1, 'x', 'Pengurus E2E Grup', 'PENGURUS', 'ACTIVE', $2, now()) returning id`,
    [`wa-${WA_PENGURUS}@kopra.local`, kopId],
  );
  await db.query(
    `insert into whatsapp_identities (id, "waNumber", "userId", "koperasiId")
     values (gen_random_uuid(), $1, $2, $3)`,
    [WA_PENGURUS, usr.rows[0].id, kopId],
  );
  ok(`fixture: PENGURUS terdaftar ${WA_PENGURUS} @ ${kopNama}; grup ${GROUP}`);

  const paBaseline = await count(`select count(*)::int as n from pending_actions`);

  // ---------- 1. non-mention → stored, silent ----------
  let since = await outboxCursor();
  await sendGroupMsg(WA_GUEST, 'halo semua, besok rapat jam 9 ya');
  if (!(await noGroupReply(since))) fail('skenario 1: bot membalas pesan non-mention');
  const stored = await count(
    `select count(*)::int as n from wa_group_messages where "groupJid" = $1`, [GROUP]);
  if (stored < 1) fail('skenario 1: pesan tidak tersimpan di wa_group_messages');
  ok('1. non-mention: tersimpan, bot diam');

  // ---------- 2. mention di UNRESOLVED (guest) → tanya koperasi ----------
  since = await outboxCursor();
  await sendGroupMsg(WA_GUEST, '@Kopra kamu bisa apa?');
  await waitGroupReply(/belum terhubung/i, since, 15);
  ok('2. mention UNRESOLVED: bot tanya koperasi');

  // ---------- 3. binding manual oleh user terdaftar ----------
  since = await outboxCursor();
  await sendGroupMsg(WA_PENGURUS, '@Kopra hubungkan grup ini ke KDMP Palbapang');
  await waitGroupReply(/terhubung ke/i, since, 15);
  const st = await db.query(`select status, "koperasiId" from wa_groups where "groupJid" = $1`, [GROUP]);
  if (st.rows[0]?.status !== 'ATTACHED' || st.rows[0]?.koperasiId !== kopId)
    fail(`skenario 3: wa_groups bukan ATTACHED ke Demo (${JSON.stringify(st.rows[0])})`);
  ok('3. binding manual: ATTACHED + pengumuman');

  // ---------- 4. read-query via agent (channel GROUP) ----------
  since = await outboxCursor();
  await sendGroupMsg(WA_PENGURUS, '@Kopra produk apa saja yang tersedia di koperasi?');
  const reply = await waitGroupReply(/./, since, 45);
  if (/asisten sedang gangguan/i.test(reply.text)) fail('skenario 4: agent fallback (gangguan)');
  ok(`4. read-query dijawab agent (${reply.text.slice(0, 60).replace(/\n/g, ' ')}…)`);

  // ---------- 5. write-attempt → tolak, tanpa PendingAction ----------
  since = await outboxCursor();
  await sendGroupMsg(WA_PENGURUS, '@Kopra catat pemasukan 100rb dari penjualan air');
  const denial = await waitGroupReply(/./, since, 45);
  if (/asisten sedang gangguan/i.test(denial.text)) fail('skenario 5: agent fallback (gangguan)');
  const paNow = await count(`select count(*)::int as n from pending_actions`);
  if (paNow !== paBaseline) fail(`skenario 5: PendingAction bertambah (${paBaseline} → ${paNow})`);
  ok(`5. write ditolak tanpa PendingAction (${denial.text.slice(0, 60).replace(/\n/g, ' ')}…)`);

  await db.end();
  console.log('GROUP E2E PASS ✅ (5/5 skenario)');
}

main().catch((e) => fail(e.message));
