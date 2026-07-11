'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'motion/react';
import { MessageCircle, ChartColumn, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { setSession } from '../../lib/session';
import { Card, Button, Label, Input } from '../../components/ui';
import { FadeUp, Stagger } from '../../components/motion';

const shakeVariants: Variants = {
  shake: {
    x: [0, -6, 6, -3, 3, 0],
    transition: { duration: 0.25 },
  },
};

const features = [
  { icon: MessageCircle, text: 'Catat transaksi via chat' },
  { icon: ChartColumn, text: 'Laporan RAT otomatis' },
  { icon: Users, text: 'Simpanan anggota terpantau' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('pengurus@kopra.id');
  const [password, setPassword] = useState('kopra123');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ token: string; user: { role: 'OWNER' | 'PENGURUS' | 'ANGGOTA'; name: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      setSession({ token: r.token, role: r.user.role, name: r.user.name });
      router.push('/dashboard');
    } catch {
      setError('Email atau kata sandi salah.');
    }
  }

  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-linear-to-br from-primary-500 to-primary-600 text-white lg:flex lg:flex-col lg:justify-center lg:gap-12 lg:p-16">
        <div aria-hidden className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="absolute top-1/3 -left-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <img src="/brand/k-mark-white.svg" alt="" className="h-7 w-auto" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">Kopra</span>
        </div>
        <h2 className="relative max-w-md text-4xl font-extrabold tracking-tight">
          Pembukuan koperasi, langsung dari WhatsApp.
        </h2>
        <ul className="relative space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <span className="text-sm font-semibold">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
            <img src="/brand/k-mark-white.svg" alt="" className="h-5 w-auto" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-ink">Kopra</span>
        </div>
        <Stagger className="w-full max-w-sm">
          <FadeUp>
          <Card>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-ink">Kopra</h1>
                <p className="text-sm font-medium text-ink-muted">Asisten Digital Koperasi Merah Putih</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  invalid={!!error}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Kata Sandi</Label>
                <Input
                  id="login-password"
                  type="password"
                  invalid={!!error}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi"
                />
              </div>
              {error && (
                <motion.p
                  key={error}
                  variants={shakeVariants}
                  animate="shake"
                  className="text-sm font-medium text-danger-600"
                >
                  {error}
                </motion.p>
              )}
              <Button type="submit" variant="primary" className="w-full">
                Masuk
              </Button>
              <p className="text-center text-sm font-medium text-ink-muted">
                Belum punya akun?{' '}
                <a href="/register" className="font-semibold text-secondary-700">
                  Daftar
                </a>
              </p>
            </form>
          </Card>
          </FadeUp>
        </Stagger>
      </section>
    </main>
  );
}
