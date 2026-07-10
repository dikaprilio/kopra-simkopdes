---
title: "KDMP Mobile — Modul Anggota (Basis Pengetahuan)"
title_en: "KDMP Mobile — Member Module"
doc_role: module
module: Member (Anggota)
application: KDMP Mobile
part_of_suite: "Simkopdes Modules (KDMP) — 4 aplikasi; lihat 00-ikhtisar-suite.md"
language: id
sources:
  - "Member/Dokumen Manual Pengguna Aplikasi KDMP MOBILE.pdf (15 halaman)"
  - "Member/Koperasi KDMP Member atau Anggota.mp4 (07:55, narasi Indonesia)"
source_note: "Disusun dari manual PDF KDMP Mobile dan video anggota."
rag_note: "Dokumen mandiri (self-contained). Manual PDF dan video sumber TIDAK perlu diindeks ke RAG karena ukurannya besar; seluruh isi relevan sudah disalin ke sini."
generated: 2026-07-10
---

# KDMP Mobile (Member / Anggota)

> **Konteks suite.** Aplikasi ini adalah **satu dari empat** aplikasi terpisah yang melayani sebuah **Koperasi Desa Merah Putih (KDMP)**: Koperasi Merah Putih CORE, Warehouse App, KDMP Mobile (modul ini), dan POS System. Nama "Simkopdes" hanya nama folder. Ikhtisar suite ada di `00-ikhtisar-suite.md`.
>
> **Sumber vs. RAG.** Isi modul ini disusun dari manual PDF KDMP Mobile dan video anggota. Berkas-berkas itu berukuran besar dan **tidak perlu diindeks ke RAG** — dokumen ini sudah mandiri.

## Istilah Relevan (Glossary subset)

| Istilah (ID) | Padanan (EN) | Makna singkat |
|---|---|---|
| Anggota | Member | Anggota koperasi |
| NIAK | Member number | Nomor anggota koperasi |
| Simpanan Pokok | Principal / initial savings | Dibayar **sekali** saat mendaftar; nominal tetap; dikembalikan bila keanggotaan berakhir |
| Simpanan Wajib | Mandatory monthly savings | Dibayar tiap bulan; nominal diatur tiap koperasi |
| Pinjaman | Loan | Pengajuan kredit oleh anggota |
| Angsuran | Installment | Cicilan bulanan pinjaman |
| Penjamin | Guarantor | Penjamin pinjaman anggota |
| Tenor / Jangka Waktu | Term (months) | Lama pinjaman dalam bulan |
| Bunga | Interest | Bunga pinjaman |
| Jatuh Tempo | Due date | Tanggal jatuh tempo |
| PPOB | Bill payment services | Pulsa, paket data, listrik, e-wallet, BPJS |

---

## KDMP Mobile — Akses & Login (Access & Login)

**Aplikasi:** KDMP Mobile (*by subaga-milenia*)
**Menu:** Halaman Login
**Sumber:** PDF hal. 3; `Member/Koperasi KDMP Member atau Anggota.mp4`

Untuk memulai akses ke aplikasi KDMP Mobile:

1. Buka aplikasi melalui **web browser** (Google Chrome/Edge atau lainnya) dengan alamat URL: **`https://member.kdmp.id/`**
2. Masukkan **Email** dan **Password** yang sudah didaftarkan, kemudian tekan tombol **Masuk**.
3. Jika anggota belum mendaftar, klik tulisan di bagian bawah: **"Belum punya akun? Daftar di sini."**

## KDMP Mobile — Registrasi Anggota (Member Registration)

**Aplikasi:** KDMP Mobile
**Menu:** Registrasi Anggota
**Sumber:** PDF hal. 3–4; video anggota

Anggota **wajib mengisi semua identitas**: **Nama Lengkap, Email, Username, Password, Nomor Telepon, Jenis Kelamin, NIK, Agama, Pendidikan, Profesi, Tanggal Lahir, dan Tempat Lahir.**

**Aturan pengisian:**

| Kolom | Aturan |
|---|---|
| **Nama Lengkap** | Tidak harus huruf besar semua; cukup huruf awal tiap kata — mis. `"Tes Member"` hanya `T` dan `M` yang besar |
| **Email** dan **Username** | **huruf kecil semua** |
| **Password** | huruf kecil semua, **minimal 8 digit**, bebas kombinasi huruf dan angka |
| **NIK** | **wajib 16 digit** sesuai nomor induk KTP |

