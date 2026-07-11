/**
 * Redaksi PII — dipakai SEBELUM menulis audit payload, log, atau
 * mengirim data ke prompt LLM. NIK plaintext hanya boleh hidup di kolom DB.
 */

const NIK_RE = /(?<!\d)(\d{4})(?:[\s.-]?\d){10}[\s.-]?(\d{2})(?!\d)/g;
const PHONE_RE = /(?<!\d)(\+?62|0)[\s-]*(8\d{2})[\s-]*\d{4}[\s-]*\d{2,6}(?!\d)/g;
const SENSITIVE_KEY_RE =
  /nik|password|passcode|otp|token|phone|mobile|telepon|nomor.?hp|no.?hp|nomor.?wa|wa.?number|whatsapp(?:.?number)?/i;

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
      out[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : redactJson(v);
    }
    return out as T;
  }
  return value;
}
