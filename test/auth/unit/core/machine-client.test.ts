import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { MachineClient, type MachineClientConfig } from "../../../../packages/auth/src/core/clients/machine-client";
import { ConfigError, MachineClientError, UnauthorizedError } from "../../../../packages/auth/src/core/errors";
import { SsoClient } from "../../../../packages/auth/src/core/clients/sso-client";
import type { SsoConfig } from "../../../../packages/auth/src/core/config";
import type { SessionStore } from "../../../../packages/auth/src/core/session/store";

const config = (): MachineClientConfig => ({
  issuer: "https://identity.test",
  tokenUrl: "https://identity.test/oauth/token",
  clientId: "product-service",
  clientSecret: "private-test-secret",
  destinations: {
    billing: {
      baseUrl: "https://billing.test/api/v1",
      audience: "billing-api",
      scopes: ["catalog.read", "checkout.create"],
    },
    legal: {
      baseUrl: "https://legal.test",
      audience: "legal-api",
      resource: "https://legal.test",
      scopes: ["acceptances.prepare"],
    },
  },
});
const tokenResponse = (
  scope = "catalog.read",
  overrides: Record<string, unknown> = {},
) =>
  Response.json({
    access_token: "signed.service.token",
    token_type: "Bearer",
    expires_in: 600,
    scope,
    ...overrides,
  });
const spies: { mockRestore(): void }[] = [];
function network() {
  const spy = spyOn(globalThis, "fetch");
  spies.push(spy);
  return spy;
}
function clock() {
  const spy = spyOn(Date, "now").mockReturnValue(1000);
  spies.push(spy);
  return spy;
}
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});

function blockedFetch(
  _input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init!.signal!;
    if (signal.aborted) reject(new Error("private-test-secret"));
    else
      signal.addEventListener(
        "abort",
        () => reject(new Error("private-test-secret")),
        { once: true },
      );
  });
}

