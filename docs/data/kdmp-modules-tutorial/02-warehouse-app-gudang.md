---
title: "Warehouse App (Aplikasi Gudang) — Modul Inventory (Basis Pengetahuan)"
title_en: "Warehouse App — Inventory / Warehouse Module"
doc_role: module
module: Warehouse / Inventory (Gudang)
application: Warehouse App
part_of_suite: "Simkopdes Modules (KDMP) — 4 aplikasi; lihat 00-ikhtisar-suite.md"
language: id
sources:
  - "Inventory/Panduan Aplikasi Gudang - Koperasi Merah Putih.pdf (27 halaman)"
  - "Inventory/1..8 *.mov (8 klip, total ~29 menit, narasi Indonesia)"
source_note: "Disusun dari manual PDF (teks + tangkapan layar) dan 8 klip video. Beberapa detail (staf gudang, kolom Excel Kartu Stok, sebagian kolom form) hanya ada di video."
rag_note: "Dokumen mandiri (self-contained). Manual PDF dan video sumber TIDAK perlu diindeks ke RAG karena ukurannya besar; seluruh isi relevan sudah disalin ke sini."
generated: 2026-07-10
---

# Warehouse App (Inventory / Aplikasi Gudang)

> **Konteks suite.** Aplikasi ini adalah **satu dari empat** aplikasi terpisah yang melayani sebuah **Koperasi Desa Merah Putih (KDMP)**: Koperasi Merah Putih CORE, Warehouse App (modul ini), KDMP Mobile, dan POS System. Nama "Simkopdes" hanya nama folder. Ikhtisar suite ada di `00-ikhtisar-suite.md`.
>
> **Sumber vs. RAG.** Isi modul ini disusun dari manual PDF Warehouse App dan 8 klip video. Berkas-berkas itu berukuran besar dan **tidak perlu diindeks ke RAG** — dokumen ini sudah mandiri.

## Istilah Relevan (Glossary subset)

| Istilah (ID) | Padanan (EN) | Makna singkat |
|---|---|---|
| Gudang | Warehouse | |
| Barang Masuk | Inbound / goods receipt | |
| Barang Keluar | Outbound / goods issue | |
| Pemindahan Antar Bin | Bin-to-bin transfer | Pindah barang di dalam satu gudang |
| Bin | Bin / storage location | |
| Inventaris | Inventory (good stock) | Barang berkualitas baik |
| Karantina | Quarantine | Barang yang masih perlu pemeriksaan lanjutan |
| Rusak | Damaged | Barang rusak |
| SKU / Kode Barang | SKU / item code | |
| Kode Batch | Batch code | Opsional |
| Tanggal Kedaluwarsa | Expiry date | Opsional |
| Kartu Stok | Stock card | Berkas Excel mutasi keluar-masuk barang |
| Pemantauan Stok | Stock monitoring | |
| Perhitungan Stok | Stock count / stock opname | Cocokkan stok fisik vs stok sistem |
| Perhitungan Berkala | Cycle count | Hitung SKU tertentu, sewaktu-waktu |
| Perhitungan Menyeluruh | Full stock count | Hitung semua SKU, mis. bulanan |
| Permintaan Baru / Berlangsung / Penentuan / Selesai / Ditolak | New / In progress / Adjudication / Completed / Rejected | Status tugas |
| Terima / Tolak | Accept / Reject | Pasangan tombol persetujuan tugas |
| Mutasi | Stock movement | Positif = masuk, negatif = keluar |

---

## Gudang — Masuk Aplikasi (Login)

**Aplikasi:** Warehouse App
**Sumber:** `Inventory/1 ) Masuk Aplikasi.mov`

1. Saat pertama membuka aplikasi, klik tombol **Masuk** di **kanan atas**.
2. Isi **username atau email** dan **password** yang sudah terdaftar.
3. Klik **Sign In**.
4. Tunggu proses login hingga **menu-menu muncul di sebelah kiri**.

## Gudang — Navigasi (Navigation)

**Aplikasi:** Warehouse App
**Sumber:** `Inventory/Panduan Aplikasi Gudang - Koperasi Merah Putih.pdf`, klip 3 & 7

