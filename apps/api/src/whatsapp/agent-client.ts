import { Injectable, Logger } from '@nestjs/common';
import type { MastraClient } from '@mastra/client-js';
import type { ActorRole, Channel } from '@kopra/core';

/** Identitas yang dikirim ke agent Mastra sebagai requestContext (agent TIDAK menebak). */
export interface ActorContext {
  role: ActorRole;
  channel: Channel;
  actorId?: string;
  koperasiId?: string;
  koperasiNama?: string;
  chatJid?: string;
  memberId?: string;
}

/** Klien agent kopra (Mastra server :4111). Dipisah supaya gampang di-mock di test. */
@Injectable()
export class AgentClient {
  private readonly logger = new Logger(AgentClient.name);
  private client?: MastraClient;

  // lazy import: @mastra/client-js ESM-first — jangan dibebankan ke require-time (jest CJS)
  private async getClient(): Promise<MastraClient> {
    if (!this.client) {
      const { MastraClient } = await import('@mastra/client-js');
      this.client = new MastraClient({
        baseUrl: process.env.AGENT_BASE_URL ?? 'http://localhost:4111',
      });
    }
    return this.client;
  }

  async ask(text: string, actor: ActorContext): Promise<string> {
    try {
      const agent = (await this.getClient()).getAgent('kopra');
      const { RequestContext } = await import('@mastra/client-js');
      const rc = new RequestContext();
      for (const [k, v] of Object.entries(actor)) if (v !== undefined) rc.set(k, v);
      const res = await agent.generate(text, { requestContext: rc });
      const out = (res as { text?: string }).text;
      return out?.trim() || '🙏 Maaf, saya tidak menangkap maksudnya. Bisa diulangi dengan kalimat lain?';
    } catch (e) {
      this.logger.error(`Agent gagal: ${(e as Error).message}`);
      return '😔 Maaf, asisten sedang gangguan sebentar. Coba ulangi beberapa saat lagi ya.';
    }
  }
}
