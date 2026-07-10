import type { RequestContext } from "@mastra/core/request-context";
import type { ActorRole, Channel } from "@kopra/core";

/**
 * Identitas pemanggil — dikirim api (orchestrator) via requestContext Mastra.
 * Agent TIDAK pernah menebak identitas; kalau kosong = GUEST.
 */
export interface ActorContext {
  role: ActorRole;
  channel: Channel;
  actorId?: string; // User.id
  koperasiId?: string;
  koperasiNama?: string;
  chatJid?: string; // utk PendingAction
  memberId?: string; // utk READ_SELF (simpanan saya)
}

export function getActor(rc: RequestContext | undefined): ActorContext {
  const get = (k: string) => (rc ? (rc.get(k) as string | undefined) : undefined);
  return {
    role: (get("role") as ActorRole) ?? "GUEST",
    channel: (get("channel") as Channel) ?? "DM",
    actorId: get("actorId"),
    koperasiId: get("koperasiId"),
    koperasiNama: get("koperasiNama"),
    chatJid: get("chatJid"),
    memberId: get("memberId"),
  };
}

/** Format rupiah konsisten utk semua balasan bot. */
export function rp(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