Menu sisi kiri terdiri atas tiga kelompok:

- **Daftar Gudang** (Gudang)
- **Aktivitas** → `Masuk Barang`, `Keluar Barang`, `Pemindahan Antar Bin`, `Pemantauan Aktivitas`
- **Persediaan** → `Pemantauan Stok`, `Perhitungan Stok`

## Gudang — Daftar Gudang (Warehouse List)

**Aplikasi:** Warehouse App
**Menu:** Daftar Gudang
**Sumber:** PDF hal. 3; `Inventory/2 ) Daftar Gudang.mov`

Menu **Gudang** berisi daftar gudang yang telah dibuat. Tabel memuat **nama gudang**, **alamat lengkap**, dan **tanggal terbuat**. Di kanan atas tabel ada tombol untuk **mendaftarkan gudang baru** (tombol `+ Gudang`). Di sebelah kanan tiap baris terdapat tombol untuk melihat **informasi detail** gudang.

Langkah pertama memakai aplikasi ini adalah **mendaftarkan gudang terlebih dahulu**.

## Gudang — Pendaftaran Gudang (Warehouse Registration Form)

**Aplikasi:** Warehouse App
**Menu:** Daftar Gudang > + Gudang
**Sumber:** PDF hal. 4; `Inventory/2 ) Daftar Gudang.mov`

**Kolom yang wajib diisi:** nama gudang, alamat lengkap, nomor telepon, dan email. **Catatan alamat tidak wajib** diisi.

Cara termudah mengisi alamat: **klik titik di peta** tempat gudang berada — alamat, koordinat, provinsi, kabupaten, kecamatan, kelurahan, dan kode pos akan **terisi otomatis**. Koreksi alamat bila ada yang tidak tepat.

Kolom lengkap pada form:

| Kolom | Keterangan |
|---|---|
| **Nama Gudang** | wajib (mis. `Warehouse Sweet Virtual`) |
| **Alamat** | wajib; alamat lengkap |
| **Lintang** / **Bujur** | koordinat (mis. `-6.202755911` / `106.740806495`); terisi dari peta |
| **Provinsi**, **Kabupaten/Kota**, **Kecamatan**, **Kelurahan**, **Kode Pos** | terisi otomatis dari peta |
| **Catatan Alamat** | opsional (mis. `Depan Puri Indah Mall Lippo`) |
| **No. Telepon** | wajib |
| **Email** | wajib |
| **Aktif/Nonaktif** | sakelar; pastikan **menyala hijau** agar gudang aktif |
| **Gudang Virtual** | sakelar penanda gudang virtual |

Peta memiliki mode **Map** dan **Satellite**. Setelah lengkap, klik **Simpan**.

## Gudang — Pengaturan Staf Gudang (Warehouse Staff Assignment)

**Aplikasi:** Warehouse App
**Menu:** Daftar Gudang > detail gudang > pengaturan staff
**Sumber:** `Inventory/2 ) Daftar Gudang.mov` — **hanya ada di video, tidak ada di PDF**

Setelah gudang **berhasil tersimpan**, muncul pengaturan tambahan terkait **staff** di sebelah kanan.

1. Klik pengaturan **staff**.
2. Tambahkan **akun yang berwenang** mengatur gudang tersebut: cari pengguna, lalu pilih.
3. Tetapkan perannya di gudang — contoh yang ditunjukkan: **Kepala Gudang**.
4. Klik **Tambah Staff**, lalu **Simpan**.

Kembali ke halaman **Daftar Gudang**, gudang baru sudah terbentuk.

## Gudang — Aktivitas > Masuk Barang (Inbound / Goods Receipt)

**Aplikasi:** Warehouse App
**Menu:** Aktivitas > Masuk Barang
**Sumber:** PDF hal. 5–8; `Inventory/3 ) Barang Masuk.mov`

Menu **Masuk Barang** berisi **daftar tugas untuk memasukkan barang ke dalam gudang**.

**Status tugas (tab):**

