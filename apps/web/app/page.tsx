import Image from 'next/image';
import Link from 'next/link';

const rise = (delay: number) => ({ animationDelay: `${delay}s` });

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--biru)]">
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <main className="font-body min-h-screen bg-[var(--kertas)] text-[var(--tinta)]">
      {/* ── Hero (full-bleed illustration) ── */}
      <section className="relative flex min-h-[92vh] flex-col">
        <Image
          src="/landing-illustration.png"
          alt="Suasana desa dengan gerai Koperasi Merah Putih dan warga yang berkumpul di halamannya"
          fill
          priority
          className="object-cover"
        />
        {/* dusk-blue overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#14213d]/75 via-[#14213d]/45 to-[#14213d]/60" />
        {/* bottom vignette — bleeds into the next section's paper background */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[var(--kertas)] via-[var(--kertas)]/55 to-transparent" />

        {/* Nav */}
        <header className="relative z-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-white">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-display text-2xl italic">Kopra</span>
              <span className="hidden text-sm text-white/70 sm:inline">
                asisten koperasi di WhatsApp
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <a href="#cara-kerja" className="hidden text-white/80 hover:text-white sm:inline">
                Cara kerja
              </a>
              <a href="#fitur" className="hidden text-white/80 hover:text-white sm:inline">
                Fitur
              </a>
              <a href="#prinsip" className="hidden text-white/80 hover:text-white md:inline">
                Prinsip
              </a>
              <Link
                href="/login"
                className="rounded-full bg-[var(--primer)] px-5 py-2 font-medium text-white transition hover:bg-[var(--primer-tua)]"
              >
                Masuk
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero copy */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-6">
          <div className="mx-auto max-w-3xl space-y-8 py-20 text-center">
            <p
              className="kopra-rise font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-white/80"
              style={rise(0.05)}
            >
              Koperasi Desa Merah Putih · Pembukuan via WhatsApp
            </p>
            <h1
              className="font-display kopra-rise text-5xl leading-[1.08] font-normal italic tracking-tight text-white md:text-7xl"
              style={rise(0.15)}
            >
              Chat masuk,
              <br />
              pembukuan jadi.
            </h1>
            <p
              className="kopra-rise mx-auto max-w-2xl text-lg leading-relaxed text-white/85"
              style={rise(0.3)}
            >
              Kopra hidup di WhatsApp — tempat pengurus koperasi memang bekerja setiap hari. Tulis
              transaksi seperti Anda mengetik ke rekan sendiri, balas{' '}
              <strong className="text-white">YA</strong>, dan Kopra merapikannya menjadi jurnal,
              kartu stok, dan laporan berstandar Koperasi Merah Putih CORE. Tanpa aplikasi baru.
              Tanpa istilah akuntansi.
            </p>
            <div className="kopra-rise flex flex-wrap items-center justify-center gap-4" style={rise(0.45)}>
              <Link
                href="/login"
                className="rounded-full bg-[var(--primer)] px-7 py-3 font-medium text-white shadow-lg shadow-black/20 transition hover:bg-[var(--primer-tua)]"
              >
                Masuk ke dashboard
              </Link>
              <a
                href="#cara-kerja"
                className="font-medium text-white underline decoration-white/40 decoration-2 underline-offset-8 hover:decoration-[var(--primer)]"
              >
                Lihat cara kerjanya ↓
              </a>
            </div>
            <p className="kopra-rise font-mono text-xs text-white/60" style={rise(0.6)}>
              Struktur datanya sama dengan suite resmi KDMP — siap terhubung, bukan sistem
              tandingan.
            </p>
          </div>
        </div>
      </section>

      {/* ── Kenapa ── */}
      <section id="kenapa">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-2xl space-y-5">
            <Eyebrow>Kenapa Kopra ada</Eyebrow>
            <h2 className="font-display text-4xl font-medium tracking-tight">
              Masalahnya bukan aplikasinya.
            </h2>
            <p className="leading-relaxed text-[var(--tinta-muda)]">
              Sistem digital koperasi sudah ada, dan fiturnya lengkap. Yang berhenti adalah
              pengisian hariannya — karena layarnya bukan tempat pengurus bekerja. Dari riset kami
              di lapangan, pekerjaan koperasi yang sebenarnya berjalan di WhatsApp: pesan barang ke
              mitra, menagih simpanan, kirim laporan ke grup.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--garis)] bg-[var(--garis)] md:grid-cols-3">
            {[
              {
                angka: '92% → <1%',
                teks: 'koperasi desa punya akun sistem resmi, tapi kurang dari 1% yang aktif memakainya untuk bisnis.',
              },
              {
                angka: '640 vs 301',
                teks: 'koperasi sudah mendaftarkan produknya — hanya 301 yang pernah mencatat barang masuk atau keluar.',
              },
              {
                angka: '44 tahun',
                teks: 'umur median pengurus koperasi. Melatih ulang ribuan orang memakai aplikasi baru bukan jalan yang realistis.',
              },
            ].map((s) => (
              <div key={s.angka} className="bg-white p-8">
                <p className="font-display text-3xl font-medium text-[var(--primer)]">{s.angka}</p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--tinta-muda)]">{s.teks}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-[var(--tinta-muda)]">
            Sumber: data resmi Kemenkop/SIMKOPDES & riset lapangan tim di KDMP Bantul, 2026.
          </p>
        </div>
      </section>

      {/* ── Cara kerja ── */}
      <section id="cara-kerja" className="border-t border-[var(--garis)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-2xl space-y-5">
            <Eyebrow>Cara kerja</Eyebrow>
            <h2 className="font-display text-4xl font-medium tracking-tight">
              Tiga langkah, semuanya di chat.
            </h2>
          </div>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                no: '1',
                judul: 'Tulis seperti Anda bicara',
                isi: 'Ketik "kejual minyakita 5", "bayar listrik 200rb", atau "bu Sari bayar simpanan wajib jan–mar". Kopra paham bahasa sehari-hari — termasuk foto nota dan pesan suara.',
              },
              {
                no: '2',
                judul: 'Periksa, lalu balas YA',
                isi: 'Sebelum mencatat apa pun, Kopra menunjukkan ringkasannya dulu. Benar? Balas YA. Keliru? Tulis saja "eh, 450rb". Berubah pikiran? "gajadi". Tidak ada yang masuk buku tanpa persetujuan Anda.',
              },
              {
                no: '3',
                judul: 'Buku tercatat, laporan jadi sendiri',
                isi: 'Satu chat penjualan mencatat dua hal sekaligus: stok berkurang, kas bertambah. Buku Besar, Neraca Saldo, PHU, dan Neraca tersusun otomatis — tinggal cetak saat RAT.',
              },
            ].map((l) => (
              <li key={l.no} className="space-y-3 border-t-2 border-[var(--primer)] pt-5">
                <p className="font-mono text-xs text-[var(--biru)]">Langkah {l.no}</p>
                <h3 className="font-display text-xl font-medium">{l.judul}</h3>
                <p className="text-sm leading-relaxed text-[var(--tinta-muda)]">{l.isi}</p>
              </li>
            ))}
          </ol>

          {/* Demo: satu chat, dua buku */}
          <div className="mt-16 grid items-start gap-6 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[var(--garis)] bg-white shadow-sm">
              <div className="flex items-center gap-3 bg-[var(--hijau-wa)] px-5 py-3 text-white">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 font-display italic">
                  K
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Kopra</p>
                  <p className="text-xs text-white/80">online</p>
                </div>
              </div>
              <div className="space-y-3 px-4 py-5 text-sm">
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--hijau-bubble)] px-4 py-2.5">
                    Kejual minyakita 5
                  </p>
                </div>
                <div className="flex">
                  <p className="max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--garis)] bg-[var(--kertas)] px-4 py-2.5">
                    📝 Penjualan <strong>MinyaKita</strong> — 5 pcs × Rp15.000 = <strong>Rp75.000</strong>.
                    Stok sisa 43. Balas <strong>YA</strong> untuk mencatat.
                  </p>
                </div>
                <div className="flex justify-end">
                  <p className="rounded-2xl rounded-br-sm bg-[var(--hijau-bubble)] px-4 py-2.5">YA</p>
                </div>
                <div className="flex">
                  <p className="max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--garis)] bg-[var(--kertas)] px-4 py-2.5">
                    ✅ Tercatat. Kas bertambah Rp75.000, stok MinyaKita 43. Jurnalnya sudah muncul
                    di dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="font-mono text-xs text-[var(--biru)]">
                satu chat, dua buku — yang lahir di dashboard:
              </p>
              <div className="rounded-2xl border border-[var(--garis)] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--garis)] pb-3 font-mono text-xs">
                  <span className="font-semibold">JU-018 · 11 Jul 2026</span>
                  <span className="rounded-full bg-[var(--hijau-bubble)] px-2.5 py-1 text-[var(--hijau-wa)]">
                    via WhatsApp
                  </span>
                </div>
                <table className="mt-3 w-full font-mono text-xs">
                  <tbody>
                    <tr className="border-b border-dashed border-[var(--garis)]">
                      <td className="py-2">111000 · Kas Rupiah</td>
                      <td className="py-2 text-right">Rp75.000</td>
                      <td className="w-20 py-2 text-right text-[var(--tinta-muda)]">—</td>
                    </tr>
                    <tr className="border-b border-dashed border-[var(--garis)]">
                      <td className="py-2">410200 · Pendapatan Penjualan</td>
                      <td className="py-2 text-right text-[var(--tinta-muda)]">—</td>
                      <td className="py-2 text-right">Rp75.000</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[var(--hijau-wa)]">Seimbang ✓</span>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--garis)] bg-white p-5 shadow-sm">
                <p className="border-b border-[var(--garis)] pb-3 font-mono text-xs font-semibold">
                  Kartu stok · MinyaKita
                </p>
                <div className="mt-3 flex items-center justify-between font-mono text-xs">
                  <span>Keluar 5 pcs · penjualan</span>
                  <span>
                    48 → <strong>43</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fitur ── */}
      <section id="fitur" className="border-t border-[var(--garis)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-2xl space-y-5">
            <Eyebrow>Yang bisa dicatat & ditanya</Eyebrow>
            <h2 className="font-display text-4xl font-medium tracking-tight">
              Satu asisten untuk pekerjaan harian koperasi.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                judul: 'Transaksi harian',
                isi: '"catat pemasukan banyu 500rb" langsung menjadi jurnal berstandar CORE, terpilah per unit usaha. Anda tidak pernah menyentuh debit–kredit.',
              },
              {
                judul: 'Stok gerai',
                isi: 'Barang masuk, barang terjual, barang menipis. "stok minyakita berapa?" dijawab dari catatan — bukan dari ingatan.',
              },
              {
                judul: 'Simpanan anggota',
                isi: 'Simpanan pokok & wajib per bulan, bayar rapel sekaligus, daftar penunggak, plus template pengingat yang Anda kirim sendiri ke anggota.',
              },
              {
                judul: 'Laporan siap RAT',
                isi: 'Empat laporan resmi — Buku Besar, Neraca Saldo, PHU, Neraca — plus tampilan Buku Kas untuk yang terbiasa buku lama. Semuanya siap cetak.',
              },
              {
                judul: 'Tanya panduan',
                isi: '"Beli stok air masuk operasional atau persediaan?" Kopra menjawab lengkap dengan sumbernya: panduan resmi, undang-undang, dan praktik lapangan.',
              },
              {
                judul: 'Foto nota & pesan suara',
                isi: 'Nota belanja cukup difoto — Kopra membacanya jadi draf stok masuk sekaligus pengeluaran kas. Malas mengetik? Kirim voice note.',
              },
            ].map((f) => (
              <div key={f.judul} className="rounded-2xl border border-[var(--garis)] bg-white p-7">
                <h3 className="font-display text-lg font-medium">{f.judul}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--tinta-muda)]">{f.isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prinsip ── */}
      <section id="prinsip" className="border-t border-[var(--garis)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <Eyebrow>Prinsip kami</Eyebrow>
              <h2 className="font-display text-4xl font-medium tracking-tight">
                Angka tidak pernah dikarang.
              </h2>
              <p className="leading-relaxed text-[var(--tinta-muda)]">
                Kopra memakai AI untuk memahami bahasa Anda — bukan untuk menghitung uang Anda.
                Yang berhitung selalu sistem, dengan aturan yang sama setiap kali.
              </p>
            </div>
            <ul className="space-y-6">
              {[
                'Semua angka dihitung dari database. AI hanya merangkai kalimat penjelasannya.',
                'Tidak ada satu rupiah pun tercatat sebelum Anda membalas YA.',
                'Catatan yang sudah dikonfirmasi terkunci. Koreksi dilakukan lewat jurnal balik, jadi jejaknya tetap tersimpan — siap diaudit saat RAT.',
                'Nomor yang tidak dikenal tidak punya akses apa pun, dan setiap aksi tercatat di log audit.',
              ].map((p, i) => (
                <li key={i} className="flex gap-4 border-b border-[var(--garis)] pb-6 last:border-none">
                  <span className="font-mono text-sm text-[var(--primer)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed">{p}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-[var(--garis)]">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-24">
          <h2 className="font-display mx-auto max-w-3xl text-4xl leading-tight font-medium tracking-tight md:text-5xl">
            Koperasi naik kelas akuntansi,{' '}
            <em className="text-[var(--primer)]">tanpa harus belajar akuntansi.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[var(--tinta-muda)]">
            Volume usaha yang tercatat adalah volume usaha yang bisa dibuktikan — ke anggota saat
            RAT, ke mitra, dan ke lembaga pembiayaan.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[var(--primer)] px-7 py-3 font-medium text-white transition hover:bg-[var(--primer-tua)]"
            >
              Masuk ke dashboard
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-[var(--tinta)] px-7 py-3 font-medium transition hover:bg-white"
            >
              Daftarkan koperasi Anda
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--garis)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--tinta-muda)] md:flex-row">
          <p>
            <span className="font-display italic text-[var(--tinta)]">Kopra</span> · Tim Fandelion
          </p>
          <p className="font-mono text-xs">
            Hackathon Digital Cooperatives Expo 2026 · Kemenkop RI × PEBS FEB UI
          </p>
        </div>
      </footer>
    </main>
  );
}
