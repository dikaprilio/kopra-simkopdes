'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';

interface Line { debit: string; kredit: string; coa: { kode: string; nama: string } }
interface Entry {
  id: string; nomor: string; date: string; keterangan: string;
  status: 'DRAFT' | 'CONFIRMED'; sourceChannel: string; lines: Line[];
  businessUnit: { nama: string } | null;
}

export default function JurnalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const writable = canWrite(getSession());
  const load = useCallback(() => {
    api<{ data: Entry[] }>('/journals?pageSize=50').then((r) => setEntries(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // jurnal dari WA muncul ≤5 dtk
    return () => clearInterval(t);
  }, [load]);

  async function confirm(id: string) {
    await api(`/journals/${id}/confirm`, { method: 'POST' });
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Jurnal</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            {['No. Jurnal', 'Tanggal', 'Keterangan', 'Unit', 'Nominal', 'Status', ''].map((h) => <th key={h} className="p-2">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const total = e.lines.reduce((a, l) => a + Number(l.debit), 0);
            return (
              <tr key={e.id} className="border-b align-top">
                <td className="p-2 font-mono">
                  {e.nomor}
                  {e.sourceChannel === 'WHATSAPP' && <span className="ml-1 rounded bg-green-100 px-1 text-xs text-green-700">WA</span>}
                </td>
                <td className="p-2">{e.date.slice(0, 10)}</td>
                <td className="p-2">
                  {e.keterangan}
                  <div className="text-xs text-slate-400">{e.lines.map((l) => `${l.coa.kode} ${l.coa.nama}`).join(' · ')}</div>
                </td>
                <td className="p-2">{e.businessUnit?.nama ?? '-'}</td>
                <td className="p-2 text-right">{rupiah(total)}</td>
                <td className="p-2">
                  {e.status === 'CONFIRMED'
                    ? <span className="text-green-700">CONFIRMED</span>
                    : <span className="text-amber-600">DRAFT</span>}
                </td>
                <td className="p-2">
                  {writable && e.status === 'DRAFT' && (
                    <button onClick={() => confirm(e.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Konfirmasi</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
