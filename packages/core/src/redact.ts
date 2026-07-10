/**
 * Redaksi PII — dipakai SEBELUM menulis audit payload, log, atau
 * mengirim data ke prompt LLM. NIK plaintext hanya boleh hidup di kolom DB.
 */

const NIK_RE = /\b(\d{4})\d{10}(\d{2})\b/g; // 16 digit → sisakan 4 awal + 2 akhir
const PHONE_RE = /\b(\+?62|0)(8\d{2})[\s-]?\d{4}[\s-]?\d{2,6}\b/g;

export function redactText(text: string): string {
  return text.replace(NIK_RE, "$1**********$2").replace(PHONE_RE, "$1$2********");
}

/** Redaksi rekursif objek JSON (untuk audit_logs.payloadJson). */
export function redactJson<T>(value: T): T {
  if (typeof value === "string") return redactText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(redactJson) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /nik|password|otp|token/i.test(k) ? "[REDACTED]" : redactJson(v);
    }
    return out as T;
  }
  return value;
}
