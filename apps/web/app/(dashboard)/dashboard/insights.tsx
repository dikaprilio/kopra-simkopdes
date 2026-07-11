'use client';
import { motion, type Variants } from 'motion/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { rupiah } from '../../lib/format';
import { Card, cx } from '../../components/ui';
import { FadeUp } from '../../components/motion';

const growX: Variants = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { type: 'spring', stiffness: 200, damping: 30 },
  },
};

interface InsightsData {
  totalAset: number;
  totalKewajiban: number;
  totalEkuitas: number;
  pendapatan: number;
  beban: number;
  labaBersih: number;
}

export function DashboardInsights({ data }: { data: InsightsData }) {
  const labaBerjalan = Math.max(
    0,
    data.totalAset - data.totalKewajiban - data.totalEkuitas,
  );
  const komposisi = [
    { name: 'Kewajiban', value: data.totalKewajiban, color: 'bg-secondary-600' },
    { name: 'Ekuitas', value: data.totalEkuitas, color: 'bg-primary-500' },
    { name: 'Laba Berjalan', value: labaBerjalan, color: 'bg-secondary-400' },
  ];
  const komposisiShown = komposisi.filter((seg) => seg.value > 0);
  const komposisiTotal = komposisiShown.reduce((acc, seg) => acc + seg.value, 0);
  const maxKinerja = Math.max(data.pendapatan, data.beban);
  const kinerja = [
    { name: 'Pendapatan', value: data.pendapatan, color: 'bg-secondary-600' },
    { name: 'Beban', value: data.beban, color: 'bg-primary-500' },
  ];
  const labaPositif = data.labaBersih >= 0;
  const DeltaIcon = labaPositif ? TrendingUp : TrendingDown;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FadeUp>
        <Card>
          <h3 className="text-base font-extrabold tracking-tight text-ink">
            Komposisi Neraca
          </h3>
          <div className="mt-4">
            {data.totalAset > 0 && komposisiTotal > 0 ? (
              <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
                {komposisiShown.map((seg) => (
                  <motion.div
                    key={seg.name}
                    variants={growX}
                    className={cx('h-full origin-left basis-0', seg.color)}
                    style={{ flexGrow: (seg.value / komposisiTotal) * 100 }}
                  />
                ))}
              </div>
            ) : (
              <div className="h-4 w-full rounded-full bg-surface-sunken" />
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {komposisi.map((seg) => (
              <li key={seg.name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cx('h-2.5 w-2.5 shrink-0 rounded-full', seg.color)}
                />
                <span className="flex-1 text-sm font-medium text-ink-muted">
                  {seg.name}
                </span>
                <span className="text-sm font-bold tabular-nums text-ink">
                  {rupiah(seg.value)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </FadeUp>
      <FadeUp>
        <Card>
          <h3 className="text-base font-extrabold tracking-tight text-ink">
            Pendapatan vs Beban
          </h3>
          <div className="mt-4 space-y-4">
            {kinerja.map((row) => (
              <div key={row.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink-muted">
                    {row.name}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {rupiah(row.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-4 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <motion.div
                    variants={growX}
                    className={cx('h-full origin-left rounded-full', row.color)}
                    style={{
                      width:
                        maxKinerja > 0
                          ? `${(row.value / maxKinerja) * 100}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-soft pt-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <DeltaIcon
                size={16}
                strokeWidth={2.25}
                aria-hidden="true"
                className={labaPositif ? 'text-success-600' : 'text-danger-600'}
              />
              Laba Bersih
            </span>
            <span className="text-sm font-extrabold tabular-nums text-ink">
              {rupiah(data.labaBersih)}
            </span>
          </div>
        </Card>
      </FadeUp>
    </div>
  );
}