| Status | Arti |
|---|---|
| **Permintaan Baru** | Tugas masuk barang yang masih **menunggu konfirmasi** pihak gudang (belum diproses) |
| **Berlangsung** | Tugas yang telah **dikonfirmasi** pihak gudang dan sedang dikerjakan |
| **Selesai** | Tugas yang telah selesai dikerjakan |

Daftar menampilkan **kode transaksi**, **tanggal terbuat**, **tanggal terjadwal**, dan **banyak barang** dalam tugas tersebut. Klik **tombol panah `>` di sebelah kanan** untuk melihat detail.

**Informasi di bagian atas detail:**

- **Nomor Transaksi** — format contoh: `TRX/PO/250905/000007_C`
- **Tanggal Terbuat** — tanggal tugas masuk barang dibuat
- **Tanggal Terjadwal** — tanggal tugas dijadwalkan dilaksanakan
- **Pemeriksaan Masuk Barang** — waktu sistem memeriksa barang yang masuk
- **Peletakan Barang** — waktu sistem menambah stok barang

**Informasi di dalam tabel:** No, **Kode SKU & Nama SKU**, **Kode Batch & Tanggal Kedaluwarsa**, **Kuantitas** dan satuan barang, **Volume (m³)** per baris, serta **Total Volume (m³)** di bagian bawah.

**Kode Batch dan Tanggal Kedaluwarsa bersifat opsional.** Isi bila Anda ingin setiap barang masuk ditandai per batch (mis. `batch 1`) atau perlu mencatat tanggal kedaluwarsa produk.

**Persetujuan (tombol di kanan bawah):**

- **Terima** — klik **jika barang sudah benar-benar tiba di gudang**. Tugas otomatis pindah ke status **Berlangsung**.
- **Tolak** — klik **jika kedatangan barang dibatalkan**. Tugas masuk barang akan hilang (dinonaktifkan / tidak berlaku lagi).

Setelah **Terima**, tunggu hingga tugas **berpindah sendiri** dari *Berlangsung* ke *Selesai*. Bila tugas sudah hilang dari *Berlangsung*, artinya sudah masuk *Selesai* dan **stok bertambah**. Verifikasi lewat **Persediaan > Pemantauan Stok**.

## Gudang — Aktivitas > Keluar Barang (Outbound / Goods Issue)

**Aplikasi:** Warehouse App
**Menu:** Aktivitas > Keluar Barang
**Sumber:** PDF hal. 9–12; `Inventory/4 ) Barang Keluar.mov`

Menu **Keluar Barang** berisi **daftar tugas untuk mengeluarkan barang dari dalam gudang**. Tampilan serupa dengan Masuk Barang.

**Status tugas:** **Permintaan Baru** (menunggu konfirmasi), **Berlangsung** (telah dikonfirmasi, sedang dikerjakan), **Selesai**.

**Informasi di bagian atas detail:**

- **Nomor Transaksi**
- **Tanggal Terbuat**, **Tanggal Terjadwal**
- **Pengambilan Barang** — waktu sistem **mengurangi stok** barang
- **Pemeriksaan Keluar Barang** — waktu sistem memeriksa barang keluar

**Tabel detail:** Kode Barang, Nama Barang, Nomor/Kode Masuk Barang *(opsional)*, Tanggal Kedaluwarsa *(opsional)*, Kuantitas dan Satuan, Volume (m³) per baris, Total Volume. Detail juga menunjukkan **barang diambil dari batch nomor berapa dan kedaluwarsa tanggal berapa**.

**Persetujuan:**

- **Terima** — klik jika barang **sudah pasti akan dikeluarkan** berdasarkan permintaan; tugas otomatis pindah ke **Berlangsung**.
- **Tolak** — klik jika permintaan dibatalkan (misalnya **stok habis**); tugas akan hilang (dinonaktifkan).

Tunggu hingga tugas berpindah sendiri ke **Selesai**; **stok berkurang** sesuai barang yang keluar.

## Gudang — Aktivitas > Pemindahan Antar Bin (Bin-to-Bin Transfer)

**Aplikasi:** Warehouse App
**Menu:** Aktivitas > Pemindahan Antar Bin
**Sumber:** PDF hal. 13–17; `Inventory/5 ) Pemindahan Antar Bin.mov`

