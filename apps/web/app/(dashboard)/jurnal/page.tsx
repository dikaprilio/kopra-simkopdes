'use client';
import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, Clock, MessageCircle, NotebookText } from 'lucide-react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';
import {
  Button,
  Pill,
  SectionHeading,
  Table,
  TableCard,
  TableEmpty,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui';
import { FadeUp, Stagger } from '../../components/motion';

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
    <Stagger className="space-y-6">
      <FadeUp>
        <SectionHeading
          title="Jurnal"
          subtitle="Semua transaksi koperasi — jurnal dari WhatsApp muncul otomatis di sini."
        />
      </FadeUp>
      <FadeUp>
        <TableCard>
          {entries.length === 0 ? (
            <TableEmpty
              icon={NotebookText}
              title="Belum ada jurnal"
              hint="Jurnal dari WhatsApp akan muncul otomatis di sini."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  {['No. Jurnal', 'Tanggal', 'Keterangan', 'Unit', 'Nominal', 'Status', ''].map((h, i) => (
                    <TH key={h || `th-${i}`} align={h === 'Nominal' ? 'right' : 'left'}>{h}</TH>
                  ))}
                </tr>
              </THead>
              <tbody>
                {entries.map((e) => {
                  const total = e.lines.reduce((a, l) => a + Number(l.debit), 0);
                  return (
                    <TR key={e.id} className="align-top">
                      <TD className="font-mono text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          {e.nomor}
                          {e.sourceChannel === 'WHATSAPP' && (
                            <Pill variant="success" icon={MessageCircle}>WA</Pill>
                          )}
                        </span>
                      </TD>
                      <TD className="text-ink-muted">{e.date.slice(0, 10)}</TD>
                      <TD>
                        <span className="font-medium text-ink">{e.keterangan}</span>
                        <div className="mt-0.5 text-xs text-ink-muted">
                          {e.lines.map((l) => `${l.coa.kode} ${l.coa.nama}`).join(' · ')}
                        </div>
                      </TD>
                      <TD className="text-ink-muted">{e.businessUnit?.nama ?? '-'}</TD>
                      <TD numeric className="font-semibold text-ink">{rupiah(total)}</TD>
                      <TD>
                        {e.status === 'CONFIRMED'
                          ? <Pill variant="success" icon={CircleCheck}>CONFIRMED</Pill>
                          : <Pill variant="warning" icon={Clock}>DRAFT</Pill>}
                      </TD>
                      <TD>
                        {writable && e.status === 'DRAFT' && (
                          <Button variant="primary" size="sm" onClick={() => confirm(e.id)}>Konfirmasi</Button>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </TableCard>
      </FadeUp>
    </Stagger>
  );
}
