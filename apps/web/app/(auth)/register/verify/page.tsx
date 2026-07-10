'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { RegisterResultPanel } from '../result-panel';

function VerifyInner() {
  const wa = useSearchParams().get('wa') ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [result, setResult] = useState<{ status: string; shortCode: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Kode OTP 6 digit angka.');
    setError('');
    setBusy(true);
    try {
      setResult(await api<{ status: string; shortCode: string }>('/registration/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ waNumber: wa, code }),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      await api('/registration/resend-otp', { method: 'POST', body: JSON.stringify({ waNumber: wa }) });
      setCooldown(60);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (result) {
    return <RegisterResultPanel status={result.status === 'APPROVED' ? 'ACTIVE' : result.status} shortCode={result.shortCode} />;
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Masukkan kode OTP</h1>
        <p className="text-sm text-slate-500">Kami kirim 6 digit ke WhatsApp {wa ? `${wa.slice(0, 5)}***${wa.slice(-2)}` : 'kamu'}</p>
      </div>
      <input
        className="w-full rounded border px-3 py-2 text-center text-2xl tracking-[0.5em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        inputMode="numeric"
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-red-600 py-2 font-medium text-white disabled:opacity-50">
        {busy ? 'Memeriksa…' : 'Verifikasi'}
      </button>
      <button type="button" onClick={resend} disabled={cooldown > 0} className="w-full text-sm text-slate-500 disabled:opacity-50">
        {cooldown > 0 ? `Kirim ulang kode (${cooldown}s)` : 'Kirim ulang kode'}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <Suspense fallback={null}>
          <VerifyInner />
        </Suspense>
      </div>
    </main>
  );
}
