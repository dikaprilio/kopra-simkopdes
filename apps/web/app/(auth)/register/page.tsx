'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Button, Card, Input, Label } from '../../components/ui';
import { FadeUp, Stagger } from '../../components/motion';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- perilaku pra-Fase-5 dipertahankan byte-identik (E2E registrasi)
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
    <main className="min-h-screen grid place-items-center bg-surface px-4 py-8">
      <Stagger className="w-full max-w-sm space-y-6">
        <FadeUp>
          <div className="flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500 text-sm font-extrabold text-white shadow-card"
            >
              K
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink">Kopra</span>
          </div>
        </FadeUp>
        <FadeUp>
          <Card>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">Daftar Kopra</h1>
                <p className="mt-1 text-sm font-medium text-ink-muted">Kode OTP dikirim ke WhatsApp kamu</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-nama">Nama Lengkap</Label>
                <Input id="reg-nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-nik">NIK</Label>
                <Input id="reg-nik" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="NIK (16 digit)" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 karakter)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-wa">Nomor WhatsApp</Label>
                <Input id="reg-wa" value={waNumber} onChange={(e) => setWaNumber(e.target.value.replace(/\D/g, ''))} placeholder="Nomor WhatsApp (62…)" inputMode="numeric" />
              </div>

              <div className="flex gap-5 text-sm font-medium text-ink">
                {(['ANGGOTA', 'PENGURUS'] as const).map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="role" className="accent-primary-500" checked={role === r} onChange={() => setRole(r)} />
                    {r === 'ANGGOTA' ? 'Anggota' : 'Pengurus'}
                  </label>
                ))}
              </div>

              <div>
                {koperasi ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary-50 px-3.5 py-2.5 text-sm">
                    <span className="font-medium text-ink">{koperasi.label}</span>
                    <button type="button" className="text-xs font-semibold text-secondary-700" onClick={() => setKoperasi(null)}>ganti</button>
                  </div>
                ) : (
                  <>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari koperasimu (min. 3 huruf)" />
                    {options.length > 0 && (
                      <ul className="mt-1.5 divide-y divide-border-soft overflow-hidden rounded-xl border border-border-soft bg-surface-raised text-sm">
                        {options.map((o) => (
                          <li key={o.koperasiId ?? o.koperasiRef}>
                            <button type="button" className="w-full px-3.5 py-2.5 text-left font-medium text-ink transition-colors duration-150 hover:bg-primary-50/60" onClick={() => { setKoperasi(o); setOptions([]); }}>
                              {o.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              {error && <p className="text-sm font-medium text-danger-600">{error}</p>}
              <Button type="submit" variant="primary" disabled={busy} className="w-full">
                {busy ? 'Mengirim OTP…' : 'Daftar & kirim OTP'}
              </Button>
              <p className="text-center text-sm font-medium text-ink-muted">
                Sudah punya akun? <Link href="/login" className="font-semibold text-secondary-700">Masuk</Link>
              </p>
            </form>
          </Card>
        </FadeUp>
      </Stagger>
    </main>
  );
}
