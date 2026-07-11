'use client';
import { CircleCheck, Inbox, TriangleAlert } from 'lucide-react';
import { rupiah } from '../../../lib/format';
import {
  Card,
  Pill,
  Table,
  TableCard,
  TableEmpty,
  TableSkeleton,
  TD,
  TH,
  THead,
  TR,
} from '../../../components/ui';

/* ---------- type guards (never cast blindly) ---------- */

const isNum = (v: unknown): v is number => typeof v === 'number';
const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

interface BukuBesarRow {
  kode: string;
  nama: string;
  type: string;
  totalDebit: number;
  totalKredit: number;
  saldo: number;
}

function isBukuBesar(data: unknown): data is BukuBesarRow[] {
  return (
    Array.isArray(data) &&
    data.every(
      (r) =>
        isObj(r) &&
        isStr(r.kode) &&
        isStr(r.nama) &&
        isStr(r.type) &&
        isNum(r.totalDebit) &&
        isNum(r.totalKredit) &&
        isNum(r.saldo),
    )
  );
}

interface NeracaSaldoRow {
  kode: string;
  nama: string;
  debit: number;
  kredit: number;
}

interface NeracaSaldo {
  rows: NeracaSaldoRow[];
  totalDebit: number;
  totalKredit: number;
  balanced: boolean;
}

function isNeracaSaldo(data: unknown): data is NeracaSaldo {
  return (
    isObj(data) &&
    Array.isArray(data.rows) &&
    data.rows.every(
      (r) =>
        isObj(r) &&
        isStr(r.kode) &&
        isStr(r.nama) &&
        isNum(r.debit) &&
        isNum(r.kredit),
    ) &&
    isNum(data.totalDebit) &&
    isNum(data.totalKredit) &&
    typeof data.balanced === 'boolean'
  );
}

interface Phu {
  pendapatan: number;
  beban: number;
  labaBersih: number;
}

function isPhu(data: unknown): data is Phu {
  return (
    isObj(data) &&
    isNum(data.pendapatan) &&
    isNum(data.beban) &&
    isNum(data.labaBersih)
  );
}

interface Neraca {
  aset: number;
  kewajiban: number;
  ekuitas: number;
  labaBerjalan: number;
  balanced: boolean;
}

function isNeraca(data: unknown): data is Neraca {
  return (
    isObj(data) &&
    isNum(data.aset) &&
    isNum(data.kewajiban) &&
    isNum(data.ekuitas) &&
    isNum(data.labaBerjalan) &&
    typeof data.balanced === 'boolean'
  );
}

interface BukuKasRow {
  tanggal: string;
  nomor: string;
  keterangan: string;
  debit: number;
  kredit: number;
  saldo: number;
}

function isBukuKas(data: unknown): data is { rows: BukuKasRow[] } {
  return (
    isObj(data) &&
    Array.isArray(data.rows) &&
    data.rows.every(
      (r) =>
        isObj(r) &&
        isStr(r.tanggal) &&
        isStr(r.nomor) &&
        isStr(r.keterangan) &&
        isNum(r.debit) &&
        isNum(r.kredit) &&
        isNum(r.saldo),
    )
  );
}

/* ---------- shared presentation helpers ---------- */

/** Debit/kredit movement cell: zero renders as a muted dash. */
function moneyCell(v: number) {
  if (v === 0) return <span className="text-ink-muted">–</span>;
  return rupiah(v);
}

