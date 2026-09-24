import { createHash, randomUUID } from "node:crypto";
import { AccessContextError, ConfigError } from "./errors";
import type { SessionStore } from "./store";

export const SYSTEM_CONTEXT_READ_WINDOW_SECONDS = 60;
export type SystemContextScope = {
  sessionId: string;
  issuer: string;
  subject: string;
  organizationId: string;
  membershipId: string;
  product: string;
  audience: string;
};
type Claims = Record<string, unknown> & { iat?: number; exp?: number };
type Entry<T> = { claims: T; until: number; epochs: string };
const key = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/** Server-side only. The loader must verify the signature and product/identity claims.
 * Requires a shared store with distributed locking; never caches authorization errors.
 */
export class SystemContextCache {
  constructor(private readonly store: SessionStore) {
    if (!store.withLock)
      throw new ConfigError(
        "System context cache requires distributed locking",
      );
  }

  async invalidate(target: {
    organizationId: string;
    issuer?: string;
    subject?: string;
  }) {
    // Separate generations avoid scans and also fence resolutions already in flight.
    await this.store.set(this.epochKey(target), randomUUID(), 600);
  }

  private epochKey(target: {
    organizationId: string;
    issuer?: string;
    subject?: string;
  }) {
    return `sso:system-context:epoch:${key([target.organizationId, target.issuer ?? null, target.subject ?? null])}`;
  }

  private async epochs(scope: SystemContextScope) {
    return JSON.stringify(
      await Promise.all([
        this.store.get(this.epochKey({ organizationId: scope.organizationId })),
        this.store.get(this.epochKey(scope)),
      ]),
    );
  }

  async resolve<T extends Claims>(
    scope: SystemContextScope,
    fresh: boolean,
    loadVerified: () => Promise<T>,
  ): Promise<T> {
    const cacheKey = `sso:system-context:value:${key([scope.sessionId, scope.issuer, scope.subject, scope.organizationId, scope.membershipId, scope.product, scope.audience])}`;
    const sessionExists = async () => {
      if (
        !scope.sessionId ||
        !(await this.store.get(`sso:session:${scope.sessionId}`))
      )
        throw new AccessContextError(401, "Session no longer available");
    };
    const cached = async () => {
      await sessionExists();
      const entry = await this.store.get<Entry<T>>(cacheKey);
      if (
        entry &&
        entry.epochs === (await this.epochs(scope)) &&
        entry.until > Date.now()
      )
        return entry.claims;
      return null;
    };
    if (!fresh) {
      const hit = await cached();
      if (hit) return hit;
    }
    return this.store.withLock!(`${cacheKey}:lock`, 30, async () => {
      const started = Date.now();
      if (!fresh) {
        const hit = await cached();
        if (hit) return hit;
      }
      await sessionExists();
      await this.store.delete(cacheKey);
      const epochs = await this.epochs(scope);
      const claims = await loadVerified();
      await sessionExists();
      if (epochs !== (await this.epochs(scope)))
        throw new AccessContextError(
          409,
          "Authorization changed during resolution",
        );
      // Anchor the window to issuance/start, never to the last cache hit.
      const until = Math.min(
        started + SYSTEM_CONTEXT_READ_WINDOW_SECONDS * 1000,
        (claims.iat ?? 0) * 1000 + SYSTEM_CONTEXT_READ_WINDOW_SECONDS * 1000,
        (claims.exp ?? 0) * 1000,
      );
      if (
        !Number.isFinite(until) ||
        until <= Date.now() ||
        Date.now() - started >= 25_000
      )
        throw new AccessContextError(503, "Context freshness unavailable");
      await this.store.set(
        cacheKey,
        { claims, until, epochs },
        Math.max(1, Math.ceil((until - Date.now()) / 1000)),
      );
      // Invalidation after the write still fences the entry, even on another instance.
      if (epochs !== (await this.epochs(scope)))
        throw new AccessContextError(
          409,
          "Authorization changed during resolution",
        );
      if (until <= Date.now() || Date.now() - started >= 25_000)
        throw new AccessContextError(503, "Context freshness unavailable");
      return claims;
    });
  }
}
