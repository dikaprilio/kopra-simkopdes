import { prisma } from "@kopra/db";
import { redactJson } from "./redact";

export interface AuditInput {
  koperasiId?: string;
  actorId?: string;
  channel?: "DM" | "GROUP" | "WEB" | "SYSTEM";
  action: string; // "journal.confirm", "tool.getStockLevels", "registration.approve", …
  resourceType?: string;
  resourceRef?: string;
  result?: "OK" | "DENIED" | "ERROR";
  correlationId?: string;
  payload?: unknown;
}

/** Tulis audit — payload SELALU di-redaksi (NIK/password/OTP/token/phone). */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        koperasiId: input.koperasiId,
        actorId: input.actorId,
        channel: input.channel,
        action: input.action,
        resourceType: input.resourceType,
        resourceRef: input.resourceRef,
        result: input.result ?? "OK",
        correlationId: input.correlationId,
        payloadJson: input.payload ? (redactJson(input.payload) as object) : undefined,
      },
    });
  } catch {
    // audit tak boleh menjatuhkan alur utama
    console.error("[audit] gagal menulis audit log:", input.action);
  }
}
