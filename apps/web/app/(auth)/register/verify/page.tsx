'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { RegisterResultPanel } from '../result-panel';
import { Button, Card } from '../../../components/ui';
import { FadeUp, Stagger } from '../../../components/motion';

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
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Masukkan kode OTP</h1>
        <p className="text-sm font-medium text-ink-muted">Kami kirim 6 digit ke WhatsApp {wa ? `${wa.slice(0, 5)}***${wa.slice(-2)}` : 'kamu'}</p>
      </div>
      <input
        className="w-full rounded-xl border border-border-soft bg-surface-raised px-3.5 py-2.5 text-center text-2xl tracking-[0.5em] font-medium text-ink placeholder:text-ink-muted/70 transition-colors duration-150 focus:outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/25 disabled:opacity-50 disabled:pointer-events-none"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        inputMode="numeric"
        autoFocus
      />
      {error && <p className="text-sm font-medium text-danger-600">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? 'Memeriksa…' : 'Verifikasi'}
      </Button>
      <Button type="button" variant="ghost" onClick={resend} disabled={cooldown > 0} className="w-full">
        {cooldown > 0 ? `Kirim ulang kode (${cooldown}s)` : 'Kirim ulang kode'}
      </Button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-surface px-4 py-8">
      <Stagger className="w-full max-w-sm space-y-6">
        <FadeUp>
          <div className="flex items-center justify-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-500 text-base font-extrabold text-white">K</span>
            <span className="text-lg font-extrabold tracking-tight text-ink">Kopra</span>
          </div>
        </FadeUp>
        <FadeUp>
          <Card>
            <Suspense fallback={null}>
              <VerifyInner />
            </Suspense>
          </Card>
        </FadeUp>
      </Stagger>
    </main>
  );
}
