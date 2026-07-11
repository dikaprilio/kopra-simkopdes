'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Printer } from 'lucide-react';
import { api } from '../../../lib/api';
import { cx } from '../../../components/ui';
import { FadeUp, Stagger } from '../../../components/motion';
import { ReportView } from './report-views';

const BASE = process.env.NEXT_PUBLIC_API_BASE!;
const TABS = [
  ['buku-besar', 'Buku Besar'], ['neraca-saldo', 'Neraca Saldo'],
  ['phu', 'PHU'], ['neraca', 'Neraca'], ['buku-kas', 'Buku Kas'],
] as const;

export default function LaporanPage({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = use(params);
  const [data, setData] = useState<unknown>(null);
  useEffect(() => { api(`/reports/${jenis}`).then(setData).catch(() => setData({ error: true })); }, [jenis]);
  return (
    <Stagger>
      <FadeUp className="space-y-6">
        <nav aria-label="Jenis laporan" className="flex flex-wrap gap-2">
          {TABS.map(([slug, label]) => {
            const active = jenis === slug;
            return (
              <Link
                key={slug}
                href={`/laporan/${slug}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'relative rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-150',
                  active
                    ? 'text-white'
                    : 'border border-border-soft bg-surface-raised text-ink-muted hover:text-ink',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="laporan-tab"
                    className="absolute inset-0 rounded-full bg-secondary-600"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {TABS.find((t) => t[0] === jenis)?.[1]}
          </h1>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-full border border-secondary-600 px-3.5 py-1.5 text-xs font-bold text-secondary-600 transition-colors duration-150 hover:bg-secondary-50"
            href={`${BASE}/reports/${jenis}?format=html`}
            target="_blank"
          >
            <Printer size={16} strokeWidth={2.25} aria-hidden="true" />
            Versi cetak (siap RAT)
          </a>
        </div>
        <ReportView jenis={jenis} data={data} />
      </FadeUp>
    </Stagger>
  );
}
