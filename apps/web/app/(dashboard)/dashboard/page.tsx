'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  CircleCheck,
  Landmark,
  PiggyBank,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSession } from '../../lib/session';
import {
  Card,
  cx,
  Pill,
  SectionHeading,
  Skeleton,
  StatCardSkeleton,
} from '../../components/ui';
import { AnimatedNumber, FadeUp, Stagger } from '../../components/motion';
import { DashboardInsights } from './insights';

interface Summary {
  totalAset: number; totalKewajiban: number; totalEkuitas: number;
  pendapatan: number; beban: number; labaBersih: number;
  totalAnggota: number; anggotaNunggak: number; totalSimpananTertunggak: number; balanced: boolean;
}

function StatCard({
  icon: Icon,
  chip,
  label,
  value,
  format = 'rupiah',
  extra,
}: {
  icon: LucideIcon;
  chip: string;
  label: string;
  value: number;
  format?: 'rupiah' | 'int';
  extra?: ReactNode;
}) {
  return (
    <FadeUp>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cx(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl',
              chip,
            )}
          >
            <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
          </span>
          {extra}
        </div>
        <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </div>
        <div className="mt-1">
          <AnimatedNumber
            value={value}
            format={format}
            className="text-2xl font-extrabold text-ink"
          />
        </div>
      </Card>
    </FadeUp>
  );
}

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  useEffect(() => { api<Summary>('/dashboard/summary').then(setS).catch(() => {}); }, []);
  useEffect(() => {
    const name = getSession()?.name;
    if (name) setFirstName(name.trim().split(/\s+/)[0] ?? null);
  }, []);

  if (!s) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-36 w-full" />
        {[0, 1, 2].map((section) => (
          <div key={section} className="space-y-4">
            <Skeleton className="h-6 w-44" />
            <div className="grid gap-4 md:grid-cols-3">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Stagger className="space-y-8">
      <FadeUp>
        <Card className="border-0 bg-linear-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {firstName ? `Halo, ${firstName}! 👋` : 'Halo!'}
              </h1>
              <p className="mt-1 text-sm font-medium text-primary-50">
                Ringkasan keuangan koperasi Anda hari ini.
              </p>
              <div className="mt-5">
                {s.balanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                    <CircleCheck size={14} strokeWidth={2.25} aria-hidden="true" />
                    Neraca Seimbang
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-danger-600 shadow-card">
                    <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
                    TIDAK SEIMBANG
                  </span>
                )}
              </div>
            </div>
            <div className="md:text-right">
              <div className="text-xs font-bold uppercase tracking-wide text-primary-100">
                Laba Bersih Berjalan
              </div>
              <div className="mt-1">
                <AnimatedNumber
                  value={s.labaBersih}
                  className="text-3xl md:text-4xl font-extrabold text-white"
                />
              </div>
            </div>
          </div>
        </Card>
      </FadeUp>

      <section className="space-y-4">
        <FadeUp>
          <SectionHeading title="Posisi Keuangan" />
        </FadeUp>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Wallet}
            chip="bg-primary-50 text-primary-600"
            label="Total Aset"
            value={s.totalAset}
          />
          <StatCard
            icon={Scale}
            chip="bg-secondary-50 text-secondary-600"
            label="Kewajiban"
            value={s.totalKewajiban}
          />
          <StatCard
            icon={Landmark}
            chip="bg-primary-50 text-primary-600"
            label="Ekuitas"
            value={s.totalEkuitas}
          />
        </div>
      </section>

      <section className="space-y-4">
        <FadeUp>
          <SectionHeading title="Kinerja" />
        </FadeUp>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            chip="bg-success-50 text-success-600"
            label="Pendapatan"
            value={s.pendapatan}
          />
          <StatCard
            icon={TrendingDown}
            chip="bg-danger-50 text-danger-600"
            label="Beban"
            value={s.beban}
          />
          <StatCard
            icon={Sparkles}
            chip="bg-primary-50 text-primary-600"
            label="Laba Bersih"
            value={s.labaBersih}
          />
        </div>
      </section>

      <section className="space-y-4">
        <FadeUp>
          <SectionHeading title="Keanggotaan" />
        </FadeUp>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Users}
            chip="bg-secondary-50 text-secondary-600"
            label="Total Anggota"
            value={s.totalAnggota}
            format="int"
          />
          <StatCard
            icon={TriangleAlert}
            chip="bg-warning-50 text-warning-600"
            label="Anggota Nunggak"
            value={s.anggotaNunggak}
            format="int"
            extra={
              s.anggotaNunggak > 0 ? (
                <Pill variant="warning">perlu ditagih</Pill>
              ) : undefined
            }
          />
          <StatCard
            icon={PiggyBank}
            chip="bg-warning-50 text-warning-600"
            label="Simpanan Tertunggak"
            value={s.totalSimpananTertunggak}
          />
        </div>
      </section>

      <section className="space-y-4">
        <FadeUp>
          <SectionHeading title="Analisis" />
        </FadeUp>
        <DashboardInsights data={s} />
      </section>
    </Stagger>
  );
}
