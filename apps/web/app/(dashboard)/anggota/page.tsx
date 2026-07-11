'use client';
import { useEffect, useState } from 'react';
import { CircleCheck, Clock, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { getSession, canWrite } from '../../lib/session';
import { rupiah } from '../../lib/format';
import {
  Button,
  Card,
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
    <Stagger>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FadeUp>
        <section className="space-y-4">
          <SectionHeading title="Anggota" />
          <TableCard>
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                  <TH align="right">Nunggak</TH>
                </TR>
              </THead>
              <tbody>
                {members.map((m) => (
                  <TR key={m.id} clickable selected={sel === m.id} onClick={() => open(m.id)}>
                    <TD className="font-medium text-ink">{m.nama}</TD>
                    <TD numeric>
                      {m.unpaidCount > 0 ? (
                        <Pill variant="warning">{m.unpaidCount}</Pill>
                      ) : (
                        m.unpaidCount
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
        </section>
        </FadeUp>
        <FadeUp>
        <section className="space-y-4">
          {sel ? (
            <>
              <SectionHeading title="Simpanan" />
              <TableCard>
                <Table>
                  <THead>
                    <TR>
                      <TH />
                      <TH>Jenis</TH>
                      <TH>Periode</TH>
                      <TH align="right">Jumlah</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {savings.map((s) => (
                      <TR key={s.id}>
                        <TD>
                          {writable && s.status === 'UNPAID' && (
                            <input type="checkbox" className="size-4 accent-primary-500" checked={checked.has(s.id)}
                              onChange={(e) => {
                                const n = new Set(checked);
                                if (e.target.checked) n.add(s.id); else n.delete(s.id);
                                setChecked(n);
                              }} />
                          )}
                        </TD>
                        <TD className="font-medium text-ink">{s.type}</TD>
                        <TD>{s.period}</TD>
                        <TD numeric>{rupiah(s.amount)}</TD>
                        <TD>
                          {s.status === 'PAID' ? (
                            <Pill variant="success" icon={CircleCheck}>PAID</Pill>
                          ) : (
                            <Pill variant="warning" icon={Clock}>UNPAID</Pill>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableCard>
              {writable && checked.size > 0 && (
                <Button variant="primary" onClick={pay}>Bayar Rapel ({checked.size} periode)</Button>
              )}
            </>
          ) : (
            <Card>
              <TableEmpty icon={Users} title="Pilih anggota untuk melihat simpanan" />
            </Card>
          )}
        </section>
        </FadeUp>
      </div>
    </Stagger>
  );
}
