import { writeAudit, type AuditInput } from "./audit.js";

export const WEB_AUDIT_RESOURCE = {
  MEMBER: "member",
  PRODUCT: "product",
  COA: "coa",
  BUSINESS_UNIT: "business_unit",
  JOURNAL: "journal",
  STOCK_MOVEMENT: "stock_movement",
  MEMBER_SAVING: "member_saving",
} as const;

export const WEB_AUDIT_MUTATION = {
  CREATE: "create",
  UPDATE: "update",
  ARCHIVE: "archive",
  REACTIVATE: "reactivate",
  DELETE: "delete",
  CONFIRM: "confirm",
  CANCEL: "cancel",
  REVERSE: "reverse",
  ADJUST: "adjust",
  PAY: "pay",
} as const;

export type WebAuditResource =
  (typeof WEB_AUDIT_RESOURCE)[keyof typeof WEB_AUDIT_RESOURCE];
export type WebAuditMutation =
  (typeof WEB_AUDIT_MUTATION)[keyof typeof WEB_AUDIT_MUTATION];

export function webAuditAction(
  resourceType: WebAuditResource,
  mutation: WebAuditMutation,
): `${WebAuditResource}.${WebAuditMutation}` {
  return `${resourceType}.${mutation}`;
}

export interface WebMutationAuditInput {
  koperasiId: string;
  actorId: string;
  resourceType: WebAuditResource;
  mutation: WebAuditMutation;
  resourceRef?: string;
  result?: AuditInput["result"];
  correlationId?: string;
  payload?: unknown;
}

/** Standard, always-redacted, non-fatal audit call for ERP mutations from WEB. */
export async function writeWebMutationAudit(input: WebMutationAuditInput): Promise<void> {
  await writeAudit({
    koperasiId: input.koperasiId,
    actorId: input.actorId,
    channel: "WEB",
    action: webAuditAction(input.resourceType, input.mutation),
    resourceType: input.resourceType,
    resourceRef: input.resourceRef,
    result: input.result,
    correlationId: input.correlationId,
    payload: input.payload,
  });
}
