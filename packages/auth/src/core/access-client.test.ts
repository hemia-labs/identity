import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { AccessClient } from "./access-client";
import type { SsoConfig } from "./config";

describe("system context verification", () => {
  let server: ReturnType<typeof Bun.serve>;
  let client: AccessClient;
  let token = "";
  let status = 200;
  let malformed = false;
  let issuer: string;
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  beforeAll(async () => {
    keys = await generateKeyPair("RS256");
    const jwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: "test",
      alg: "RS256",
      use: "sig",
    };
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        if (new URL(req.url).pathname.includes("jwks"))
          return Response.json({ keys: [jwk] });
        if (malformed) return new Response("{", { status: 200 });
        return Response.json({ context_token: token }, { status });
      },
    });
    issuer = `http://127.0.0.1:${server.port}`;
    client = new AccessClient({
      access: {
        apiBaseUrl: issuer,
        jwksUrl: issuer + "/jwks",
        audience: "access-api",
      },
    } as SsoConfig);
  });
  afterAll(() => server.stop(true));
  const signed = (
    overrides: Record<string, unknown> = {},
    header: Record<string, unknown> = {},
  ) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: issuer,
      aud: "billing-api",
      sub: "ana",
      jti: "test",
      iat: now,
      nbf: now,
      exp: now + 60,
      ...overrides,
    })
      .setProtectedHeader({
        alg: "RS256",
        typ: "hemia-context+jwt",
        kid: "test",
        ...header,
      })
      .sign(keys.privateKey);
  };
  const resolve = () =>
    client.resolveSystemContext("user-token", {
      organization_id: "org",
      product_code: "billing",
      audience: "billing-api",
    });
  test("accepts a signature from the configured issuer, audience and exact profile", async () => {
    status = 200;
    token = await signed();
    expect((await resolve()).sub).toBe("ana");
  });
  test.each([
    [{ iss: "https://wrong.test" }, {}],
    [{ aud: "access-api" }, {}],
    [{ aud: ["billing-api"] }, {}],
    [{ exp: 1 }, {}],
    [{ nbf: 9999999999 }, {}],
    [{}, { typ: "JWT" }],
    [{}, { kid: undefined }],
  ])("rejects incompatible signature profile %j", async (overrides, header) => {
    status = 200;
    token = await signed(overrides, header);
    await expect(resolve()).rejects.toMatchObject({ status: 403 });
  });
  test.each([401, 403, 409, 503])(
    "preserves Access status %i",
    async (code) => {
      status = code;
      await expect(resolve()).rejects.toMatchObject({ status: code });
    },
  );
  test("classifies malformed Access JSON as unavailable", async () => {
    malformed = true;
    try {
      await expect(resolve()).rejects.toMatchObject({ status: 503 });
    } finally {
      malformed = false;
    }
  });
});

describe("login context failures", () => {
  test("classifies unavailable and malformed Access responses without exposing tokens", async () => {
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('invalid') });
    const client = new AccessClient({ access: { apiBaseUrl: `http://127.0.0.1:${server.port}` } } as SsoConfig);
    try {
      await expect(client.getContext('secret')).rejects.toMatchObject({ status: 503, message: 'Invalid Access response' });
    } finally { server.stop(true); }
    await expect(client.getContext('secret')).rejects.toMatchObject({ status: 503, message: 'Access unavailable' });
  });
});
