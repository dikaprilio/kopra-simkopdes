# Arsitektur Chatbot Kopra: NestJS + Mastra — dan Panduan Refactor dari Engine Deterministik Murni

> Dokumen ini menjelaskan bagaimana chatbot WhatsApp Kopra dibangun (NestJS sebagai *engine* + Mastra sebagai *otak*), dan bagaimana memindahkan chatbot NestJS murni yang "deterministic-heavy" ke pola ini tanpa mengorbankan keandalan.

## 0. Dua penyakit chatbot deterministik murni (dan obatnya)

| Penyakit | Gejala | Obat di arsitektur ini |
|---|---|---|
| **Intent via regex/keyword** | Tambah 1 fitur = tambah 20 pattern; kalimat natural sedikit beda → tidak dikenali; if-else raksasa | **Tidak ada intent classifier sama sekali.** Daftar *tool* + deskripsinya = ruang intent; LLM yang memilih tool & mengisi parameternya (zod schema = slot filling gratis) |
| **Memory tidak ada / di RAM** | Bot lupa konteks; restart = semua sesi hilang | State dipilah 3 lapis (§4): identitas → DB, transaksi-menggantung → DB state machine, konteks percakapan → tabel bounded / `@mastra/memory` |

Prinsip inti Kopra: **"LLM explains, backend calculates."** LLM hanya untuk *memahami bahasa* dan *memilih aksi*; semua angka, aturan bisnis, dan keputusan final tetap deterministik. Kamu tidak menyerahkan uang ke LLM — kamu menyerahkan *parsing* ke LLM.

## 1. Topologi

```
WhatsApp ⇄ GoWA gateway ⇄ [NestJS api :3001]  ⇄ HTTP ⇄  [Mastra server :4111]
                              │      (@mastra/client-js)        │
                              │                                 ├─ Agent "kopra" (instructions + model)
                              ├─ WebhookController (HMAC+dedup) └─ 19 tools (zod) ──→ @kopra/core ──→ Prisma/PG
                              ├─ ConversationService (orchestrator deterministik)
                              ├─ PendingAction state machine (DB)
                              └─ OutboxService (kirim + retry)
```

Dua proses terpisah, sengaja:
- **NestJS = engine**: transport (webhook, HMAC, dedup), routing kanal (DM/grup/super-admin), state machine uang (YA/BATAL), pengiriman (outbox + retry + rate limit). Semua yang HARUS deterministik dan idempotent.
- **Mastra = otak**: satu `Agent` dengan instructions + tools. Semua yang butuh pemahaman bahasa.

NestJS memanggil Mastra sebagai layanan (`agent.generate(text, { requestContext })`) — bukan Mastra yang membungkus Nest. Ini membuat refactor bisa **bertahap**: engine lama tetap jalan, otaknya diganti.

## 2. Lifecycle satu pesan (yang deterministik vs yang LLM)

```
pesan masuk
 1. [D] verifikasi HMAC atas raw body            → tolak kalau invalid
 2. [D] dedup (deviceId,eventId) unique di DB    → webhook redelivery aman
 3. [D] voice note? unduh + STT → teks           → lanjut sebagai teks biasa, balasan diprefix 🎤 transkrip
 4. [D] routing kanal: grup? super-admin? guest? → masing-masing jalur sendiri
 5. [D] ada PendingAction menunggu di chat ini?
        ├─ "ya/iya/oke…"  → confirmPending()     → COMMIT (tanpa LLM!)
        ├─ "batal/gajadi" → cancelPending()      → hapus draft (tanpa LLM!)
        └─ teks lain      → koreksi: draft lama dibuang, preview lama disuntik
                            ke prompt, agent diminta buat draft BARU
 6. [L] agent.generate(text, requestContext berisi identitas)
        → LLM memilih tool (= intent) + mengisi parameter (= slot)
        → tool memanggil domain logic, mengembalikan previewText / data / denial
 7. [D] balasan masuk outbox → worker kirim (retry, backoff, ≤1 msg/dtk)
```

`[D]` = kode deterministik, `[L]` = LLM. Perhatikan: **kata "YA" pada transaksi uang tidak pernah menyentuh LLM** — regex kecil + transaksi DB atomik. LLM tidak bisa "halu-commit".

## 3. Sisi Mastra

### 3.1 Agent

```ts
// apps/agent/src/mastra/agents/kopra.ts (ringkas)
export const kopra = new Agent({
  id: "kopra",
  name: "kopra",
  instructions: `…persona, aturan format WhatsApp, ATURAN KERAS:
    1. JANGAN mengarang angka — semua angka wajib dari hasil tool.
    3. Pencatatan → panggil tool draft, tampilkan previewText APA ADANYA.
       Kamu TIDAK bisa menyimpan — penyimpanan terjadi saat user balas YA.
    6. "500rb"=500000, "1,2jt"=1200000 …`,
  model: kopraModel(),        // string router: "openrouter/google/gemini-3.1-flash-lite"
  tools: { getStockCard, createEntryDraft, /* …19 tools */ },
});
export const mastra = new Mastra({ agents: { kopra } });   // `mastra dev` → server :4111
```

