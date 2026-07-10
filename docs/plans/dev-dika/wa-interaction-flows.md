# WA Interaction Flows — Skrip Verbatim (acuan copywriting bot & test fixtures)

**Workstream:** development/dika · **Induk:** [README.md](README.md) · Semua contoh di bawah menjadi dasar unit-test fixtures & prompt copywriting bot.


### F0 — Guest pertama kali chat
```
User (nomor asing): halo
Bot: Halo! 👋 Saya *Kopra*, asisten digital Koperasi Merah Putih.
     Saya bisa bantu jawab pertanyaan seputar koperasi (aturan, simpanan,
     SHU, RAT, cara pakai aplikasi koperasi).
     Nomor kamu belum terhubung ke koperasi mana pun.
     👉 Ketik *DAFTAR* untuk menghubungkan akun, atau langsung tanya saja.
User: apa bedanya simpanan pokok dan wajib?
Bot: (jawaban RAG + sumber)  — guest tetap boleh tanya publik
```

### F-DAFTAR — Registrasi via WA (guest → link web)
```
User: DAFTAR
Bot: Siap! Kamu mendaftar sebagai apa?
     1️⃣ *PENGURUS* koperasi
     2️⃣ *ANGGOTA* koperasi
     3️⃣ Daftarkan *KOPERASI BARU*
     (balas angka atau kata di atas)
User: 2
Bot: Oke, anggota. Koperasimu namanya apa? (ketik sebagian nama juga boleh)
User: palbapang
Bot: Ketemu! Pilih nomornya:
     1. KDMP Palbapang (Demo) — Bantul, DIY
     2. KOPERASI DESA MERAH PUTIH PALBAPANG SEJAHTERA — …
     (balas angka)
User: 1
Bot: 👍 Lanjutkan pendaftaran lewat tautan aman ini (isi nama, NIK &
     password di sana — *jangan kirim NIK lewat chat*):
     https://kopra.example/register/complete?token=…
     Tautan berlaku 15 menit.
[user isi form web → NIK cocok dgn data anggota]
Bot: ✅ Selamat datang di *KDMP Palbapang (Demo)*, Bu Sari!
     Akunmu langsung aktif karena NIK-mu terdaftar sebagai anggota.
     Coba: "info koperasi", "simpanan saya", atau tanya apa saja.
[ATAU: NIK tidak ditemukan]
Bot: 📝 Pendaftaranmu tercatat (kode R-014) dan menunggu persetujuan.
     Kami kabari lewat chat ini begitu disetujui ya!
```

### F-SUPERADMIN — sesi approval (hanya dari SUPER_ADMIN_WA_NUMBER)
```
SA: PERMOHONAN
Bot: 3 permohonan menunggu:
     • R-014 — ANGGOTA → KDMP Palbapang (Demo) — via WA — 12 mnt lalu
     • R-015 — PENGURUS → KDMP Sumberkolak — via WEB — 1 jam lalu
     • R-016 — KOPERASI BARU "Koperasi Maju Makmur" — 2 jam lalu
     Detail: DETAIL R-014 · Setujui: SETUJUI R-014 [ref] · Tolak: TOLAK R-014 <alasan>
SA: DETAIL R-015
Bot: R-015 — PENGURUS — KDMP Sumberkolak — pemohon: A*** (NIK 3402**...**11)
     Kandidat data resmi yang mirip:
     a. PGR-8842 — A*** S*** (pengurus, NIK 3402**...**11)
     b. tidak ada kandidat lain
SA: SETUJUI R-015 PGR-8842
Bot: ✅ R-015 disetujui & ditautkan ke PGR-8842. Pemohon sudah dinotifikasi.
```

### F1 — Catat transaksi (pengurus, DM) + koreksi + batal
```
Pengurus: catat pemasukan banyu 500rb dari penjualan air galon
Bot: 📝 *Draft Jurnal — mohon periksa:*
     Pemasukan • BANEW • *Rp500.000*
     "penjualan air galon" • Kas • 10 Jul 2026
     (Dr Kas / Cr Pendapatan BANEW — otomatis)
     👉 Balas *YA* untuk simpan, *BATAL* untuk batalkan, atau koreksi langsung
        (contoh: "eh 450rb" / "harusnya lewat bank")
Pengurus: eh salah, 450rb lewat bank
Bot: 📝 *Draft diperbarui:*
     Pemasukan • BANEW • *Rp450.000* • Bank BRI • 10 Jul 2026
     👉 Balas *YA* / *BATAL*
Pengurus: YA
Bot: ✅ Tersimpan! No. jurnal *JU-025*.
     Saldo Bank BRI sekarang: *Rp9.286.000*.
     Lihat di web: https://kopra.example/jurnal
[cabang batal] Pengurus: gajadi
Bot: 👌 Oke, draft dibatalkan. Tidak ada yang tersimpan.
[guard] — kalau masih ada draft menunggu dan pengurus kirim perintah baru:
Bot: ⏳ Masih ada draft menunggu keputusan (JU-025 draft). Balas *YA*/*BATAL*
     dulu ya, baru kita lanjut yang baru.
```

