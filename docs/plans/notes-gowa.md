# GoWA Integration Spike — Hasil Verifikasi (10 Jul 2026)

Gateway = **GoWA v8.6.0** (pinned), dijalankan **native** (binary `whatsapp_8.6.0_windows_amd64.exe`, mode `rest`) karena Docker Desktop lokal rusak. Di VPS nanti pakai image `ghcr.io/aldinokemal/go-whatsapp-web-multidevice:v8.6.0`. API surface identik.

## Cara jalan (dev lokal)
```
D:/Hackathon/gowa-local/start-gowa.cmd
# = whatsapp rest --port=3002 --basic-auth=admin:kopra-dev
#   --webhook=http://localhost:3001/api/v1/whatsapp/webhook
#   --webhook-secret=kopra-webhook-dev-secret --webhook-events=message,group.participants
```
UI: http://localhost:3002 (basic auth). Sudah TERVERIFIKASI hidup (114 handlers, auth OK).

## ⚠️ v8 = MULTI-DEVICE — semua endpoint WAJIB `X-Device-Id`
Terkonfirmasi: `/app/login`, `/app/devices`, `/send/message`, `/group/participants`, `/message/:id/download` semua balas `DEVICE_ID_REQUIRED` tanpa header/param device. **Adapter WAJIB menyimpan & mengirim device_id di tiap call** (header `X-Device-Id` atau query `device_id`).
- Alur: buat/registrasi device dulu → dapat `device_id` (format JID `628…@s.whatsapp.net`) → login QR untuk device itu → device_id dipakai di semua request berikutnya.
- Payload webhook membawa `device_id` di top-level → adapter menyimpannya per pesan masuk & memakainya saat membalas.

## Struktur webhook (TERVERIFIKASI dari docs resmi)
```jsonc
{
  "event": "message",
  "device_id": "628987654321@s.whatsapp.net",   // → InboundMessage.deviceId (dedup + reply routing)
  "session_id": "org_2",
  "payload": {
    "id": "3EB0C127D7BACC83D6A1",               // → messageId (dedup (deviceId,eventId=id))
    "chat_id": "628…@s.whatsapp.net | 120363…@g.us", // suffix @g.us = GRUP
    "from": "628123456789@s.whatsapp.net",       // → senderNumber (ambil sebelum @)
    "from_name": "John Doe",
    "timestamp": "2023-10-15T10:30:00Z",
    "is_from_me": false,                          // true → IGNORE (anti-loop)
    "body": "teks pesan"                          // → text
  }
}
```
**Group vs DM:** `payload.chat_id` berakhiran `@g.us` (grup) vs `@s.whatsapp.net` (DM). → `InboundMessage.isGroup`.

## HMAC (TERVERIFIKASI)
- Header: **`X-Hub-Signature-256`**, nilai `sha256=<hex>`
- Hitung: `HMAC-SHA256(rawBody, WA_WEBHOOK_SECRET)` → hex; buang prefix `sha256=` sebelum compare (constant-time).
- Adapter WAJIB verifikasi atas **raw body** (bukan JSON re-serialized). Di NestJS: aktifkan `rawBody: true` + baca `req.rawBody`.

## Mention — TIDAK terdokumentasi di payload docs
`body` hanya berisi teks; tidak ada field mention khusus yang terdokumentasi. **Keputusan (sesuai plan): fallback deterministik = deteksi string** `@Kopra` atau `@<nomorBot>` di `body`. Saat device sudah pairing & bisa uji grup nyata, cek apakah ada field mention native di payload aktual (lihat gowa.log realtime) — kalau ada, pakai; kalau tidak, string-match tetap jalan.

## Endpoint yang dipakai adapter (WhatsappGateway)
| Fungsi | Endpoint GoWA | Catatan |
|---|---|---|
| Kirim teks | `POST /send/message` `{phone, message}` + `X-Device-Id` | phone = nomor tujuan (grup pakai chat_id `@g.us`) |
| Download media | `GET/POST /message/:id/download` + `X-Device-Id` | untuk OCR/STT (Fase backlog) |
| Peserta grup | `GET /group/participants?group_id=…` + `X-Device-Id` | untuk group resolution (Fase 4) |
| Status/QR login | `GET /app/login`, `GET /app/devices` + `X-Device-Id` | |

## ⏭️ Sisa yang butuh HUMAN (belum bisa otomatis)
1. **Pairing QR nomor burner** — buka UI :3002, buat device, scan QR dari HP burner. Simpan `device_id` hasilnya ke `.env` (`WA_DEVICE_ID`).
2. Setelah pairing: uji kirim pesan nyata → cek `gowa.log` untuk payload aktual (konfirmasi field mention).

## Env final (samakan repo utama & GoWA)
```
WA_GATEWAY_BASE_URL=http://localhost:3002
WA_GATEWAY_BASIC_AUTH=admin:kopra-dev
WA_WEBHOOK_SECRET=kopra-webhook-dev-secret
WA_DEVICE_ID=<isi setelah pairing>
```

## ✅ Addendum pairing nyata (11 Jul, macOS native — Aldio)

Binary darwin_arm64 v8.6.0 jalan native dari `kopra-whatsapp-waha/local-gowa/` (flags sama + `--host=127.0.0.1`). Pairing via phone-code SUKSES. **Temuan penting:** `X-Device-Id` utk REST API = **UUID device internal** (dari `GET /app/devices` / log `[DEVICE_MANAGER] created device placeholder <uuid>`), BUKAN JID. JID `628…:N@s.whatsapp.net` ditolak `DEVICE_NOT_FOUND` sebagai header. JID tetap dipakai GoWA sebagai `device_id` di payload webhook → adapter harus siap MEMETAKAN keduanya (simpan UUID di `WA_DEVICE_ID` utk outbound; kenali JID di inbound). Kedua nilai tercatat di `local-gowa/device-id.txt` (repo infra, gitignored).