Model via **model-router string** (`"openrouter/<model>"`, `"anthropic/<model>"`) — ganti provider = ganti env, tanpa ganti kode.

### 3.2 Tool = unit intent

```ts
export const createEntryDraft = createTool({
  id: "createEntryDraft",
  // ↓ DESKRIPSI INI adalah "intent pattern"-mu sekarang. Bahasa natural, bukan regex.
  description: "Buat DRAFT jurnal pemasukan/pengeluaran dari kalimat pengurus " +
    "(mis. 'catat pemasukan banyu 500rb'). amount rupiah penuh (500rb → 500000).",
  inputSchema: z.object({          // ← slot-filling, tervalidasi otomatis
    kind: z.enum(["INCOME", "EXPENSE"]),
    amount: z.number().positive(),
    description: z.string(),
    via: z.enum(["KAS", "BANK"]).default("KAS"),
  }),
  execute: async (input, ctx) => {
    const actor = getActor(ctx?.requestContext);          // identitas dari engine, BUKAN tebakan LLM
    const deny = gate(actor, "WRITE_ERP");                // RBAC per-tool
    if (deny) return { denied: deny };                    // LLM wajib menyampaikan apa adanya
    const res = await createDraftFromSimple(actor.actorId!, {...});  // domain logic deterministik
    await createPending({ chatJid: actor.chatJid!, ..., payload: { previewText, entryId: res.entry.id } });
    return { previewText };                               // bukan efek — hanya draft + preview
  },
});
```

Pola penting:
- **Identitas dikirim engine** via `RequestContext` (role, koperasiId, actorId, channel…). Instruksi agent: "JANGAN ditebak". Tool membaca `ctx.requestContext`.
- **Setiap tool tulis = draft-only.** Efek nyata terjadi di engine saat YA. LLM salah pilih tool? Preview-nya salah, user tinggal BATAL — uang tidak bergerak.
- **Gate di dalam tool**, bukan cuma di instructions — instructions bisa diabaikan model, kode tidak.
- Tool mengembalikan **teks jadi** (`previewText`) untuk hal sensitif → LLM disuruh menampilkan verbatim, bukan mengarang ulang angka.

### 3.3 Engine memanggil agent

```ts
// apps/api/src/whatsapp/agent-client.ts (ringkas)
const client = new MastraClient({ baseUrl: "http://localhost:4111" });
const rc = new RequestContext();
for (const [k, v] of Object.entries(actor)) if (v !== undefined) rc.set(k, v);
const res = await client.getAgent("kopra").generate(text, { requestContext: rc });
return res.text;
```

## 4. Memory: pilah dulu, baru pilih alat

Kesalahan umum: menganggap "memory" itu satu benda. Di chatbot transaksional ada **tiga jenis state** dengan kebutuhan beda:

| Jenis | Contoh | Simpan di | Kenapa |
|---|---|---|---|
| **Identitas & profil** (permanen) | nomor WA → user → role → tenant | Tabel DB biasa (`whatsapp_identities`) | Ini data master, bukan "memory" |
| **State transaksional** (menit) | draft menunggu YA/BATAL | **Tabel state machine** (`PendingAction`: chatJid, actorId, actionType, payload JSON, state, expiresAt) | Wajib: restart-safe, idempotent (duplicate-YA via `updateMany` state-guard), TTL, auditable. LLM memory TIDAK BOLEH memegang ini |
| **Konteks percakapan** (jam) | "kalau bulan lalu?" nyambung ke pertanyaan sebelumnya | `@mastra/memory` (DM) / tabel bounded sendiri (grup Kopra: 50 pesan/24 jam, 20 terakhir ikut prompt) | Boleh hilang tanpa bahaya; murni kualitas percakapan |

Kopra men-DB-kan lapisan 1–2 dan *sengaja* membuat DM stateless per-giliran (koreksi ditangani dengan menyuntik preview lama ke prompt). Kalau proyekmu butuh multi-turn beneran, tambahkan `@mastra/memory`:

```ts
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";   // atau storage PG

export const kopra = new Agent({
  …,
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:memory.db" }),
    options: { lastMessages: 12, semanticRecall: false },  // mulai simpel
  }),
});

// saat memanggil: thread = percakapan, resource = pemilik
await agent.generate(text, {
  requestContext: rc,
  memory: { thread: chatJid, resource: userId },
});
```

Aturan emasnya: **memory percakapan untuk nyambung ngobrol; state machine DB untuk apa pun yang menyangkut efek samping.** Jangan pernah membalik itu.

## 5. Guardrails yang membuat pola ini aman dipakai produksi