/** Accounting presentation for saldo: negatives as absolute value in parentheses. */
function saldoCell(v: number) {
  if (v < 0) return <span>({rupiah(Math.abs(v))})</span>;
  return rupiah(v);
}

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatTanggal(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

/** Chart-of-account section headers (100000, 200000, …) get bold section styling. */
const isSectionKode = (kode: string) => /^\d0{5}$/.test(kode);

function BalancedPill({ balanced }: { balanced: boolean }) {
  return balanced ? (
    <Pill variant="success" icon={CircleCheck}>
      Seimbang
    </Pill>
  ) : (
    <Pill variant="danger" icon={TriangleAlert}>
      TIDAK SEIMBANG
    </Pill>
  );
}

function EmptyRows() {
  return (
    <TableCard>
      <TableEmpty
        icon={Inbox}
        title="Belum ada data"
        hint="Laporan ini belum memiliki baris untuk ditampilkan."
      />
    </TableCard>
  );
}

/* ---------- per-jenis views ---------- */

function BukuBesarView({ rows }: { rows: BukuBesarRow[] }) {
  if (rows.length === 0) return <EmptyRows />;
  return (
    <TableCard>
      <Table>
        <THead>
          <tr>
            <TH>Kode</TH>
            <TH>Nama Akun</TH>
            <TH>Tipe</TH>
            <TH align="right">Debit</TH>
            <TH align="right">Kredit</TH>
            <TH align="right">Saldo</TH>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => {
            const section = isSectionKode(r.kode);
            return (
              <TR key={r.kode} className={section ? 'bg-surface-sunken/50' : undefined}>
                <TD className={section ? 'font-bold text-ink' : 'text-ink-muted'}>
                  <span className="tabular-nums">{r.kode}</span>
                </TD>
                <TD className={section ? 'font-bold text-ink' : 'font-medium text-ink'}>
                  {r.nama}
                </TD>
                <TD className="text-xs font-semibold text-ink-muted">
                  {TYPE_LABEL[r.type] ?? r.type}
                </TD>
                <TD numeric className={section ? 'font-bold' : undefined}>
                  {moneyCell(r.totalDebit)}
                </TD>
                <TD numeric className={section ? 'font-bold' : undefined}>
                  {moneyCell(r.totalKredit)}
                </TD>
                <TD numeric className={section ? 'font-bold' : 'font-semibold'}>
                  {saldoCell(r.saldo)}
                </TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </TableCard>
  );
}

function NeracaSaldoView({ data }: { data: NeracaSaldo }) {
  return (
    <div className="space-y-3">
      <BalancedPill balanced={data.balanced} />
      {data.rows.length === 0 ? (
        <EmptyRows />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <tr>
                <TH>Kode</TH>
                <TH>Nama Akun</TH>
                <TH align="right">Debit</TH>
                <TH align="right">Kredit</TH>
              </tr>
            </THead>
            <tbody>
              {data.rows.map((r) => (
                <TR key={r.kode}>
                  <TD className="text-ink-muted">
                    <span className="tabular-nums">{r.kode}</span>
                  </TD>
                  <TD className="font-medium text-ink">{r.nama}</TD>
                  <TD numeric>{moneyCell(r.debit)}</TD>
                  <TD numeric>{moneyCell(r.kredit)}</TD>
                </TR>
              ))}
            </tbody>
            <tfoot>
              <TR className="border-t-2 border-border-soft bg-surface-sunken/50">
                <TD colSpan={2} className="font-bold text-ink">
                  Total
                </TD>
                <TD numeric className="font-bold text-ink">
                  {rupiah(data.totalDebit)}
                </TD>
                <TD numeric className="font-bold text-ink">
                  {rupiah(data.totalKredit)}
                </TD>
              </TR>
            </tfoot>
          </Table>
        </TableCard>
      )}
    </div>
  );
}

function PhuView({ data }: { data: Phu }) {
  return (
    <TableCard className="max-w-xl">
      <Table>
        <THead>
          <tr>
            <TH>Uraian</TH>
            <TH align="right">Jumlah</TH>
          </tr>
        </THead>
        <tbody>
          <TR>
            <TD className="font-medium text-ink">Pendapatan</TD>
            <TD numeric>{rupiah(data.pendapatan)}</TD>
          </TR>
          <TR>
            <TD className="font-medium text-ink">Beban</TD>
            <TD numeric>
              {data.beban === 0 ? moneyCell(0) : <>({rupiah(data.beban)})</>}
            </TD>
          </TR>
        </tbody>
        <tfoot>
          <TR className="border-t-2 border-border-soft bg-surface-sunken/50">
            <TD className="font-bold text-ink">Laba Bersih</TD>
            <TD numeric className="font-bold text-ink">
              {saldoCell(data.labaBersih)}
            </TD>
          </TR>
        </tfoot>
      </Table>
    </TableCard>
  );
}

function NeracaView({ data }: { data: Neraca }) {
  const totalPasiva = data.kewajiban + data.ekuitas + data.labaBerjalan;
  return (
    <div className="space-y-3">
      <BalancedPill balanced={data.balanced} />
      <TableCard className="max-w-xl">
        <Table>
          <THead>
            <tr>
              <TH>Uraian</TH>
              <TH align="right">Jumlah</TH>
            </tr>
          </THead>
          <tbody>
            <TR className="bg-surface-sunken/50">
              <TD className="font-bold text-ink">Total Aset</TD>
              <TD numeric className="font-bold text-ink">
                {saldoCell(data.aset)}
              </TD>
            </TR>
            <TR>
              <TD className="font-medium text-ink">Kewajiban</TD>
              <TD numeric>{saldoCell(data.kewajiban)}</TD>
            </TR>
            <TR>
              <TD className="font-medium text-ink">Ekuitas</TD>
              <TD numeric>{saldoCell(data.ekuitas)}</TD>
            </TR>
            <TR>
              <TD className="font-medium text-ink">Laba Berjalan</TD>
              <TD numeric>{saldoCell(data.labaBerjalan)}</TD>
            </TR>
          </tbody>
          <tfoot>
            <TR className="border-t-2 border-border-soft bg-surface-sunken/50">
              <TD className="font-bold text-ink">Total Kewajiban + Ekuitas</TD>
              <TD numeric className="font-bold text-ink">
                {saldoCell(totalPasiva)}
              </TD>
            </TR>
          </tfoot>
        </Table>
      </TableCard>
    </div>
  );
}

function BukuKasView({ rows }: { rows: BukuKasRow[] }) {
  if (rows.length === 0) return <EmptyRows />;
  return (
    <TableCard>
      <Table>
        <THead>
          <tr>
            <TH>Tanggal</TH>
            <TH>Nomor</TH>
            <TH>Keterangan</TH>
            <TH align="right">Debit</TH>
            <TH align="right">Kredit</TH>
            <TH align="right">Saldo</TH>
          </tr>
        </THead>
        <tbody>
          {rows.map((r, i) => (
            <TR key={`${r.nomor}-${i}`}>
              <TD className="whitespace-nowrap text-ink-muted">
                {formatTanggal(r.tanggal)}
              </TD>
              <TD className="whitespace-nowrap font-semibold text-secondary-600">
                {r.nomor}
              </TD>
              <TD className="font-medium text-ink">{r.keterangan}</TD>
              <TD numeric>{moneyCell(r.debit)}</TD>
              <TD numeric>{moneyCell(r.kredit)}</TD>
              <TD numeric className="font-semibold">
                {saldoCell(r.saldo)}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </TableCard>
  );
}

/* ---------- dispatcher ---------- */

export function ReportView({ jenis, data }: { jenis: string; data: unknown }) {
  if (data === null) return <TableSkeleton rows={6} cols={5} />;

  if (isObj(data) && data.error === true) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <TriangleAlert size={20} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-ink">Gagal memuat laporan</p>
        </div>
      </Card>
    );
  }

  if (jenis === 'buku-besar' && isBukuBesar(data)) {
    return <BukuBesarView rows={data} />;
  }
  if (jenis === 'neraca-saldo' && isNeracaSaldo(data)) {
    return <NeracaSaldoView data={data} />;
  }
  if (jenis === 'phu' && isPhu(data)) {
    return <PhuView data={data} />;
  }
  if (jenis === 'neraca' && isNeraca(data)) {
    return <NeracaView data={data} />;
  }
  if (jenis === 'buku-kas' && isBukuKas(data)) {
    return <BukuKasView rows={data.rows} />;
  }

  // Shape drift fallback — never crash.
  return (
    <pre className="overflow-auto rounded-card border border-border-soft bg-surface-raised p-4 text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