Menu **Pemindahan Antar Bin** berisi daftar tugas pemindahan barang **di dalam satu gudang yang sama**. Tujuannya **memisahkan barang berdasarkan kualitas** — contohnya barang rusak dipisahkan dari barang yang baik.

**Tipe lokasi (bin) berdasarkan kualitas:**

- **Inventaris** — tempat menyimpan barang bagus/baik.
- **Karantina** — tempat memisahkan barang yang **masih perlu pemeriksaan lebih lanjut**; belum pasti rusak atau bagus.
- **Rusak** — barang rusak.

**Empat status tugas:**

1. **Permintaan Baru** — tugas yang baru dibuat.
2. **Berlangsung** — tugas sedang diproses.
3. **Selesai** — tugas sudah selesai.
4. **Ditolak** — tugas yang ditolak (menampung semua tugas yang ditolak dari *Permintaan Baru*).

**Membuat tugas pemindahan:**

1. Klik tombol **Permintaan Baru** di kanan atas.
2. Pilih **tanggal penjadwalan** di kanan atas.
3. Klik **Tambah Barang** / **Tambah SKU** di kiri atas, lalu untuk tiap barang isi:
   - **Tipe Lokasi Asal**: Inventaris / Rusak / Karantina
   - **Kode Masuk Barang / Tanggal Kedaluwarsa** (dari lokasi asal)
   - **Tipe Lokasi Tujuan**: Inventaris / Rusak / Karantina
   - **Kuantitas** barang yang ingin dipindahkan — sistem menampilkan kuantitas tersedia di bin asal (mis. *195 pieces di Inventaris*)
   - Klik **Kirim** untuk menambahkan barang ke daftar pemindahan.
4. Ulangi untuk barang lain bila perlu.
5. Klik **Kirim** lagi untuk **membuat tugas baru** (status **Permintaan Baru**).

**Tabel daftar pemindahan** memuat: kode dan nama barang, tipe lokasi asal dan tujuan, kuantitas yang akan dipindahkan, serta tombol **`>`** untuk mengubah detail atau membatalkan barang tersebut dengan tombol **Hapus**.

**Mengerjakan tugas:** buka kembali tugas → klik **detail** →

- **Terima** — menyetujui tugas, masuk ke status **Berlangsung**.
- **Tolak** — menolak tugas, masuk ke status **Ditolak**.

Tunggu hingga tugas berpindah sendiri ke **Selesai**. Stok pada bin asal berkurang dan bin tujuan bertambah; verifikasi pada **Pemantauan Stok** dengan berpindah tab **Karantina** atau **Rusak**.

## Gudang — Aktivitas > Pemantauan Aktivitas (Activity Calendar)

**Aplikasi:** Warehouse App
**Menu:** Aktivitas > Pemantauan Aktivitas
**Sumber:** PDF hal. 18–19; `Inventory/6 ) Pemantauan Aktivitas.mov`

Menu **Pemantauan Aktivitas** menampilkan **kalender** berisi daftar tugas per hari. Tiap jenis tugas dibedakan **berdasarkan warna** (legenda di kiri atas):

| Warna | Jenis aktivitas |
|---|---|
| **Biru** | Masuk Barang |
| **Merah** | Keluar Barang |
| **Kuning / Oranye** | Pemindahan Antar Bin |

**Angka pada tiap warna** menunjukkan **berapa banyak aktivitas** menurut jenisnya (mis. angka `2` berarti ada 2 tugas keluar barang hari itu).

Klik **tanggal** untuk menampilkan daftar tugas hari tersebut. Klik salah satu **tugas** untuk menampilkan **nama barang beserta kuantitasnya**.

## Gudang — Persediaan > Pemantauan Stok (Stock Monitoring)

**Aplikasi:** Warehouse App
**Menu:** Persediaan > Pemantauan Stok
**Sumber:** PDF hal. 20; `Inventory/7 ) Pemantauan Stock.mov`

Menu **Pemantauan Stok** berisi daftar barang dan kuantitas yang tersedia di dalam gudang.

