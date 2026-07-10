'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { rupiah, num } from '../../lib/format';

interface Product { id: string; nama: string; unit: string | null; hargaJual: string | null; stok: number; isActive: boolean }

export default function ProdukPage() {
  const [rows, setRows] = useState<Product[]>([]);
  useEffect(() => { api<Product[]>('/products').then(setRows).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Produk & Stok</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="p-2">Produk</th><th className="p-2">Satuan</th>
            <th className="p-2 text-right">Harga Jual</th><th className="p-2 text-right">Stok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={`border-b ${p.isActive ? '' : 'opacity-40'}`}>
              <td className="p-2"><Link className="text-red-700 underline" href={`/produk/${p.id}`}>{p.nama}</Link></td>
              <td className="p-2">{p.unit ?? '-'}</td>
              <td className="p-2 text-right">{p.hargaJual ? rupiah(p.hargaJual) : '-'}</td>
              <td className={`p-2 text-right ${p.stok <= 5 ? 'font-semibold text-red-600' : ''}`}>{num(p.stok)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
