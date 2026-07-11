'use client';
import { use, useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { api } from '../../../lib/api';
import { num } from '../../../lib/format';
import {
  Card,
  Pill,
  SectionHeading,
  Table,
  TableCard,
  TableSkeleton,
  TD,
  TH,
  THead,
  TR,
  type PillVariant,
} from '../../../components/ui';
import { AnimatedNumber, FadeUp, Stagger } from '../../../components/motion';

interface Movement { id: string; type: string; qty: string; date: string; status: string }
interface ProductCard { product: { nama: string; unit: string | null }; stok: number; movements: Movement[] }

function statusVariant(status: string): PillVariant {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'neutral';
}

export default function ProdukCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [card, setCard] = useState<ProductCard | null>(null);
  useEffect(() => { api<ProductCard>(`/products/${id}/card`).then(setCard).catch(() => {}); }, [id]);
  if (!card) return <TableSkeleton />;
  return (
    <Stagger className="space-y-6">
      <FadeUp>
        <SectionHeading
          title={card.product.nama}
          subtitle={`Stok terkini: ${num(card.stok)}${card.product.unit ? ` ${card.product.unit}` : ''}`}
        />
      </FadeUp>
      <FadeUp>
        <Card className="max-w-xs">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Package size={18} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Stok Terkini
          </div>
          <div className="mt-1">
            <AnimatedNumber
              value={card.stok}
              format="int"
              className="text-2xl font-extrabold text-ink"
            />
          </div>
        </Card>
      </FadeUp>
      <FadeUp>
        <TableCard>
          <Table>
            <THead>
              <TR>
                <TH>Tanggal</TH>
                <TH>Jenis</TH>
                <TH align="right">Qty</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {card.movements.map((m) => (
                <TR key={m.id}>
                  <TD>{m.date.slice(0, 10)}</TD>
                  <TD>{m.type}</TD>
                  <TD numeric>{num(m.qty)}</TD>
                  <TD>
                    <Pill variant={statusVariant(m.status)}>{m.status}</Pill>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </FadeUp>
    </Stagger>
  );
}
