import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type ConversationTurn = {
  role: 'user' | 'model';
  text: string;
};

@Injectable()
export class AiConversationService {
  private readonly sessions = new Map<
    string,
    { turns: ConversationTurn[]; expiresAt: number }
  >();
  private readonly ttlMs = this.resolveTtlMs();
  private readonly maxTurns = this.resolveMaxTurns();

  resolveSession(incomingSessionId?: string): {
    sessionId: string;
    priorTurns: ConversationTurn[];
  } {
    const now = Date.now();
    this.pruneExpired(now);

    if (incomingSessionId) {
      const box = this.sessions.get(incomingSessionId);
      if (box && box.expiresAt > now) {
        return { sessionId: incomingSessionId, priorTurns: [...box.turns] };
      }
    }

    const sessionId = randomUUID();
    this.sessions.set(sessionId, { turns: [], expiresAt: now + this.ttlMs });
    return { sessionId, priorTurns: [] };
  }

  getActiveSessionCount() {
    const now = Date.now();
    this.pruneExpired(now);
    return this.sessions.size;
  }

  recordExchange(sessionId: string, userPrompt: string, assistantText: string) {
    const box = this.sessions.get(sessionId);
    if (!box) {
      return;
    }
    const next: ConversationTurn[] = [
      ...box.turns,
      { role: 'user', text: userPrompt },
      { role: 'model', text: assistantText },
    ];
    box.turns = this.trimTurns(next);
    box.expiresAt = Date.now() + this.ttlMs;
  }

  private trimTurns(turns: ConversationTurn[]) {
    const max = Math.max(2, this.maxTurns);
    if (turns.length <= max) {
      return turns;
    }
    return turns.slice(turns.length - max);
  }

  private pruneExpired(now: number) {
    for (const [id, box] of this.sessions.entries()) {
      if (box.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }

  private resolveTtlMs() {
    const parsed = Number(process.env.AI_SESSION_TTL_MS || 1_800_000);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1_800_000;
  }

  private resolveMaxTurns() {
    const parsed = Number(process.env.AI_SESSION_MAX_TURNS || 24);
    return Number.isFinite(parsed) && parsed >= 2 ? Math.floor(parsed) : 24;
  }
}
