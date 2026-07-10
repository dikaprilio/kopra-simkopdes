'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { RegisterResultPanel } from '../result-panel';

function CompleteInner() {
  const token = useSearchParams().get('token') ?? '';
  const [nama, setNama] = useState('');
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; shortCode: string; koperasiNama?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return setError('Nama wajib diisi.');
    if (!/^\d{16}$/.test(nik)) return setError('NIK harus 16 digit angka.');
    if (password.length < 6) return setError('Password minimal 6 karakter.');
    setError('');
    setBusy(true);
    try {
      setResult(await api<{ status: string; shortCode: string; koperasiNama?: string }>(
        '/registration/complete-wa',
        { method: 'POST', body: JSON.stringify({ token, nama: nama.trim(), nik, password }) },
      ));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-600">Tautan tidak lengkap. Buka lagi tautan dari chat WhatsApp Kopra ya.</p>;
  }
  if (result) {
    return <RegisterResultPanel status={result.status} shortCode={result.shortCode} koperasiNama={result.koperasiNama} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lengkapi pendaftaran</h1>
        <p className="text-sm text-slate-500">
          Dari WhatsApp Kopra — isi data di sini, <b>jangan kirim NIK lewat chat</b>.
        </p>
      </div>
      <input className="w-full rounded border px-3 py-2" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
      <input className="w-full rounded border px-3 py-2" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="NIK (16 digit)" inputMode="numeric" />
      <input className="w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 karakter)" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-red-600 py-2 font-medium text-white disabled:opacity-50">
        {busy ? 'Menyimpan…' : 'Kirim'}
      </button>
    </form>
  );
}

export default function CompletePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <Suspense fallback={null}>
          <CompleteInner />
        </Suspense>
      </div>
    </main>
  );
}
