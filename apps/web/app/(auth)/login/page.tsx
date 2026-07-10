'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { setSession } from '../../lib/session';

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
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Kopra</h1>
          <p className="text-sm text-slate-500">Asisten Digital Koperasi Merah Putih</p>
        </div>
        <input className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full rounded border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-red-600 py-2 font-medium text-white">Masuk</button>
        <p className="text-center text-sm text-slate-500">
          Belum punya akun? <a href="/register" className="text-red-600">Daftar</a>
        </p>
      </form>
    </main>
  );
}
