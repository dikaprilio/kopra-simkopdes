# API CRUD (apps/api) & User Flow WhatsApp Agent

Kontrak kerja Dev 1 (api/web) ↔ Dev 2 (agent/WA). Semua endpoint JWT (kecuali login & webhook), semua query **selalu** scoped `koperasiId` user.

---

## 1. CRUD — REST apps/api

### Auth
| Method | Path | Isi |
|---|---|---|
| POST | `/auth/login` | email+password → JWT (berisi userId, koperasiId, role) |
| GET | `/auth/me` | profil user + koperasi |

### Members & Simpanan
| Method | Path | Isi |
|---|---|---|
| GET | `/members` | list; filter `?unpaid=true`, `?search=` |
| POST | `/members` | tambah anggota |
| PATCH | `/members/:id` | edit nama/noWA |
| GET | `/members/:id/simpanan` | status per periode (PAID/UNPAID) |
| POST | `/members/:id/simpanan/pay` | body `{periods: ["2026-01","2026-02"], amount}` — **dukung rapel multi-bulan** |

### Business Units · Accounts · Categories
| Method | Path | Isi |
|---|---|---|
| GET/POST | `/business-units` | list & tambah unit; PATCH `/:id` rename |
| GET | `/accounts` | KAS & BANK (dibuat seed; tak perlu CRUD penuh) |
| GET | `/categories` | kategori + klass (seed; POST opsional) |

### Transactions (inti ledger)
| Method | Path | Isi |
|---|---|---|
| GET | `/transactions` | filter `?month=&unitId=&status=&source=`; sort tanggal |
| POST | `/transactions` | input manual dari web (default CONFIRMED, `source: WEB`) |
| PATCH | `/transactions/:id` | edit **DRAFT saja** (ubah amount/kategori/unit) |
| POST | `/transactions/:id/confirm` | DRAFT → CONFIRMED (dipakai web & workflow resume) |
| DELETE | `/transactions/:id` | **DRAFT saja.** CONFIRMED tidak bisa dihapus/diedit — koreksi lewat jurnal balik (prinsip pembukuan; jawaban siap untuk juri) |

### Reports & Dashboard
| Method | Path | Isi |
|---|---|---|
| GET | `/dashboard/summary` | semua angka cards + performa per unit (SATU endpoint, SQL agregat) |
| GET | `/reports/buku-kas?month=2026-06` | JSON + `?format=html` print-friendly (kolom format asli Palbapang) |
| GET | `/reports/laba-rugi?month=` | idem; pendapatan per unit − beban |

### WhatsApp & Admin
| Method | Path | Isi |
|---|---|---|
| GET/POST/DELETE | `/wa-identities` | link/unlink nomor WA → user (halaman settings web) |
| POST | `/wa/webhook` | **bukan CRUD** — receiver event WAHA (tanpa JWT, cek header/api-key WAHA) |
| POST | `/admin/import-koperasi` | body `{sourceRef}` → jalankan import dari mirror data panitia |
| GET | `/audit-logs` | list (opsional di UI, tabel wajib terisi) |

Yang sengaja TIDAK ada: delete anggota (soft-issue, skip), CRUD kategori penuh, user management UI (2 user dari seed), edit transaksi confirmed.

---

## 2. User Flow WhatsApp Agent

### State per chat (deterministik, di luar LLM)
```
IDLE ──draft dibuat──► AWAITING_CONFIRMATION(draftId)
 ▲                            │
 │  "YA"/"ya"/"y" → confirm → CONFIRMED, balas sukses ──► IDLE
 │  "batal"/"gajadi" → hapus draft ─────────────────────► IDLE
 │  teks koreksi ("eh 450rb") → agent revisi draft → kirim ulang konfirmasi
 └─ pertanyaan lain → dijawab, draft tetap menunggu (bot ingatkan di akhir jawaban)
```
Implementasi: workflow Mastra `recordTransaction` suspended = state AWAITING; webhook cek dulu "ada suspended run untuk chat ini?" sebelum panggil agent bebas.

