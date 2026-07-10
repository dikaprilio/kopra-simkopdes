import { can, denialMessage, type Capability, DomainError, PostingError } from "@kopra/core";
import type { ActorContext } from "../../lib/context";

/** null = boleh; string = pesan penolakan yang HARUS dikembalikan tool apa adanya. */
export function gate(actor: ActorContext, cap: Capability): string | null {
  if (!can(actor.role, cap, actor.channel)) return denialMessage(cap, actor.channel);
  if (cap !== "PUBLIC_QA" && !actor.koperasiId)
    return "🙏 Akunmu belum terhubung ke koperasi. Ketik *DAFTAR* untuk menghubungkan.";
  return null;
}

/** Bungkus error domain jadi teks bot yang ramah (bukan stack trace). */
export function domainErrorText(e: unknown): string {
  if (e instanceof DomainError || e instanceof PostingError) return e.message;
  throw e;
}