- Di bagian **kiri/atas** terdapat pilihan berdasarkan **kualitas barang**: **Inventaris**, **Karantina**, **Rusak**.
- Di bagian **kanan** terdapat pencarian berdasarkan **nama gudang** dan **nama barang**.

Kolom tabel: **No**, **SKU** (kode + nama, mis. `BOOKSWEET / Note Book`), **Kuantitas Aktual / Tersedia**, **Sedang Disimpan (+)**, **Sedang Diambil (−)**, **Detail**.

> **Sedang Disimpan (+)** dan **Sedang Diambil (−)** akan terisi **jika ada aktivitas masuk/keluar barang yang masih dalam proses pengerjaan** (belum berstatus *Selesai*).

Klik **Detail** pada suatu barang → muncul **dua pilihan**:

1. **Tampilkan Rincian** — menampilkan detail barang **per kode batch atau per tanggal kedaluwarsa**. Setiap barang masuk berikutnya dipisahkan pada **baris baru**; total dari semua batch dihitung dan ditampilkan di baris total.
2. **Unduh Kartu Stok** — lihat bagian berikut.

## Gudang — Kartu Stok / Unduh Excel (Stock Card Export)

**Aplikasi:** Warehouse App
**Menu:** Persediaan > Pemantauan Stok > Detail > Unduh Kartu Stok
**Sumber:** `Inventory/7 ) Pemantauan Stock.mov` — **hanya ada di video, tidak ada di PDF**

1. Klik **Unduh Kartu Stok**.
2. Isi rentang tanggal kartu stok (**dari tanggal** hingga **sampai tanggal**).
3. Klik **Unduh**, lalu **Simpan** berkas.

Hasilnya adalah **satu berkas Excel** berisi **mutasi keluar-masuk barang**, dengan kolom:

| Kolom | Isi |
|---|---|
| **A** | Kode Barang |
| **B** | Nama Barang |
| **C** | Kode Aktivitas |
| **D** | Tipe Aktivitas — *outbound*, *inbound*, atau *pemindahan antar bin* |
| **E** | Keterangan aktivitas masuk barang (mirip kolom D) |
| **F** | Tanggal aktivitas dilakukan |
| **G** | Status barang — **Inventaris**, **Rusak**, atau **Karantina** |
| **H** | **Mutasi** — angka **positif = masuk**, angka **negatif = keluar** |
| **I** | **Saldo** setelah masuk/keluar barang tersebut |

## Gudang — Persediaan > Perhitungan Stok (Stock Count / Opname)

**Aplikasi:** Warehouse App
**Menu:** Persediaan > Perhitungan Stok
**Sumber:** PDF hal. 21–26; `Inventory/8 ) Perhitungan Stock.mov`

**Perhitungan Stok** digunakan sebagai sarana **pemeriksaan stok fisik terhadap stok sistem**.

Tabel memuat: **Kode Transaksi/Tugas**, **Tanggal Terbuat**, **Tanggal Terjadwal**, dan **Tipe Perhitungan**.

**Dua tipe perhitungan:**

| Tipe | Perilaku |
|---|---|
| **Perhitungan Stok Berkala** | Bisa dilakukan sewaktu-waktu; Anda **memilih SKU tertentu** yang ingin dihitung |
| **Perhitungan Stok Menyeluruh** | Misalnya per bulan; **semua SKU** yang ada di gudang tersebut akan dihitung |

**Lima status:**

1. **Permintaan Baru** — tugas yang belum dilakukan atau belum mendapat persetujuan.
2. **Berlangsung** — sedang dilakukan oleh **2 orang** (ada perhitungan 1 dan 2).
3. **Penentuan** — terdapat **perbedaan** antara perhitungan 1 dan 2, sehingga diperlukan **perhitungan 3** untuk memastikan.
4. **Selesai** — telah selesai dilakukan.
5. **Ditolak** — telah ditolak atau dibatalkan.

### Alur pembuatan tugas

