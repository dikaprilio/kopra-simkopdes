'use client';
import Link from 'next/link';
import { FadeUp, Stagger } from '../../components/motion';

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
    <Stagger>
      <FadeUp>
        <div className="space-y-4 text-center">
          <div className="text-4xl">{aktif ? '🎉' : '⏳'}</div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">
            {aktif ? 'Akunmu langsung aktif!' : 'Pendaftaran tercatat'}
          </h2>
          {aktif ? (
            <p className="text-sm font-medium text-ink-muted">
              NIK-mu cocok dengan data anggota{koperasiNama ? ` *${koperasiNama}*` : ''}. Silakan masuk,
              atau langsung sapa Kopra di WhatsApp.
            </p>
          ) : (
            <p className="text-sm font-medium text-ink-muted">
              Permohonanmu {shortCode ? <b>({shortCode})</b> : null} sedang menunggu persetujuan.
              Kabar berikutnya dikirim lewat WhatsApp kamu ya!
            </p>
          )}
          <Link
            href="/login"
            className="block w-full rounded-full bg-primary-500 py-2.5 text-center font-bold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-card-hover active:translate-y-0"
          >
            {aktif ? 'Masuk sekarang' : 'Ke halaman masuk'}
          </Link>
        </div>
      </FadeUp>
    </Stagger>
  );
}