Setelah data diri, **scroll ke bawah** ke bagian **Lokasi Koperasi** — isi detail lokasi koperasi yang menjadi **tujuan pendaftaran**: **Provinsi**, **Kota/Kabupaten**, **Kecamatan**, **Desa/Kelurahan**, lalu tulis **Alamat Domisili** dari koperasi yang dituju. (Semua wajib.)

Klik **Daftar**. Muncul pemberitahuan **"Registrasi berhasil — Akun Anda telah dibuat. Silakan login untuk melanjutkan."**, lalu anggota dikembalikan ke halaman **Login**.

## KDMP Mobile — Pembayaran Simpanan Pokok (Principal Savings Payment)

**Aplikasi:** KDMP Mobile
**Menu:** Pembayaran Simpanan Pokok (aktivasi akun)
**Sumber:** PDF hal. 5–7; video anggota

Ketika anggota login **untuk pertama kali**, muncul pemberitahuan **"Pembayaran Diperlukan — Silakan lakukan pembayaran simpanan pokok untuk mengaktifkan akun Anda."**

**Sifat Simpanan Pokok:**

- Jumlahnya **tidak akan naik ataupun turun**.
- **Hanya dibayarkan sekali** ketika anggota mendaftar di koperasi.
- Ketika anggota **keluar** dan status keanggotaannya **tidak aktif**, anggota **berhak mendapatkan kembali** simpanan pokok yang sudah dibayarkan.
- **Regulasi jumlahnya berbeda-beda** untuk masing-masing koperasi.

**Alur:**

1. Muncul layar **"Memeriksa Status Pembayaran"**. Jika anggota **belum membayar**, pemberitahuan ini akan **terus muncul**; jika **sudah membayar**, pemberitahuan tidak muncul dan anggota langsung masuk aplikasi.
2. Anggota diarahkan ke halaman **Informasi Pembayaran Simpanan Pokok**, menampilkan **Total Bayar** (contoh: `Rp 50.000`) dan **Informasi Koperasi → Nama Koperasi** (contoh: `Koperasi Digital Mitra Perkasa`) sesuai tujuan yang dimasukkan saat pendaftaran.
3. Muncul **Pilih Metode Pembayaran** — *"Bayar melalui Virtual Account, QRIS, atau E-Wallet. Akun akan langsung aktif setelah pembayaran berhasil."*
   - **Virtual Account**
   - **QRIS**
   - **E-Wallet**
4. Klik **Buat Pembayaran** → muncul halaman **Menunggu Pembayaran**. Selesaikan pembayaran sesuai instruksi di aplikasi.
5. Setelah selesai, muncul pemberitahuan **"Akun Berhasil Diaktifkan"**. Anggota dapat mengakses KDMP Mobile.

## KDMP Mobile — Beranda (Home)

**Aplikasi:** KDMP Mobile
**Menu:** Beranda
**Sumber:** PDF hal. 8; video anggota

Di bagian **paling atas** Beranda terlihat: **Nama Anggota**, **Nomor Anggota** (NIAK, mis. `NK11691760761214092344`), **Foto**, dan **Total Saldo** anggota. Untuk **keluar dari aplikasi**, klik **tombol panah di kanan atas** Beranda.

**Scroll sedikit ke bawah** → fitur **Layanan PPOB**, tempat anggota dapat melakukan:

- Pembelian **Pulsa**
- Pembelian **Paket Data**
- **Listrik PLN**
- Pengisian **E-Wallet**
- Pembayaran **BPJS**

**Scroll lagi** → panel **Simpanan** (*Overview simpanan*): **Simpanan Pokok** dan **Simpanan Wajib**; serta **Ringkasan Pinjaman** (*Overview status dan total pinjaman*): **Total Pinjaman** dan **Total Cicilan per Bulan**.

> **Belum terdokumentasi:** alur rinci tiap layanan PPOB tidak didemonstrasikan di sumber mana pun.

## KDMP Mobile — Simpanan Wajib (Mandatory Monthly Savings)

**Aplikasi:** KDMP Mobile
**Menu:** Simpanan Wajib
**Sumber:** PDF hal. 9–10; video anggota

