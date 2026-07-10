'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';

type KoperasiOption = { label: string; koperasiId?: string; koperasiRef?: string };

export default function RegisterPage() {
  const router = useRouter();
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [waNumber, setWaNumber] = useState('62');
  const [role, setRole] = useState<'ANGGOTA' | 'PENGURUS'>('ANGGOTA');
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<KoperasiOption[]>([]);
  const [koperasi, setKoperasi] = useState<KoperasiOption | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // cari koperasi (debounce 300ms, min 3 huruf)
  useEffect(() => {
    if (q.trim().length < 3) return setOptions([]);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ options: KoperasiOption[] }>(
          `/registration/koperasi?q=${encodeURIComponent(q.trim())}`,
        );
        setOptions(r.options);
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function validate(): string {
    if (!nama.trim()) return 'Nama wajib diisi.';
    if (!/^\d{16}$/.test(nik)) return 'NIK harus 16 digit angka.';
    if (password.length < 6) return 'Password minimal 6 karakter.';
    if (!/^62\d{8,}$/.test(waNumber)) return 'Nomor WhatsApp harus diawali 62 (contoh: 6281234567890).';
    if (!koperasi) return 'Pilih koperasimu dulu ya.';
    return '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError('');
    setBusy(true);
    try {
      await api('/registration/start-web', {
        method: 'POST',
        body: JSON.stringify({
          nama: nama.trim(),
          nik,
          password,
          waNumber,
          role,
          koperasiRef: koperasi!.koperasiId ?? koperasi!.koperasiRef,
        }),
      });
      router.push(`/register/verify?wa=${waNumber}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Daftar Kopra</h1>
          <p className="text-sm text-slate-500">Kode OTP dikirim ke WhatsApp kamu</p>
        </div>

        <input className="w-full rounded border px-3 py-2" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
        <input className="w-full rounded border px-3 py-2" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="NIK (16 digit)" inputMode="numeric" />
        <input className="w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 karakter)" />
        <input className="w-full rounded border px-3 py-2" value={waNumber} onChange={(e) => setWaNumber(e.target.value.replace(/\D/g, ''))} placeholder="Nomor WhatsApp (62…)" inputMode="numeric" />

        <div className="flex gap-4 text-sm">
          {(['ANGGOTA', 'PENGURUS'] as const).map((r) => (
            <label key={r} className="flex items-center gap-1.5">
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
              {r === 'ANGGOTA' ? 'Anggota' : 'Pengurus'}
            </label>
          ))}
        </div>

        <div>
          {koperasi ? (
            <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2 text-sm">
              <span>{koperasi.label}</span>
              <button type="button" className="text-red-600" onClick={() => setKoperasi(null)}>ganti</button>
            </div>
          ) : (
            <>
              <input className="w-full rounded border px-3 py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari koperasimu (min. 3 huruf)" />
              {options.length > 0 && (
                <ul className="mt-1 divide-y rounded border text-sm">
                  {options.map((o) => (
                    <li key={o.koperasiId ?? o.koperasiRef}>
                      <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setKoperasi(o); setOptions([]); }}>
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-red-600 py-2 font-medium text-white disabled:opacity-50">
          {busy ? 'Mengirim OTP…' : 'Daftar & kirim OTP'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Sudah punya akun? <Link href="/login" className="text-red-600">Masuk</Link>
        </p>
      </form>
    </main>
  );
}