describe("machine token contract", () => {
  test("needs no login, cookie, JWKS, session store or framework configuration", async () => {
    const fetchToken = network().mockResolvedValue(tokenResponse());
    const client = new MachineClient(config());
    expect(await client.getAccessToken("billing", ["catalog.read"])).toBe(
      "signed.service.token",
    );
    const [url, init] = fetchToken.mock.calls[0];
    expect(url).toBe("https://identity.test/oauth/token");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      credentials: "omit",
    });
    const body = init!.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "client_credentials",
      client_id: "product-service",
      client_secret: "private-test-secret",
      scope: "catalog.read",
      audience: "billing-api",
    });
  });

  test("normalizes scope order and duplicates and shares concurrent issuance", async () => {
    let release!: (value: Response) => void;
    const fetchToken = network().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const client = new MachineClient(config());
    const first = client.getAccessToken("billing", [
      "checkout.create",
      "catalog.read",
      "catalog.read",
    ]);
    const second = client.getAccessToken("billing", [
      "catalog.read",
      "checkout.create",
    ]);
    release(tokenResponse("checkout.create catalog.read"));
    expect(await Promise.all([first, second])).toEqual([
      "signed.service.token",
      "signed.service.token",
    ]);
    await client.getAccessToken("billing");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  test("isolates destinations, audiences, resources and scope sets", async () => {
    const fetchToken = network().mockImplementation((_url, init) =>
      Promise.resolve(
        tokenResponse((init!.body as URLSearchParams).get("scope")!),
      ),
    );
    const settings = config();
    settings.destinations = {
      ...settings.destinations,
      billingOtherAudience: {
        ...settings.destinations.billing,
        audience: "another-api",
      },
      billingResource: {
        ...settings.destinations.billing,
        resource: "https://billing.test",
      },
    };
    const client = new MachineClient(settings);
    for (const name of [
      "billing",
      "billingOtherAudience",
      "billingResource",
      "legal",
    ]) {
      await client.getAccessToken(name);
      await client.getAccessToken(name);
    }
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(5);
    expect(
      (fetchToken.mock.calls[3][1]!.body as URLSearchParams).get("resource"),
    ).toBe("https://legal.test");
  });

  test("does not share credentials or issuers between client instances", async () => {
    const fetchToken = network().mockImplementation(() =>
      Promise.resolve(tokenResponse("catalog.read checkout.create")),
    );
    const first = config();
    const second = config();
    second.clientId = "other-client";
    const third = config();
    third.issuer = "https://other-identity.test";
    third.tokenUrl = third.issuer + "/oauth/token";
    await Promise.all(
      [first, second, third].map((cfg) =>
        new MachineClient(cfg).getAccessToken("billing"),
      ),
    );
    expect(fetchToken).toHaveBeenCalledTimes(3);
  });

  test("snapshots configuration so mutation cannot widen destinations or scopes", async () => {
    const fetchToken = network().mockResolvedValue(tokenResponse());
    const settings = config();
    const client = new MachineClient(settings);
    (settings.destinations.billing.scopes as string[]).push("admin.write");
    settings.clientSecret = "changed";
    expect(() => client.getAccessToken("billing", ["admin.write"])).toThrow(
      ConfigError,
    );
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(
      (fetchToken.mock.calls[0][1]!.body as URLSearchParams).get(
        "client_secret",
      ),
    ).toBe("private-test-secret");
  });

  test("renews at the 30-second margin and excludes transport time", async () => {
    const now = clock();
    const fetchToken = network().mockImplementation(() =>
      Promise.resolve(tokenResponse()),
    );
    const client = new MachineClient(config());
    await client.getAccessToken("billing", ["catalog.read"]);
    now.mockReturnValue(570999);
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    now.mockReturnValue(571000);
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test("never caches a token within its renewal margin", async () => {
    const fetchToken = network().mockImplementation(() =>
      Promise.resolve(tokenResponse("catalog.read", { expires_in: 20 })),
    );
    const client = new MachineClient(config());
    await client.getAccessToken("billing", ["catalog.read"]);
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test("rejects a token whose lifetime elapsed during transport", async () => {
    const now = clock();
    network().mockImplementation(() => {
      now.mockReturnValue(602000);
      return Promise.resolve(tokenResponse());
    });
    await expect(
      new MachineClient(config()).getAccessToken("billing", ["catalog.read"]),
    ).rejects.toBeInstanceOf(MachineClientError);
  });

  test("a slow response cannot extend a token lifetime", async () => {
    const now = clock();
    const fetchToken = network().mockImplementation(() => {
      now.mockReturnValue(51000);
      return Promise.resolve(tokenResponse());
    });
    const client = new MachineClient(config());
    await client.getAccessToken("billing", ["catalog.read"]);
    now.mockReturnValue(571000);
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test.each([
    { expires_in: 0 },
    { expires_in: 601 },
    { expires_in: "600" },
    { expires_in: 1.5 },
    { token_type: "Basic" },
    { access_token: "invalid token" },
    { scope: "checkout.create" },
    { scope: "catalog.read admin.write" },
    { scope: undefined },
  ])("fails closed on invalid token responses %j", async (override) => {
    network().mockResolvedValue(tokenResponse("catalog.read", override));
    await expect(
      new MachineClient(config()).getAccessToken("billing", ["catalog.read"]),
    ).rejects.toBeInstanceOf(MachineClientError);
  });

  test("failed concurrent issuance is cleared and can recover, without provider contents", async () => {
    const fetchToken = network()
      .mockResolvedValueOnce(
        new Response("private-test-secret", { status: 401 }),
      )
      .mockResolvedValueOnce(tokenResponse());
    const client = new MachineClient(config());
    const results = await Promise.allSettled([
      client.getAccessToken("billing", ["catalog.read"]),
      client.getAccessToken("billing", ["catalog.read"]),
    ]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected")
        expect(result.reason).toMatchObject({
          stage: "token",
          status: 401,
          message: "Machine token request failed",
        });
    }
    expect(await client.getAccessToken("billing", ["catalog.read"])).toBe(
      "signed.service.token",
    );
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test("token and request timeouts bound transport and sanitize errors", async () => {
    network().mockImplementation(blockedFetch);
    const settings = config();
    settings.tokenTimeoutMs = 10;
    await expect(
      new MachineClient(settings).getAccessToken("billing"),
    ).rejects.toMatchObject({
      stage: "token",
      message: "Machine token request failed",
    });
  });
});

describe("renewal and cancellation concurrency", () => {
  test("expired entries share one replacement token", async () => {
    const now = clock();
    const fetchToken = network().mockImplementation(() =>
      Promise.resolve(tokenResponse()),
    );
    const client = new MachineClient(config());
    await client.getAccessToken("billing", ["catalog.read"]);
    now.mockReturnValue(571000);
    expect(
      await Promise.all(
        Array.from({ length: 20 }, () =>
          client.getAccessToken("billing", ["catalog.read"]),
        ),
      ),
    ).toHaveLength(20);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
  test("cancelling a waiter does not abort a token shared by another caller", async () => {
    let release!: (response: Response) => void;
    const fetchToken = network().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const client = new MachineClient(config());
    const controller = new AbortController();
    const first = client.request("billing", "catalog", {
      scopes: ["catalog.read"],
      signal: controller.signal,
    });
    const second = client.getAccessToken("billing", ["catalog.read"]);
    controller.abort();
    release(tokenResponse());
    await expect(first).rejects.toMatchObject({ stage: "request" });
    expect(await second).toBe("signed.service.token");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
  test("caller abort interrupts API transport but leaves the token available", async () => {
    let dispatched!: () => void;
    const dispatch = new Promise<void>((resolve) => {
      dispatched = resolve;
    });
    const fetchToken = network()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementationOnce((input, init) => {
        dispatched();
        return blockedFetch(input, init);
      });
    const client = new MachineClient(config());
    const controller = new AbortController();
    const call = client.request("billing", "catalog", {
      scopes: ["catalog.read"],
      signal: controller.signal,
    });
    await dispatch;
    controller.abort("private-test-secret");
    await expect(call).rejects.toMatchObject({
      stage: "request",
      message: "Machine API request failed",
    });
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});

describe("restricted machine HTTP", () => {
  test.each([
    "https://evil.test/api/v1/catalog",
    "//evil.test/api/v1/catalog",
    "/outside",
    "../outside",
    "https://user:password@billing.test/api/v1/catalog",
    "catalog#fragment",
    "https://billing.test.evil/api/v1/catalog",
    "https://billing.test/api/v1/%2e%2e%2fprivate",
    "https://billing.test/api/v1/%252e%252e%252fprivate",
  ])("rejects URL %s before requesting a token", async (path) => {
    const fetchToken = network();
    await expect(
      new MachineClient(config()).request("billing", path),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(fetchToken).not.toHaveBeenCalled();
  });

  test("unknown destinations and scopes fail before external traffic", () => {
    const fetchToken = network();
    const client = new MachineClient(config());
    expect(() => client.getAccessToken("constructor")).toThrow(ConfigError);
    expect(() => client.getAccessToken("billing", ["admin.write"])).toThrow(
      ConfigError,
    );
    expect(() => client.getAccessToken("billing", [])).toThrow(ConfigError);
    expect(fetchToken).not.toHaveBeenCalled();
  });

  test("injects the token into Headers and forbids redirects and browser credentials", async () => {
    const fetchToken = network()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    const response = await new MachineClient(config()).request(
      "billing",
      "catalog",
      {
        scopes: ["catalog.read"],
        headers: new Headers({
          Accept: "application/json",
          Authorization: "wrong",
          Cookie: "human-session=private-test-secret",
        }),
        redirect: "follow",
        credentials: "include",
      } as never,
    );
    expect(response.status).toBe(403);
    expect(String(fetchToken.mock.calls[1][0])).toBe(
      "https://billing.test/api/v1/catalog",
    );
    const init = fetchToken.mock.calls[1][1]!;
    expect(init).toMatchObject({ redirect: "error", credentials: "omit" });
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer signed.service.token",
    );
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
    expect(new Headers(init.headers).has("Cookie")).toBe(false);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test("uses its own request timeout and never retries a POST", async () => {
    const fetchToken = network()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementation(blockedFetch);
    const settings = config();
    settings.requestTimeoutMs = 10;
    await expect(
      new MachineClient(settings).request("billing", "checkout", {
        method: "POST",
        scopes: ["catalog.read"],
      }),
    ).rejects.toMatchObject({
      stage: "request",
      message: "Machine API request failed",
    });
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  test("cancellation before dispatch keeps a cached token", async () => {
    const fetchToken = network()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementationOnce(blockedFetch)
      .mockResolvedValueOnce(new Response("ok"));
    const client = new MachineClient(config());
    const controller = new AbortController();
    await client.getAccessToken("billing", ["catalog.read"]);
    const request = client.request("billing", "catalog", {
      scopes: ["catalog.read"],
      signal: controller.signal,
    });
    controller.abort("private-test-secret");
    await expect(request).rejects.toMatchObject({
      stage: "request",
      message: "Machine API request failed",
    });
    // An already-cancelled waiter must not dispatch its HTTP request.
    expect(fetchToken).toHaveBeenCalledTimes(1);
    fetchToken.mockResolvedValueOnce(new Response("ok"));
    await client.getAccessToken("billing", ["catalog.read"]);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  test("no OAuth request is sent for an already aborted caller", async () => {
    const fetchToken = network();
    const controller = new AbortController();
    controller.abort();
    await expect(
      new MachineClient(config()).request("billing", "catalog", {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(MachineClientError);
    expect(fetchToken).not.toHaveBeenCalled();
  });

  test.each([0, -1, 1.5, 30001])("rejects invalid timeout %s", (value) =>
    expect(
      () => new MachineClient({ ...config(), tokenTimeoutMs: value }),
    ).toThrow(ConfigError),
  );
  test.each([
    "http://identity.test",
    "https://user:password@identity.test",
    "https://identity.test/#fragment",
  ])("rejects unsafe issuer %s", (issuer) =>
    expect(() => new MachineClient({ ...config(), issuer })).toThrow(
      ConfigError,
    ),
  );
  test("rejects token endpoints outside the issuer", () =>
    expect(
      () =>
        new MachineClient({
          ...config(),
          tokenUrl: "https://other.test/token",
        }),
    ).toThrow(ConfigError));
  test("requires credentials even if a human login client exists elsewhere", () =>
    expect(() => new MachineClient({ ...config(), clientSecret: "" })).toThrow(
      ConfigError,
    ));
  test("rejects a resource outside the destination origin", () => {
    const settings = config();
    settings.destinations = {
      billing: {
        ...settings.destinations.billing,
        resource: "https://evil.test",
      },
    };
    expect(() => new MachineClient(settings)).toThrow(ConfigError);
  });
  test("allows explicit HTTP loopback only outside production", () => {
    const settings = config();
    settings.issuer = "http://localhost:4000";
    settings.tokenUrl = settings.issuer + "/oauth/token";
    expect(() => new MachineClient(settings)).toThrow(ConfigError);
    settings.allowHttpLoopback = true;
    expect(() => new MachineClient(settings)).not.toThrow();
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() => new MachineClient(settings)).toThrow(ConfigError);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});

describe("existing SsoClient delegation", () => {
  const settings = () =>
    ({
      issuer: "https://identity.test",
      tokenUrl: "https://identity.test/oauth/token",
      clientId: "human-login",
      clientSecret: "human-secret",
      cookieSecure: true,
      service: {
        apiBaseUrl: "https://billing.test/api/v1",
        clientId: "machine",
        clientSecret: "machine-secret",
        scopes: "catalog.read",
      },
    }) as SsoConfig;
  const unavailableStore = {
    get: async () => {
      throw Error("Redis is unavailable");
    },
    set: async () => {
      throw Error("Redis is unavailable");
    },
  } as unknown as SessionStore;
  test("uses machine credentials without accessing the session store", async () => {
    const fetchToken = network()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ plans: [] }));
    expect(
      await new SsoClient(settings(), unavailableStore).request("catalog"),
    ).toEqual({ plans: [] });
    const body = fetchToken.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get("client_id")).toBe("machine");
    expect(body.get("client_secret")).toBe("machine-secret");
    expect(body.has("audience")).toBe(false);
  });
  test("keeps UnauthorizedError for token rejection", async () => {
    network().mockResolvedValue(
      new Response("private-test-secret", { status: 401 }),
    );
    await expect(
      new SsoClient(settings(), unavailableStore).request("catalog"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
  test("still allows construction without service config and fails on first use", async () => {
    const cfg = settings();
    delete cfg.service;
    const client = new SsoClient(cfg, unavailableStore);
    await expect(client.request("catalog")).rejects.toBeInstanceOf(ConfigError);
  });
});