Halaman ini **melist Simpanan Wajib yang harus dibayarkan anggota setiap bulannya**. **Regulasi jumlah** yang harus dibayarkan tiap bulan **tergantung regulasi setiap koperasi**.

**Ringkasan di bagian atas:** **Tahun** (mis. `2025`), **Total Simpanan Wajib**, **Bulan Terbayar**, dan bilah kemajuan (mis. *`0 dari 12 bulan lunas (0%)`*).

**Tab filter:** **Semua**, **Belum Bayar**, **Pending**, **Lunas**.

Setiap baris mewakili satu bulan (mis. `January 2025` / `2025-01`) dengan lencana statusnya.

**Membayar:**

1. Klik tombol **Belum Bayar** pada bulan yang dimaksud → muncul form **Bayar Simpanan Wajib**.
2. Masukkan **Jumlah (IDR)** yang harus dibayarkan (mis. `Rp 25.000`).
3. Pilih **Metode Pembayaran** (mis. *Virtual Account*).
4. Klik **Buat Pembayaran** (atau **Batal**), kemudian selesaikan pembayaran.
5. Muncul pemberitahuan **Pembayaran Berhasil**; anggota diarahkan kembali ke **Beranda**.

**Riwayat:** klik tombol **Riwayat** di kanan atas halaman Simpanan Wajib untuk melihat **list transaksi Simpanan Wajib** yang sudah dibayarkan.

## KDMP Mobile — Pinjaman: Pengajuan (Loan Application)

**Aplikasi:** KDMP Mobile
**Menu:** Pinjaman > Ajukan Baru
**Sumber:** PDF hal. 11–12; video anggota

Fitur **Pinjaman** memiliki dua halaman/tab: **Daftar Pengajuan** (pengajuan yang sudah dilakukan) dan **Ajukan Baru** (membuat pengajuan). Terdapat **Filter Status** (mis. *Semua Status*) dan penghitung (mis. *1 dari 1 pengajuan*).

**Formulir Pengajuan Pinjaman:**

| Kolom | Wajib |
|---|---|
| **Jumlah Pengajuan** | ya |
| **Jangka Waktu (Bulan)** — angsuran | ya |
| **Tujuan Pinjaman** (mis. *Usaha/Bisnis*, *Pendidikan*) | ya |
| **Detail Tujuan Pinjaman** — jelaskan secara detail tujuan penggunaan pinjaman | ya |
| **Deskripsi** | opsional |

**Scroll ke bawah** → **Informasi Penjamin** (semua wajib):

- **Nama Penjamin**
- **NIK Penjamin** — **16 digit**
- **Alamat Penjamin**
- **Nomor Telepon Penjamin**
- **Hubungan dengan Penjamin** (pilih)
- **Upload KTP**

Pastikan semua data sesuai dan tidak salah, lalu klik **Submit Pengajuan**.

> Pengajuan kemudian **ditinjau pengurus koperasi** melalui aplikasi **Koperasi Merah Putih CORE** (menu *Pinjaman*), untuk **diterima atau ditolak**.

## KDMP Mobile — Pinjaman: Detail & Kartu Pengajuan (Loan Detail)

**Aplikasi:** KDMP Mobile
**Menu:** Pinjaman > Daftar Pengajuan > Lihat Detail
**Sumber:** PDF hal. 11–12; video anggota

**Kartu pengajuan** pada Daftar Pengajuan menampilkan nomor pinjaman (mis. `#LN1169101760763803691`), lencana status (mis. **Aktif**), serta: **Tanggal Pengajuan**, **Jumlah**, **Tenor**, **Bunga**, **Angsuran Bulanan**, **Total Pinjaman**, **Angsuran Dibayar**, **Tujuan**, dan tombol **Lihat Detail**.

**Halaman Detail Pinjaman** berisi empat panel:

1. **Informasi Pinjaman** — Jumlah Pinjaman, Total Pinjaman, Angsuran Bulanan, Bunga, Tenor, Sisa Angsuran, Sisa Pokok, Tujuan Pinjaman.
2. **Status & Timeline** — Status Pinjaman, Tanggal Pengajuan, Tanggal Disetujui, Jatuh Tempo, Pembayaran Pertama, Pembayaran Terakhir.
3. **Tujuan & Deskripsi** — Tujuan Pinjaman, Detail Tujuan, Deskripsi, **Catatan Persetujuan** (mis. *Setuju*).
4. **Ringkasan** — Total Dibayar, Total Terlambat, Sisa Angsuran, dan tombol **Lihat Jadwal**.

