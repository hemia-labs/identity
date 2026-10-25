import { afterEach, expect, spyOn, test } from "bun:test";
import {
  SystemContextCache,
  type SystemContextScope,
} from "../../../../packages/auth/src/core/session/system-context-cache";
import type { SessionStore } from "../../../../packages/auth/src/core/session/store";
let now = 1_000_000;
let clock: ReturnType<typeof spyOn>;
afterEach(() => {
  clock?.mockRestore();
  now = 1_000_000;
});
const scope: SystemContextScope = {
  sessionId: "one",
  issuer: "id",
  subject: "ana",
  organizationId: "hemia",
  membershipId: "m",
  product: "billing",
  audience: "billing-api",
};
function fixture() {
  clock = spyOn(Date, "now").mockImplementation(() => now);
  const data = new Map<string, unknown>([["sso:session:one", {}]]);
  const locks = new Map<string, Promise<unknown>>();
  const store: SessionStore = {
    get: async <T>(key: string) => (data.get(key) ?? null) as T | null,
    set: async (key, value) => {
      data.set(key, value);
    },
    delete: async (key) => {
      data.delete(key);
    },
    withLock: async (key, _ttl, run) => {
      const next = (locks.get(key) ?? Promise.resolve())
        .catch(() => {})
        .then(run);
      locks.set(key, next);
      return next;
    },
  };
  let calls = 0;
  const load = async () => {
    calls++;
    return {
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 300,
      context_version: calls,
    };
  };
  return {
    cache: new SystemContextCache(store),
    other: new SystemContextCache(store),
    data,
    store,
    load,
    calls: () => calls,
  };
}
const offline = async () => {
  throw new Error("offline");
};
test("shared 60s window is not sliding; concurrent reads coalesce", async () => {
  const f = fixture();
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? f.cache : f.other).resolve(scope, false, f.load),
    ),
  );
  expect(f.calls()).toBe(1);
  now += 59_000;
  await f.other.resolve(scope, false, offline);
  now += 1000;
  await f.other.resolve(scope, false, f.load);
  expect(f.calls()).toBe(2);
});
test("every mutation resolves fresh and failed mutation removes old cache", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, f.load);
  await Promise.all([
    f.cache.resolve(scope, true, f.load),
    f.other.resolve(scope, true, f.load),
  ]);
  expect(f.calls()).toBe(3);
  await expect(f.cache.resolve(scope, true, offline)).rejects.toThrow(
    "offline",
  );
  await expect(f.cache.resolve(scope, false, offline)).rejects.toThrow(
    "offline",
  );
});
test("expiry bounds window and no fallback after expiry", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, async () => ({ iat: 1000, exp: 1010 }));
  now += 10_000;
  await expect(f.cache.resolve(scope, false, offline)).rejects.toThrow(
    "offline",
  );
});
test("identity/org events invalidate across instances, duplicate events cannot restore", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, f.load);
  await f.other.invalidate({
    organizationId: scope.organizationId,
    issuer: scope.issuer,
    subject: scope.subject,
  });
  await f.cache.resolve(scope, false, f.load);
  await f.other.invalidate({ organizationId: scope.organizationId });
  await f.other.invalidate({ organizationId: scope.organizationId });
  await f.cache.resolve(scope, false, f.load);
  expect(f.calls()).toBe(3);
});
test("in-flight resolution cannot refill after invalidation", async () => {
  const f = fixture();
  await expect(
    f.cache.resolve(scope, false, async () => {
      await f.other.invalidate({ organizationId: scope.organizationId });
      return f.load();
    }),
  ).rejects.toThrow("Authorization changed");
  await f.other.resolve(scope, false, f.load);
  expect(f.calls()).toBe(2);
});
test("logout denies cached and in-flight contexts", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, f.load);
  f.data.delete("sso:session:one");
  await expect(f.cache.resolve(scope, false, f.load)).rejects.toThrow(
    "Session",
  );
  f.data.set("sso:session:one", {});
  await expect(
    f.cache.resolve(scope, true, async () => {
      f.data.delete("sso:session:one");
      return f.load();
    }),
  ).rejects.toThrow("Session");
});
test("all identity/session/org/product/audience dimensions are isolated", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, f.load);
  f.data.set("sso:session:two", {});
  for (const field of Object.keys(scope))
    await f.cache.resolve(
      { ...scope, [field]: field === "sessionId" ? "two" : "other" },
      false,
      f.load,
    );
  expect(f.calls()).toBe(8);
});
test("rejects invalid expiry and resolution outliving lock budget", async () => {
  const f = fixture();
  await expect(f.cache.resolve(scope, false, async () => ({}))).rejects.toThrow(
    "freshness",
  );
  await expect(
    f.cache.resolve(scope, false, async () => {
      now += 25_000;
      return f.load();
    }),
  ).rejects.toThrow("freshness");
});

test("rechecks expiry after waiting for Redis generations", async () => {
  const f = fixture();
  await f.cache.resolve(scope, false, f.load);
  const get = f.store.get.bind(f.store);
  let delayed = false;
  f.store.get = async <T>(key: string) => {
    if (!delayed && key.includes(":epoch:")) {
      delayed = true;
      now += 60_000;
    }
    return get<T>(key);
  };
  await expect(f.cache.resolve(scope, false, offline)).rejects.toThrow(
    "offline",
  );
});
