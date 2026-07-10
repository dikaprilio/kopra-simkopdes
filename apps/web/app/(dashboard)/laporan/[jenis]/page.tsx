'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

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
    <div>
      <div className="mb-6 flex gap-2">
        {TABS.map(([slug, label]) => (
          <Link key={slug} href={`/laporan/${slug}`}
            className={`rounded px-3 py-1 text-sm ${jenis === slug ? 'bg-red-600 text-white' : 'border bg-white'}`}>
            {label}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{TABS.find((t) => t[0] === jenis)?.[1]}</h1>
        <a className="text-sm underline" href={`${BASE}/reports/${jenis}?format=html`} target="_blank">Versi cetak (siap RAT)</a>
      </div>
      <pre className="overflow-auto rounded bg-white p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
      <p className="mt-2 text-xs text-slate-400">Tabel print-ready ada di “Versi cetak”. (Tabel styled per laporan = polish Fase 5.)</p>
    </div>
  );
}
