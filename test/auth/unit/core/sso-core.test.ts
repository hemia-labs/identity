import { expect, test } from "bun:test";
import { SsoCore } from "../../../../packages/auth/src/core/session/sso-core";
import type { SsoConfig } from "../../../../packages/auth/src/core/config";
import type { Session, TokenResponse } from "../../../../packages/auth/src/core/types";
import type { SessionStore } from "../../../../packages/auth/src/core/session/store";
import { ConfigError } from "../../../../packages/auth/src/core/errors";

const config: SsoConfig = {
  issuer: "https://identity.example.com",
  clientId: "docs",
  audience: "docs-api",
  jwksUrl: "https://identity.example.com/.well-known/jwks.json",
  authorizationUrl: "https://identity.example.com/oauth/authorize",
  tokenUrl: "https://identity.example.com/oauth/token",
  redirectUri: "https://docs.example.com/auth/callback",
  frontendUrl: "https://docs.example.com",
  scope: "openid profile email offline_access docs.access",
  cookieName: "docs_session",
  sessionTtlSeconds: 604800,
  cookieSecure: true,
};

class MemoryStore implements SessionStore {
  readonly values = new Map<string, unknown>();
  readonly lockCalls: string[] = [];
  private readonly locks = new Map<string, Promise<void>>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async withLock<T>(
    key: string,
    _ttlSeconds: number,
    callback: () => Promise<T>,
  ): Promise<T> {
    this.lockCalls.push(key);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, current);

    await previous;
    try {
      return await callback();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}

class MemoryStoreWithoutLock implements SessionStore {
  readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const session = (id = "session-1"): Session => ({
  id,
  user: {
    sub: "user-1",
    email: "user@example.com",
    name: "Test User",
  },
  accessToken: "access-0",
  refreshToken: "refresh-0",
  expiresAt: new Date(Date.now() + 1_000).toISOString(),
});

const mockRefresh = (core: SsoCore, calls: string[]) => {
  (
    core as unknown as {
      createSession: (
        tokens: TokenResponse,
        expectedNonce?: string,
        existingId?: string,
      ) => Promise<Session>;
    }
  ).createSession = async (tokens, _expectedNonce, existingId) => ({
    ...session(existingId),
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  calls.push("configured");
};

const mockFetch = () => {
  const calls: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        access_token: `access-${calls.length}`,
        refresh_token: `refresh-${calls.length}`,
        expires_in: 900,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};

test("deduplicates concurrent refreshes with a distributed lock", async () => {
  const store = new MemoryStore();
  const core = new SsoCore(config, store);
  const configured: string[] = [];
  mockRefresh(core, configured);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session());

  try {
    const result = await Promise.all([
      core.getSession("session-1"),
      core.getSession("session-1"),
    ]);

    expect(fetchMock.calls).toHaveLength(1);
    expect(result[0]).toEqual(result[1]);
    expect(store.lockCalls).toEqual(["sso:refresh:session-1"]);
    expect(configured).toHaveLength(1);
  } finally {
    fetchMock.restore();
  }
});

test("releases the refresh lock after an error", async () => {
  const store = new MemoryStore();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      calls === 1
        ? "{}"
        : JSON.stringify({
            access_token: "access-2",
            refresh_token: "refresh-2",
            expires_in: 900,
          }),
      {
        status: calls === 1 ? 500 : 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
  await store.set("sso:session:session-1", session());

  try {
    await expect(core.getSession("session-1")).rejects.toThrow(
      "SSO token exchange failed",
    );
    await expect(core.getSession("session-1")).resolves.toMatchObject({
      accessToken: "access-2",
    });
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses the local fallback when the store has no distributed lock", async () => {
  const store = new MemoryStoreWithoutLock();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session());

  try {
    await Promise.all([
      core.getSession("session-1"),
      core.getSession("session-1"),
    ]);
    expect(fetchMock.calls).toHaveLength(1);
  } finally {
    fetchMock.restore();
  }
});

test("releases the local operation queue after an error", async () => {
  const store = new MemoryStoreWithoutLock();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      calls === 1
        ? '{}'
        : JSON.stringify({
            access_token: 'access-local-2',
            refresh_token: 'refresh-local-2',
            expires_in: 900,
          }),
      { status: calls === 1 ? 500 : 200 },
    );
  }) as typeof fetch;
  await store.set("sso:session:session-1", session());

  try {
    await expect(core.getSession("session-1")).rejects.toThrow(
      "SSO token exchange failed",
    );
    await expect(core.getSession("session-1")).resolves.toMatchObject({
      accessToken: "access-local-2",
    });
    expect(calls).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("can require a distributed lock explicitly", () => {
  expect(
    () =>
      new SsoCore(
        { ...config, requireDistributedRefreshLock: true },
        new MemoryStoreWithoutLock(),
      ),
  ).toThrow(ConfigError);
});

test("refreshes different sessions independently", async () => {
  const store = new MemoryStore();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session("session-1"));
  await store.set("sso:session:session-2", session("session-2"));

  try {
    await Promise.all([
      core.getSession("session-1"),
      core.getSession("session-2"),
    ]);
    expect(fetchMock.calls).toHaveLength(2);
  } finally {
    fetchMock.restore();
  }
});

test("a second core waits for the shared lock and uses the refreshed session", async () => {
  const store = new MemoryStore();
  const first = new SsoCore(config, store);
  const second = new SsoCore(config, store);
  mockRefresh(first, []);
  mockRefresh(second, []);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session());

  try {
    const result = await Promise.all([
      first.getSession("session-1"),
      second.getSession("session-1"),
    ]);

    expect(fetchMock.calls).toHaveLength(1);
    expect(result[0]).toEqual(result[1]);
    expect(store.lockCalls).toHaveLength(2);
  } finally {
    fetchMock.restore();
  }
});

test("deduplicates concurrent callbacks for the same state", async () => {
  const store = new MemoryStore();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const fetchMock = mockFetch();
  await store.set("sso:pkce:state-1", {
    codeVerifier: "verifier",
    nonce: "nonce-1",
  });

  try {
    const results = await Promise.all([
      core.completeCallback("code-1", "state-1"),
      core.completeCallback("code-1", "state-1"),
    ]);

    expect(fetchMock.calls).toHaveLength(1);
    expect(results[0]).toEqual(results[1]);
    expect(await store.get("sso:pkce:state-1")).toBeNull();
  } finally {
    fetchMock.restore();
  }
});

test("logout wins the session lock and prevents a refresh", async () => {
  const store = new MemoryStore();
  const core = new SsoCore(config, store);
  mockRefresh(core, []);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session());

  try {
    const logout = core.logout("session-1");
    const refresh = core.getSession("session-1");

    await logout;
    await expect(refresh).rejects.toThrow("Invalid session");
    expect(fetchMock.calls).toHaveLength(0);
    expect(await store.get("sso:session:session-1")).toBeNull();
  } finally {
    fetchMock.restore();
  }
});

test("logout revokes the refreshed child before deleting the session", async () => {
  const store = new MemoryStore();
  const core = new SsoCore({ ...config, revocationUrl: "https://identity.example.com/oauth/revoke" }, store);
  mockRefresh(core, []);
  const fetchMock = mockFetch();
  await store.set("sso:session:session-1", session());

  try {
    const refreshed = await core.getSession("session-1");
    const result = await core.logout("session-1");

    expect(refreshed.refreshToken).toBe("refresh-1");
    expect(result.revoked).toBe(true);
    expect(fetchMock.calls).toHaveLength(3);
    expect(await store.get("sso:session:session-1")).toBeNull();
  } finally {
    fetchMock.restore();
  }
});
