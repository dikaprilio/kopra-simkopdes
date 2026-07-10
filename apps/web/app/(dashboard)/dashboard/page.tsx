'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { rupiah } from '../../lib/format';

interface Summary {
  totalAset: number; totalKewajiban: number; totalEkuitas: number;
  pendapatan: number; beban: number; labaBersih: number;
  totalAnggota: number; anggotaNunggak: number; totalSimpananTertunggak: number; balanced: boolean;
}

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => { api<Summary>('/dashboard/summary').then(setS).catch(() => {}); }, []);
  if (!s) return <p>Memuat…</p>;
  const cards: [string, string][] = [
    ['Total Aset', rupiah(s.totalAset)], ['Kewajiban', rupiah(s.totalKewajiban)], ['Ekuitas', rupiah(s.totalEkuitas)],
    ['Pendapatan', rupiah(s.pendapatan)], ['Beban', rupiah(s.beban)], ['Laba Bersih', rupiah(s.labaBersih)],
    ['Total Anggota', String(s.totalAnggota)], ['Anggota Nunggak', String(s.anggotaNunggak)], ['Simpanan Tertunggak', rupiah(s.totalSimpananTertunggak)],
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">Neraca: {s.balanced ? 'Seimbang ✓' : 'TIDAK SEIMBANG'}</p>
    </div>
  );
}
