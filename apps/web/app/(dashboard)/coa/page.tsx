'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Node { id: string; kode: string; nama: string; type: string; children: Node[] }

function Row({ n, depth }: { n: Node; depth: number }) {
  return (
    <>
      <tr className="border-b">
        <td className="p-2 font-mono" style={{ paddingLeft: 8 + depth * 20 }}>{n.kode}</td>
        <td className="p-2">{n.nama}</td>
        <td className="p-2 text-xs text-slate-500">{n.type}</td>
      </tr>
      {n.children?.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
    </>
  );
}

export default function CoaPage() {
  const [tree, setTree] = useState<Node[]>([]);
  useEffect(() => { api<Node[]>('/coa?tree=true').then(setTree).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Bagan Akun (COA)</h1>
      <table className="w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500"><th className="p-2">Kode</th><th className="p-2">Nama Akun</th><th className="p-2">Tipe</th></tr>
        </thead>
        <tbody>{tree.map((n) => <Row key={n.id} n={n} depth={0} />)}</tbody>
      </table>
    </div>
  );
}
