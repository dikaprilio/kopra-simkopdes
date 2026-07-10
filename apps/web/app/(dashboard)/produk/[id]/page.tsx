'use client';
import { use, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { num } from '../../../lib/format';

interface Movement { id: string; type: string; qty: string; date: string; status: string }
interface Card { product: { nama: string; unit: string | null }; stok: number; movements: Movement[] }

export default function ProdukCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => { api<Card>(`/products/${id}/card`).then(setCard).catch(() => {}); }, [id]);
  if (!card) return <p>Memuat…</p>;
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{card.product.nama}</h1>
      <p className="mb-6 text-slate-500">Stok terkini: <strong>{num(card.stok)}</strong> {card.product.unit}</p>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-2">Tanggal</th><th className="p-2">Jenis</th>
            <th className="p-2 text-right">Qty</th><th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {card.movements.map((m) => (
            <tr key={m.id} className="border-b">
              <td className="p-2">{m.date.slice(0, 10)}</td><td className="p-2">{m.type}</td>
              <td className="p-2 text-right">{num(m.qty)}</td><td className="p-2">{m.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