1. Di halaman awal, **pilih gudang** terlebih dahulu.
2. Klik **+ Permintaan Baru**. Muncul layar berisi:
   - **Nama Gudang** (otomatis dari pilihan sebelumnya)
   - **Tanggal Terjadwal**
   - **Tipe Perhitungan Stok**
   - **Tambah SKU** — menambahkan daftar barang yang akan dihitung. Barang yang sama dapat muncul lebih dari sekali bila berada di bin berbeda (mis. buku tulis di *Inventaris* dan di *Rusak*) — pilih yang dimaksud.
   - **Tabel daftar SKU** — menampilkan kode SKU, nama SKU, kode batch, tanggal kedaluwarsa, **lokasi bin**, **status** (tipe barang berdasarkan kualitas), dan **kuantitas**.
3. Klik **Kirim** untuk membuat tugas. Tugas berada di status **Permintaan Baru**.

> Bila memilih **Perhitungan Stok Menyeluruh**, muncul informasi bahwa **semua SKU akan dihitung**.

### Detail tugas & memulai

4. Klik tombol **`>`** untuk menampilkan detail tugas.
5. Di halaman detail Anda dapat:
   - Klik **Tambah SKU** untuk menambahkan barang, lalu **Simpan**.
   - Klik **X** untuk menghapus baris barang, lalu **Simpan**.
   - Klik **Tolak** untuk membatalkan tugas → status **Ditolak**.
   - Klik **Mulai** untuk memulai tugas → status **Berlangsung**.

### Perhitungan 1 dan 2

6. Di status **Berlangsung**, klik lagi **`>`** untuk menampilkan detail; muncul kolom tambahan **Perhitungan 1** dan **Perhitungan 2**.
7. Mintalah **2 orang** di gudang untuk menghitung stok barang. **Keduanya tidak boleh saling tahu berapa hasil perhitungan yang lain.**
8. Perhitungan 1 dan 2 dapat diisi dengan **dua cara**:
   - Isi **langsung di halaman** tersebut.
   - Klik **Unduh Excel** untuk mengunduh formulir (dapat **dicetak** untuk dicatat oleh penghitung), isi kolom perhitungan 1 dan 2, kemudian **unggah**. Angka akan otomatis tersimpan.
9. Klik **Kirim** untuk memeriksa perhitungan 1 dan 2.
   - **Jika perhitungan 1 = perhitungan 2** untuk semua baris → tugas pindah ke **Selesai**; **stok telah disesuaikan**.
   - **Jika ada yang berbeda** → tugas pindah ke tab **Penentuan** untuk perhitungan 3.

### Perhitungan 3 (Penentuan)

10. Di status **Penentuan**, klik lagi **`>`** untuk menampilkan detail; muncul kolom **Perhitungan 3** — **penentu angka akhir** stok fisik yang sebenarnya tersedia.
11. Perhitungan 3 dapat diisi **langsung di halaman** atau lewat **Unduh Excel** → isi kolom perhitungan 3 → unggah.
12. Klik **Kirim** untuk **menyesuaikan stok berdasarkan perhitungan 3**. Tugas pindah ke **Selesai**.

**Contoh dari video:** buku tulis dihitung `190` oleh kedua penghitung → **selisih 0**. Penggaris dihitung `10` oleh orang pertama tetapi `9` oleh orang kedua → masuk **Penentuan**; perhitungan 3 menghasilkan `9` → **selisih −1** (berkurang 1). Stok penggaris di **Karantina** otomatis diubah dari `10` menjadi `9` sesuai perhitungan terakhir, dan dapat diverifikasi di **Pemantauan Stok**.

---

## Kesenjangan & Batasan Modul (Gaps — Warehouse App)

**Konteks:** Metadata agar RAG tidak mengarang jawaban.

1. **PDF berbentuk dek salindia:** banyak detail kolom hanya ada di tangkapan layar, bukan lapisan teks. Detail form pendaftaran gudang (Lintang, Bujur, Kode Pos, sakelar *Gudang Virtual*), **pengaturan staf gudang**, dan **Kartu Stok Excel** hanya terekam di video/tangkapan layar.
2. **Peran gudang** — hanya **Kepala Gudang** yang disebut, tanpa rincian hak akses.
3. **URL aplikasi Warehouse App** tidak pernah ditampilkan.
4. Semua nilai kuantitas/kode transaksi adalah **contoh demo**.
