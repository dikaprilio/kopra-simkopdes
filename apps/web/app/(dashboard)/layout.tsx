'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  ChartColumn,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getSession, clearSession, type Session } from '../lib/session';
import { Button, Card, Pill, cx } from '../components/ui';

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: LucideIcon }>;
}> = [
  {
    label: 'Umum',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Akuntansi',
    items: [
      { href: '/coa', label: 'Bagan Akun', icon: BookOpen },
      { href: '/jurnal', label: 'Jurnal', icon: NotebookPen },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { href: '/produk', label: 'Produk & Stok', icon: Package },
      { href: '/anggota', label: 'Anggota & Simpanan', icon: Users },
    ],
  },
  {
    label: 'Laporan',
    items: [{ href: '/laporan/buku-besar', label: 'Laporan', icon: ChartColumn }],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState<Session | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) router.replace('/login');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guard sesi pra-Fase-5: baca localStorage setelah hydrate agar SSR/klien cocok
    else setSessionState(s);
  }, [router]);
  if (!session) return null;
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border-soft bg-surface-raised">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-lg font-extrabold text-white">
            K
          </div>
          <div className="min-w-0">
            <div className="text-lg font-extrabold tracking-tight text-ink">Kopra</div>
            <div className="text-xs text-ink-muted">Asisten Digital Koperasi</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <div className="px-3 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {group.label}
              </div>
              {group.items.map((n) => {
                const seg = `/${n.href.split('/')[1]}`;
                const active = pathname.startsWith(seg);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cx(
                      'relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'text-secondary-700'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-pill"
                        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-secondary-50"
                        aria-hidden="true"
                      >
                        <span className="absolute left-1 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary-500" />
                      </motion.span>
                    ) : null}
                    <Icon size={16} className="relative shrink-0" aria-hidden="true" />
                    <span className="relative truncate">{n.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <Card className="space-y-2 p-3!">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-ink">{session.name}</span>
              <Pill variant="blue" className="shrink-0">
                {session.role}
              </Pill>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                clearSession();
                router.replace('/login');
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Keluar
            </Button>
          </Card>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-surface p-6 lg:p-8">{children}</main>
    </div>
  );
}
