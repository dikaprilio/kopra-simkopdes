# apps/api — NestJS (backend)

SUDAH di-scaffold (Fase 0.1). Perintah asal (referensi):

```bash
# dari root monorepo
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git
```

Set `"name": "api"` di package.json, port dari `API_PORT` (3001).

Modules (lihat docs/CONVENTIONS.md):
- `auth/` — login email+password → JWT (juga dipakai web → agent)
- `koperasi/` — CRUD members, business-units, transactions (scoped `koperasiId`!)
- `reports/` — buku kas & laba rugi (query agregat, render HTML print-friendly / JSON)
- `whatsapp/` — interface `WhatsappGateway` (sendText, downloadMedia, verifyWebhook)
  + adapter **GoWA** (default; WAHA = adapter fallback, swap 1 file).
  Webhook `POST /wa/webhook`: verifikasi HMAC-SHA256 → identify nomor via
  `whatsapp_identities` → suspended workflow? resume via Mastra API : call agent
  → balas via GoWA `POST /send/message`. Media: `GET /message/:id/download`.
  Nomor tak dikenal → balasan onboarding.

Dependensi: `@kopra/db` (Prisma client). Semua tool-call & write → `audit_logs`.

## Kontrak master ERP

Semua route berikut memakai JWT dan selalu dibatasi ke `koperasiId` milik token. Role
`ANGGOTA` boleh membaca dan mengekspor; hanya `PENGURUS` dan `OWNER` yang boleh
membuat, mengubah, mengarsipkan, mengaktifkan kembali, atau menghapus data.
Resource tenant lain selalu diperlakukan sebagai tidak ditemukan.

List datar memakai envelope berikut:

```json
{ "data": [], "page": 1, "pageSize": 25, "total": 0 }
```

`pageSize` dibatasi 1–100. Filter umum adalah `search`, `active=true|false|all`,
`page`, dan `pageSize`. Arsip tidak tampil secara default tetapi tetap dapat dibaca
melalui detail/history agar jurnal dan kartu stok lama tidak kehilangan referensi.

### Anggota

| Method | Route | Keterangan |
|---|---|---|
| GET | `/members` | List; filter tambahan `unpaid=true` |
| POST | `/members` | Buat anggota dan opsional baris simpanan awal |
| GET | `/members/:id` | Detail aman |
| PATCH | `/members/:id` | Ubah atau aktifkan kembali (`isActive=true`) |
| DELETE | `/members/:id` | Arsip; ditolak dengan `409 MEMBER_HAS_LOGIN` bila memiliki akun login |
| GET | `/members/:id/simpanan` | Riwayat simpanan |
| POST | `/members/:id/simpanan/pay` | Bayar beberapa periode UNPAID |

NIK bersifat **write-only**. Payload create/update boleh mengirim `nik`, tetapi list,
detail, audit, dan ekspor tidak pernah mengembalikan nilainya. Respons hanya memuat
boolean `hasNik`. Nomor WA dan NIK dinormalisasi sebelum disimpan.

### Produk

| Method | Route | Keterangan |
|---|---|---|
| GET | `/products` | List; `lowStock=true` berarti produk aktif dengan stok ≤ 5 |
| POST | `/products` | Buat produk |
| GET | `/products/:id` | Detail edit beserta stok terkini |
| PATCH | `/products/:id` | Patch nama/unit/barcode/harga; nullable field menerima `null` |
| DELETE | `/products/:id` | Hapus fisik bila belum dipakai; bila sudah memiliki movement, arsipkan |
| GET | `/products/:id/card` | Kartu stok historis, termasuk produk arsip |

Produk arsip tidak dapat dipilih untuk movement baru. Semua nilai Prisma `Decimal`
pada respons JSON diserialisasi sebagai string.

### Chart of Accounts (COA)

| Method | Route | Keterangan |
|---|---|---|
| GET | `/coa` | List datar; `tree=true` mempertahankan bentuk pohon legacy |
| POST | `/coa` | Buat akun |
| GET | `/coa/:id` | Detail, induk, dan jumlah child/line |
| PATCH | `/coa/:id` | Ubah/aktifkan kembali; `parentId=null` melepas induk |
| DELETE | `/coa/:id` | Arsip akun |

Induk harus aktif dan satu tenant; siklus ditolak. Kode/type hanya dapat diubah
sebelum akun dipakai jurnal. Akun posting wajib, akun pendapatan unit, dan akun
dengan child aktif tidak dapat diarsipkan.

### Unit usaha

| Method | Route | Keterangan |
|---|---|---|
| GET | `/business-units` | List beserta akun pendapatan tertaut |
| POST | `/business-units` | Buat unit dan akun `REVENUE` tertaut secara atomik |
| GET | `/business-units/:id` | Detail aktif maupun arsip |
| PATCH | `/business-units/:id` | Rename/aktifkan kembali unit dan akun tertaut secara atomik |
| DELETE | `/business-units/:id` | Arsip unit dan akun tertaut secara atomik |

Rename menjaga nama akun `Pendapatan <nama unit>`. Arsip tidak menghapus jurnal
historis. Setiap mutasi master menghasilkan audit WEB dengan action standar
`<resource>.create|update|archive|reactivate|delete`; payload audit selalu melalui
redaksi data sensitif.
