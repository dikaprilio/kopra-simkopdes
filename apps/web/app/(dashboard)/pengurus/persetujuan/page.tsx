'use client';
import { MessageCircle } from 'lucide-react';
import { Card, SectionHeading } from '../../../components/ui';
import { FadeUp, Stagger } from '../../../components/motion';

export default function PersetujuanPage() {
  return (
    <Stagger className="space-y-6">
      <FadeUp>
        <SectionHeading title="Persetujuan Pengurus" />
      </FadeUp>
      <FadeUp>
        <Card>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <MessageCircle size={24} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">
                Persetujuan berjalan lewat WhatsApp
              </h2>
              <p className="mx-auto max-w-md text-sm font-medium text-ink-muted">
                Alur persetujuan registrasi anggota oleh OWNER berjalan lewat
                WhatsApp sejak Fase 3 — persetujuan dibalas dengan SETUJUI di
                chat WhatsApp Kopra.
              </p>
            </div>
          </div>
        </Card>
      </FadeUp>
    </Stagger>
  );
}
