'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession, clearSession, type Session } from '../lib/session';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/coa', label: 'Akuntansi › COA' },
  { href: '/jurnal', label: 'Akuntansi › Jurnal' },
  { href: '/produk', label: 'Produk & Stok' },
  { href: '/anggota', label: 'Anggota & Simpanan' },
  { href: '/laporan/buku-besar', label: 'Laporan' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) router.replace('/login');
    else setSessionState(s);
  }, [router]);
  if (!session) return null;
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-slate-900 text-slate-100">
        <div className="p-4 text-lg font-semibold">Kopra</div>
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map((n) => {
            const seg = `/${n.href.split('/')[1]}`;
            const active = pathname.startsWith(seg);
            return (
              <Link key={n.href} href={n.href} className={`rounded px-3 py-2 text-sm ${active ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-xs text-slate-400">
          <div>{session.name} · {session.role}</div>
          <button className="mt-2 underline" onClick={() => { clearSession(); router.replace('/login'); }}>Keluar</button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