**Contoh angka dari dokumen sumber** (bukan ketentuan koperasi mana pun):

| Field | Nilai |
|---|---|
| Jumlah Pinjaman | Rp 500.000 |
| Tenor | 3 bulan |
| Bunga | 12,00% |
| Angsuran Bulanan | Rp 226.667 |
| Total Pinjaman | Rp 680.000 |

Rincian per angsuran: **Pokok Rp 166.667 + Bunga Rp 60.000 = Rp 226.667**. Karena bunga tetap `Rp 60.000` tiap bulan (`= 12% × Rp 500.000`), contoh ini konsisten dengan **bunga flat 12% per bulan terhadap pokok awal** (3 × Rp 60.000 = Rp 180.000 total bunga). *Ini adalah pembacaan atas contoh di dokumen; sumber tidak menyatakan rumus bunga secara eksplisit.*

## KDMP Mobile — Pinjaman: Jadwal & Pembayaran Angsuran (Repayment Schedule)

**Aplikasi:** KDMP Mobile
**Menu:** Pinjaman > Detail Pinjaman > Lihat Jadwal
**Sumber:** PDF hal. 13–14; video anggota

Untuk membayar angsuran, **scroll ke bawah** halaman Detail Pinjaman lalu klik **Lihat Jadwal**.

**Halaman Jadwal Pembayaran** menampilkan **Ringkasan Pembayaran**: **Total Angsuran** (mis. `3 kali`), **Sudah Dibayar** (mis. `0 kali`), **Sisa Angsuran** (mis. `3 kali`), **Jumlah per Angsuran** (mis. `Rp 226.667`), serta panel **Angsuran Mendatang**.

**Daftar Angsuran** menampilkan tiap bulan sebagai kartu **Angsuran ke-1 / ke-2 / ke-3** dengan lencana status (mis. **Menunggu**) dan: **Jatuh Tempo**, **Bunga**, **Pokok**, **Total Bayar**, serta tombol **Bayar**.

**Alur pembayaran:**

1. Klik **Bayar** pada angsuran yang dituju.
2. Muncul opsi **Metode Pembayaran**: **Virtual Account**, **QRIS**, atau **E-Wallet**.
3. Klik **Bayar Sekarang**.
4. Setelah selesai membayar, muncul pemberitahuan **Pembayaran Berhasil** dan anggota diarahkan kembali ke **Beranda**.

## KDMP Mobile — Profil Anggota (Member Profile)

**Aplikasi:** KDMP Mobile
**Menu:** Profil
**Sumber:** PDF hal. 15; video anggota

Fitur **Profil Anggota** menampilkan **Informasi Personal** anggota:

- **NIAK** (nomor anggota, mis. `NK11691760761214092344`)
- **Nama**
- **Jenis Kelamin & Usia**
- **Tempat, Tanggal Lahir**
- **Pekerjaan**

Anggota juga dapat **mengganti foto profil** (ikon kamera) dan **mengganti password** dengan klik tombol **Ubah Password** di **kanan atas** fitur.

---

## Kesenjangan & Batasan Modul (Gaps — KDMP Mobile)

**Konteks:** Metadata agar RAG tidak mengarang jawaban.

1. **Alur rinci PPOB** (Pulsa, Paket Data, Listrik PLN, E-Wallet, BPJS) tidak didemonstrasikan di sumber mana pun.
2. **Alur persetujuan pinjaman** dilakukan di aplikasi **Koperasi Merah Putih CORE** (di luar aplikasi ini) dan tidak dirinci.
3. **Ketentuan simpanan/bunga yang mengikat.** Angka (Rp 50.000 simpanan pokok, Rp 25.000 simpanan wajib, bunga 12%) berasal dari **data contoh/demo**; sumber menegaskan **regulasi tiap koperasi berbeda-beda**.
4. Satu-satunya URL aplikasi yang tercantum di seluruh suite adalah milik KDMP Mobile: `https://member.kdmp.id/`.
