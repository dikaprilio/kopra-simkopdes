'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';

interface Member { id: string; nama: string; unpaidCount: number }
interface Saving { id: string; type: string; period: string; amount: string; status: 'PAID' | 'UNPAID' }

export default function AnggotaPage() {
  const writable = canWrite(getSession());
  const [members, setMembers] = useState<Member[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const loadMembers = () => api<{ data: Member[] }>('/members').then((r) => setMembers(r.data));
  useEffect(() => { loadMembers().catch(() => {}); }, []);

  async function open(id: string) {
    setSel(id);
    setChecked(new Set());
    const r = await api<{ savings: Saving[] }>(`/members/${id}/simpanan`);
    setSavings(r.savings);
  }

  async function pay() {
    if (!sel || checked.size === 0) return;
    await api(`/members/${sel}/simpanan/pay`, { method: 'POST', body: JSON.stringify({ savingIds: [...checked] }) });
    await open(sel);
    await loadMembers();
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Anggota</h1>
        <table className="w-full border-collapse bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500"><th className="p-2">Nama</th><th className="p-2 text-right">Nunggak</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={`cursor-pointer border-b ${sel === m.id ? 'bg-red-50' : ''}`} onClick={() => open(m.id)}>
                <td className="p-2">{m.nama}</td><td className="p-2 text-right">{m.unpaidCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        {sel && (
          <>
            <h2 className="mb-4 text-xl font-semibold">Simpanan</h2>
            <table className="w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="p-2"></th><th className="p-2">Jenis</th><th className="p-2">Periode</th>
                  <th className="p-2 text-right">Jumlah</th><th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {savings.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2">
                      {writable && s.status === 'UNPAID' && (
                        <input type="checkbox" checked={checked.has(s.id)}
                          onChange={(e) => {
                            const n = new Set(checked);
                            if (e.target.checked) n.add(s.id); else n.delete(s.id);
                            setChecked(n);
                          }} />
                      )}
                    </td>
                    <td className="p-2">{s.type}</td><td className="p-2">{s.period}</td>
                    <td className="p-2 text-right">{rupiah(s.amount)}</td>
                    <td className="p-2">{s.status === 'PAID' ? <span className="text-green-700">PAID</span> : <span className="text-amber-600">UNPAID</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {writable && checked.size > 0 && (
              <button onClick={pay} className="mt-4 rounded bg-red-600 px-4 py-2 text-white">Bayar Rapel ({checked.size} periode)</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
