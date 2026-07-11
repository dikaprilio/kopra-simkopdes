'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { rupiah, num } from '../../lib/format';
import {
  Pill,
  SectionHeading,
  Table,
  TableCard,
  TableEmpty,
  TableSkeleton,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui';
import { FadeUp, Stagger } from '../../components/motion';

interface Product { id: string; nama: string; unit: string | null; hargaJual: string | null; stok: number; isActive: boolean }

export default function ProdukPage() {
  const [rows, setRows] = useState<Product[] | null>(null);
  useEffect(() => { api<Product[]>('/products').then(setRows).catch(() => {}); }, []);
  if (!rows) return <TableSkeleton rows={5} cols={4} />;
  return (
    <Stagger className="space-y-6">
      <FadeUp>
        <SectionHeading
          title="Produk & Stok"
          subtitle="Daftar produk beserta harga jual dan stok terkini."
        />
      </FadeUp>
      <FadeUp>
        <TableCard>
        {rows.length === 0 ? (
          <TableEmpty
            icon={Package}
            title="Belum ada produk"
            hint="Produk yang terdaftar akan muncul di sini."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Produk</TH>
                <TH>Satuan</TH>
                <TH align="right">Harga Jual</TH>
                <TH align="right">Stok</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((p) => (
                <TR key={p.id} className={p.isActive ? undefined : 'opacity-40'}>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      <Link
                        className="text-secondary-700 font-semibold hover:underline"
                        href={`/produk/${p.id}`}
                      >
                        {p.nama}
                      </Link>
                      {!p.isActive ? <Pill variant="neutral">nonaktif</Pill> : null}
                    </span>
                  </TD>
                  <TD>{p.unit ?? '-'}</TD>
                  <TD numeric>{p.hargaJual ? rupiah(p.hargaJual) : '-'}</TD>
                  <TD numeric>
                    <span className="inline-flex items-center gap-2">
                      {p.stok <= 5 ? (
                        <Pill variant="warning" icon={TriangleAlert}>
                          stok rendah
                        </Pill>
                      ) : null}
                      {num(p.stok)}
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        </TableCard>
      </FadeUp>
    </Stagger>
  );
}