### Flow 0 — Nomor tak dikenal
```
User tak terdaftar: "halo"
Bot: perkenalan singkat Kopra + "nomor ini belum terhubung. Minta pengurus
     menautkan nomormu di menu Pengaturan → WhatsApp di webapp Kopra."
(Tidak ada akses data apa pun. Selesai.)
```

### Flow 1 — Catat transaksi (JALUR DEMO UTAMA)
```
Pengurus: "catat pemasukan banyu 500rb dari penjualan air galon"
  → agent ekstrak {type: INCOME, unit: BANEW, amount: 500000, desc}
  → tool createTransactionDraft (validasi unit & kategori ada) → DRAFT
  → workflow SUSPEND
Bot: "📝 Draft: Pemasukan • BANEW • Rp500.000 • 'penjualan air galon'
      • Kas • 10 Jul. Balas YA untuk simpan, atau koreksi."
Pengurus: "YA"
  → RESUME → POST /transactions/:id/confirm (kode, bukan LLM)
Bot: "✅ Tersimpan. Saldo kas: Rp3.724.000. Lihat: <link ledger>"
(→ pindah layar demo: transaksi muncul di webapp, badge 'WhatsApp')

Cabang koreksi: "eh salah, 450rb" → agent update draft → konfirmasi ulang
Cabang batal:  "gajadi" → draft dihapus → "Oke, dibatalkan."
```

### Flow 2 — Tanya keuangan
```
"pemasukan bulan ini berapa? naik ga dari bulan lalu?"
  → tool getFinancialSummary (SQL: total, per unit, MoM growth)
Bot: "Juni: pemasukan Rp4,2jt (↑18% dari Mei Rp3,5jt). Terbesar: BANEW
     Rp2,3jt. Pengeluaran Rp3,1jt → surplus Rp1,1jt." (angka = hasil query)
```

### Flow 3 — Tanya panduan (RAG)
```
"beli stok air mineral masuk operasional atau persediaan?"
  → tool searchKoperasiGuides → chunks + sumber
Bot: jawaban praktis + "(sumber: Panduan Pembukuan …)". Kalau dari interview:
     "dari temuan lapangan…". Tidak mengarang pasal.
```

### Flow 4 — Simpanan & penunggak
```
"siapa yang belum bayar simpanan wajib?"
  → tool listUnpaidMembers → "8 anggota, total Rp960rb: [Bu A (3 bln), …]"
  → bot tawarkan template pengingat → user "buatkan"
  → bot kirim TEKS template untuk di-copy pengurus
     (MVP TIDAK auto-broadcast ke anggota — guardrail etika & anti-spam)

(Fase 2b) "catat bu Sari bayar simpanan jan-mar 150rb"
  → draft pembayaran 3 periode → YA → periode PAID
```

### Flow 5 — Minta laporan
```
"kirim laporan buku kas juni"
  → tool generateReport → URL /reports/buku-kas?month=2026-06&format=html
Bot: "📄 Buku Kas Juni 2026: <link>. Total masuk Rp X, keluar Rp Y."
```

### Flow 6 (Fase 2b) — Media
```
Foto nota  → webhook download media → Claude vision ekstrak → masuk Flow 1 (draft)
Voice note → download audio → Whisper STT → teks → masuk Flow 1/2/3 sesuai isi
```

### Aturan lintas-flow
1. Satu draft pending per chat (draft baru saat masih AWAITING → bot minta selesaikan/batalkan dulu).
2. Semua tool call tercatat `audit_logs` (actor = user pemilik nomor).
3. Angka di balasan SELALU hasil query; LLM hanya merangkai kalimat.
4. Bahasa: Indonesia santai-sopan ala pendamping, bukan formal kaku.
5. Error tool (unit tak dikenal dll.) → bot minta klarifikasi, bukan menebak.