1. **Draft + confirm**: LLM hanya bisa membuat draft; commit = regex "YA" + transaksi atomik + cek actor sama + TTL 15 menit.
2. **Gate RBAC di setiap tool** (role × capability × channel) — bukan di prompt.
3. **Idempotensi dua arah**: inbound dedup unique-constraint; outbound outbox dgn retry/backoff/`FAILED`-cap.
4. **Immutability**: record ter-commit tidak bisa diubah LLM; "pembatalan" = jurnal pembalik (aksi baru, juga lewat draft+YA).
5. **Angka selalu dari tool**: instruksi keras + tool mengembalikan teks jadi untuk bagian sensitif.
6. **Redaksi PII** di audit log; identitas dari engine, bukan dari percakapan.

## 6. Peta refactor: NestJS deterministik murni → NestJS + Mastra

Jangan tulis ulang engine. Operasi bedahnya kecil:

| Komponen lama | Nasib |
|---|---|
| Controller/webhook, auth, DB, queue, cron | **TETAP** — tidak tersentuh |
| Intent classifier (regex/keyword/if-else) | **HAPUS** → jadi deskripsi tools |
| Slot extractor (parsing manual parameter) | **HAPUS** → jadi zod `inputSchema` |
| Handler per-intent (logika bisnis) | **TETAP**, dibungkus jadi `execute` tool (atau dipanggil dari situ) |
| Session state di RAM/Redis ad-hoc | Pilah per §4: transaksional → tabel state machine; percakapan → `@mastra/memory` |
| Template balasan | Sebagian jadi `previewText` dari tool; sisanya biarkan LLM menulis (beri aturan format di instructions) |

Langkah bertahap (masing-masing shippable):
1. **Scaffold** app Mastra terpisah (`apps/agent`): 1 Agent + 2–3 tool read-only yang membungkus service lama.
2. Di engine, tambah **satu cabang fallback**: kalau intent classifier lama tidak yakin → lempar ke agent. (Dua otak hidup berdampingan.)
3. Pindahkan intent satu per satu: hapus pattern-nya, tulis tool-nya. Ukur: kalimat yang dulu gagal sekarang kena.
4. Masukkan **RequestContext** (identitas dari engine) + **gate** per tool.
5. Untuk intent ber-efek-samping: pecah jadi *draft tool* + *state machine confirm* di engine (jangan biarkan LLM commit).
6. Matikan classifier lama sepenuhnya; tambah `@mastra/memory` untuk multi-turn.

## 7. Jebakan yang sudah kami tabrak (biar kamu tidak)

1. **Versi cepat berubah**: Mastra 1.x — `requestContext` (dulu `runtimeContext`), zod v4 peer-dependency ribut dengan beberapa `@ai-sdk/*`. Pin versi, cek changelog.
2. **`create-mastra` CLI rewel** di monorepo pnpm → lebih deterministik menulis skeleton tangan (5 file).
3. **`mastra build` membundel `node_modules` sendiri** → salinan `@prisma/client` di bundle belum ter-generate; salin folder `.prisma/client` hasil generate ke `.mastra/output/node_modules/...` di skrip deploy.
4. **Jangan kirim payload sensitif ke LLM** — tool mengembalikan data secukupnya; NIK/kredensial tidak pernah lewat prompt.
5. **LLM kecil pun cukup** (Kopra: Gemini Flash-Lite, 2–4 dtk/giliran) KARENA semua kecerdasan domain ada di tools — model cuma milih & mengisi. Kalau arsitekturmu butuh model raksasa untuk sekadar intent, itu tanda logika bisnismu bocor ke prompt.
6. **Test tanpa LLM**: orchestrator dites dengan agent di-mock (deterministik); tool dites langsung sebagai fungsi; LLM behaviour dites terpisah dengan probe. Jangan gantungkan CI pada jawaban model.
7. **Format kanal** itu urusan instructions (WhatsApp: bold `*satu asterisk*`, tanpa `**`, daftar `•`) — jangan post-process regex kalau bisa dihindari.

## 8. Rujukan implementasi nyata di repo ini

| Konsep | File |
|---|---|
| Agent + instructions + model router | `apps/agent/src/mastra/agents/kopra.ts`, `apps/agent/src/lib/model.ts` |
| Tools (read / write-draft / RAG) + gate | `apps/agent/src/mastra/tools/{read-tools,write-tools,rag-tool,gate}.ts` |
| Identitas via RequestContext | `apps/agent/src/lib/context.ts`, `apps/api/src/whatsapp/agent-client.ts` |
| Orchestrator deterministik (YA/BATAL/koreksi/voice) | `apps/api/src/whatsapp/conversation.service.ts` |
| State machine transaksional | `packages/core/src/pending-action.ts` |
| Idempotensi transport | `apps/api/src/whatsapp/{dedup.service,outbox.service}.ts` |
| Grup: konteks bounded + mention-only | `apps/api/src/whatsapp/group.service.ts` |
