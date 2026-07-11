'use client';
import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import { api } from '../../lib/api';
import {
  Pill,
  SectionHeading,
  Table,
  TableCard,
  TableEmpty,
  TD,
  TH,
  THead,
  TR,
  type PillVariant,
} from '../../components/ui';
import { FadeUp, Stagger } from '../../components/motion';

interface Node { id: string; kode: string; nama: string; type: string; children: Node[] }

const typeVariant: Record<string, PillVariant> = {
  ASSET: 'blue',
  LIABILITY: 'warning',
  EQUITY: 'orange',
  REVENUE: 'success',
  EXPENSE: 'danger',
};

function Row({ n, depth }: { n: Node; depth: number }) {
  return (
    <>
      <TR className={depth === 0 ? 'font-bold' : undefined}>
        <TD className="font-mono" style={{ paddingLeft: 16 + depth * 20 }}>{n.kode}</TD>
        <TD>{n.nama}</TD>
        <TD>
          <Pill variant={typeVariant[n.type] ?? 'neutral'}>{n.type}</Pill>
        </TD>
      </TR>
      {n.children?.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
    </>
  );
}

export default function CoaPage() {
  const [tree, setTree] = useState<Node[]>([]);
  useEffect(() => { api<Node[]>('/coa?tree=true').then(setTree).catch(() => {}); }, []);
  return (
    <Stagger className="space-y-6">
      <FadeUp>
        <SectionHeading
          title="Bagan Akun (COA)"
          subtitle="Struktur akun keuangan koperasi Anda."
        />
      </FadeUp>
      <FadeUp>
        <TableCard>
          {tree.length === 0 ? (
            <TableEmpty icon={ListTree} title="Belum ada akun" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Kode</TH>
                  <TH>Nama Akun</TH>
                  <TH>Tipe</TH>
                </TR>
              </THead>
              <tbody>{tree.map((n) => <Row key={n.id} n={n} depth={0} />)}</tbody>
            </Table>
          )}
        </TableCard>
      </FadeUp>
    </Stagger>
  );
}
