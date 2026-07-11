'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { RegisterResultPanel } from '../result-panel';
import { Button, Card, Input, Label } from '../../../components/ui';
import { FadeUp, Stagger } from '../../../components/motion';

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
    return <p className="text-sm font-medium text-danger-600">Tautan tidak lengkap. Buka lagi tautan dari chat WhatsApp Kopra ya.</p>;
  }
  if (result) {
    return <RegisterResultPanel status={result.status} shortCode={result.shortCode} koperasiNama={result.koperasiNama} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Lengkapi pendaftaran</h1>
        <p className="text-sm font-medium text-ink-muted">
          Dari WhatsApp Kopra — isi data di sini, <b>jangan kirim NIK lewat chat</b>.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complete-nama">Nama Lengkap</Label>
        <Input id="complete-nama" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complete-nik">NIK</Label>
        <Input id="complete-nik" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="NIK (16 digit)" inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complete-password">Password</Label>
        <Input id="complete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 karakter)" />
      </div>
      {error && <p className="text-sm font-medium text-danger-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? 'Menyimpan…' : 'Kirim'}
      </Button>
    </form>
  );
}

export default function CompletePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-surface px-4 py-8">
      <Stagger className="w-full max-w-sm space-y-6">
        <FadeUp>
          <div className="flex items-center justify-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-500"><img src="/brand/k-mark-white.svg" alt="" className="h-5 w-auto" /></span>
            <span className="text-lg font-extrabold tracking-tight text-ink">Kopra</span>
          </div>
        </FadeUp>
        <FadeUp>
          <Card>
            <Suspense fallback={null}>
              <CompleteInner />
            </Suspense>
          </Card>
        </FadeUp>
      </Stagger>
    </main>
  );
}