### F2 — Tanya keuangan (pengurus/anggota, DM — transparansi)
```
Anggota: pemasukan koperasi bulan ini berapa?
Bot: 💰 *Ringkasan Juni 2026 — KDMP Palbapang (Demo)*
     Pemasukan: *Rp4.216.000* (↑18% dari Mei)
     Pengeluaran: Rp3.104.000 → Surplus: *Rp1.112.000*
     Terbesar: BANEW Rp2.338.000 · MITRA SPPG Rp533.250
     (semua angka dari pembukuan, bukan perkiraan)
```

### F3 — Tanya panduan (RAG, semua role)
```
User: beli stok air mineral masuk operasional atau persediaan?
Bot: Masuk *Persediaan* 📦 — karena barang itu dibeli untuk dijual lagi,
     bukan dipakai operasional kantor. Nanti waktu terjual, nilainya pindah
     jadi pendapatan penjualan.
     📚 Sumber: Panduan Pembukuan — Klasifikasi Transaksi
```

### F4 — Penunggak & catat bayar simpanan (pengurus)
```
Pengurus: siapa saja yang belum bayar simpanan wajib?
Bot: 📋 *Penunggak simpanan wajib — 6 anggota (total Rp340.000):*
     1. Bu Painem — 3 bln (Apr–Jun) — Rp30.000
     2. Pak Wagiyo — 2 bln — Rp20.000
     … (4 lainnya)
     Mau saya buatkan *template pengingat* untuk di-copy? (bot TIDAK
     mengirim langsung ke anggota)
Pengurus: buatkan
Bot: (template teks siap copy-paste)
Pengurus: catat bu painem bayar simpanan apr-jun 30rb
Bot: 📝 *Draft:* Pembayaran simpanan wajib • Bu Painem • 3 periode
     (Apr, Mei, Jun 2026) • *Rp30.000* • Kas
     👉 Balas *YA* / *BATAL*
Pengurus: YA
Bot: ✅ Tercatat (JU-026). Status simpanan Bu Painem: LUNAS s.d. Jun 2026.
```

### F5 — Minta laporan
```
Pengurus: kirim laporan neraca saldo juni
Bot: 📄 *Neraca Saldo — Juni 2026*: https://kopra.example/api/v1/reports/neraca-saldo?from=2026-06-01&to=2026-06-30&format=html
     Status: *Neraca Seimbang* ✅ (Debit = Kredit = Rp19.393.173)
```

### F7 — Stok (pengurus DM; jual = 2 record 1 konfirmasi)
```
Pengurus: kejual minyakita 5
Bot: 📝 *Draft Penjualan:*
     MinyaKita 1L × 5 Pcs @Rp15.500 = *Rp77.500* (masuk Kas)
     Stok: 32 → *27 Pcs*
     (1 chat = 2 catatan: stok keluar + jurnal pemasukan)
     👉 Balas *YA* / *BATAL*
Pengurus: YA
Bot: ✅ Beres! Stok MinyaKita: *27 Pcs* · Kas +Rp77.500 (JU-027)
Pengurus: stok minyakita tinggal berapa?
Bot: 📦 MinyaKita 1L: *27 Pcs* (terakhir bergerak: hari ini, -5)
Pengurus: barang apa yang mau habis?
Bot: ⚠️ Hampir habis (≤5): Materai 10000 (3) · Gas LPG 3kg (4)
[produk tak dikenal]
Pengurus: kejual indomilk 2
Bot: Hmm, produk *"indomilk"* belum terdaftar. Mau saya daftarkan sebagai
     produk baru? Balas: "daftarkan, harga jual <harga>" atau BATAL.
```

### F-GRUP — binding + mention-only + batas akses
```
[Bot dimasukkan ke grup "Pengurus KDMP Palbapang"]
Bot: (scan participant → 4 dari 7 nomor terdaftar, semua koperasi sama)
Bot: 👋 Halo semua! Saya Kopra. Grup ini saya kenali sebagai grup
     *KDMP Palbapang (Demo)* (4 anggota terdaftar).
     Mention saya (@Kopra) kalau butuh: cek stok, info koperasi, atau
     tanya aturan koperasi. Untuk CATAT transaksi, japri saya ya 😊
[non-mention → bot diam, hanya menyimpan konteks]
Anggota: @Kopra stok gas masih ada?
Bot: 📦 Gas LPG 3kg: *4 Pcs* (hampir habis ⚠️)
Anggota: @Kopra pemasukan bulan ini berapa?
Bot: 🙏 Maaf, ringkasan keuangan di grup hanya untuk pengurus.
     (Pengurus bisa tanya di sini; anggota bisa lihat via akun web/DM sendiri)
Pengurus: @Kopra pemasukan bulan ini?
Bot: 💰 Juni: pemasukan Rp4.216.000, surplus Rp1.112.000. Rincian di DM/web ya.
Pengurus: @Kopra catat pemasukan gerai 100rb
Bot: 📵 Catat-mencatat lewat *japri* ya, biar aman & rapi → wa.me/62xxxx
     (di grup saya hanya melayani tanya-tanya)
[grup 0/multi koperasi]
Bot: Grup ini belum terhubung ke koperasi. Pengurus/anggota terdaftar,
     mention saya + sebut nama koperasimu ya. (Grup hanya bisa di-bind ke
     koperasi si penjawab.)
```

Aturan copywriting bot: emoji secukupnya (1–2/pesan) · angka selalu di-bold · selalu tawarkan langkah berikutnya · tak pernah menampilkan NIK utuh · bahasa "kamu/Bapak-Ibu" adaptif santai-sopan.

