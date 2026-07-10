'use client';
import Link from 'next/link';

/** Panel hasil registrasi bersama (web-first sukses OTP & WA-first submit form). */
export function RegisterResultPanel({
  status,
  shortCode,
  koperasiNama,
}: {
  status: string;
  shortCode?: string;
  koperasiNama?: string;
}) {
  const aktif = status === 'ACTIVE';
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">{aktif ? '🎉' : '⏳'}</div>
      <h2 className="text-lg font-semibold">
        {aktif ? 'Akunmu langsung aktif!' : 'Pendaftaran tercatat'}
      </h2>
      {aktif ? (
        <p className="text-sm text-slate-600">
          NIK-mu cocok dengan data anggota{koperasiNama ? ` *${koperasiNama}*` : ''}. Silakan masuk,
          atau langsung sapa Kopra di WhatsApp.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Permohonanmu {shortCode ? <b>({shortCode})</b> : null} sedang menunggu persetujuan.
          Kabar berikutnya dikirim lewat WhatsApp kamu ya!
        </p>
      )}
      <Link
        href="/login"
        className="block w-full rounded bg-red-600 py-2 font-medium text-white"
      >
        {aktif ? 'Masuk sekarang' : 'Ke halaman masuk'}
      </Link>
    </div>
  );
}
