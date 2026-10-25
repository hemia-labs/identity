import { createRemoteJWKSet, jwtVerify } from "jose";
import { AccessContextError, ConfigError, UnauthorizedError } from "../errors";
import type { SsoConfig } from "../config";
import type { AccessContext, TokenResponse } from "../types";

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

export class AccessClient {
  constructor(private readonly cfg: SsoConfig) {}

  async exchangeUserToken(userAccessToken: string, scope = this.cfg.scope) {
    const access = this.requireAccessConfig();
    if (!this.cfg.clientSecret) {
      throw new ConfigError("clientSecret is required for token exchange");
    }

    const res = await fetch(this.cfg.tokenUrl, {
      signal: AbortSignal.timeout(5000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: TOKEN_EXCHANGE_GRANT,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        subject_token: userAccessToken,
        subject_token_type: ACCESS_TOKEN_TYPE,
        audience: access.audience,
        scope,
      }),
    });
    if (!res.ok) throw new UnauthorizedError("Access token exchange failed");
    const tokens = (await res.json()) as TokenResponse;
    if (!tokens.access_token)
      throw new UnauthorizedError("Invalid token response");
    return tokens.access_token;
  }

  async getContext(
    accessToken: string,
    productCode = this.cfg.productCode,
  ): Promise<AccessContext> {
    const access = this.requireAccessConfig();
    const url = new URL("/v1/me/context", access.apiBaseUrl);
    if (productCode) url.searchParams.set("product", productCode);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new AccessContextError(503, "Access unavailable");
    }
    if (!res.ok)
      throw new AccessContextError(
        [401, 403].includes(res.status) ? res.status : 503,
        "Access context denied or unavailable",
      );
    try {
      const context = await res.json() as AccessContext;
      if (!context?.identity || !Array.isArray(context.organizations))
        throw new Error("Invalid context");
      return context;
    } catch {
      throw new AccessContextError(503, "Invalid Access response");
    }
  }

  async resolveContext(
    accessToken: string,
    input: {
      organization_id: string;
      audience?: string;
      product_code?: string;
    },
  ) {
    const access = this.requireAccessConfig();
    const res = await fetch(
      new URL("/v1/me/context/resolve", access.apiBaseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new UnauthorizedError("Access context resolve failed");
    return res.json() as Promise<
      { context_token: string } & Record<string, unknown>
    >;
  }

  async verifyContextToken(token: string) {
    const access = this.requireAccessConfig();
    const jwks = createRemoteJWKSet(new URL(access.jwksUrl));
    try {
      const { payload } = await jwtVerify(token, jwks, {
        audience: access.audience,
      });
      return payload;
    } catch {
      throw new UnauthorizedError(
        "Context token signature does not match JWKS",
      );
    }
  }

  /** Resolve and verify a fresh system context, without cached-token fallback. */
  async resolveSystemContext(
    accessToken: string,
    input: {
      organization_id: string;
      product_code: string;
      audience: string;
    },
  ) {
    const access = this.requireAccessConfig();
    let res: Response;
    try {
      res = await fetch(new URL("/v1/me/context/resolve", access.apiBaseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new AccessContextError(503, "Access unavailable");
    }
    if (!res.ok)
      throw new AccessContextError(
        [401, 403, 409].includes(res.status) ? res.status : 503,
        "System authorization denied or unavailable",
      );
    let result: { context_token?: unknown } | null;
    try {
      result = (await res.json()) as { context_token?: unknown } | null;
    } catch {
      throw new AccessContextError(503, "Invalid Access response");
    }
    if (
      typeof result?.context_token !== "string" ||
      result.context_token.length > 200000
    )
      throw new AccessContextError(403, "Invalid context token");
    this.systemJwks ??= createRemoteJWKSet(new URL(access.jwksUrl), {
      timeoutDuration: 5000,
    });
    try {
      const { payload, protectedHeader } = await jwtVerify(
        result.context_token,
        this.systemJwks,
        {
          issuer: access.apiBaseUrl.replace(/\/$/, ""),
          audience: input.audience,
          algorithms: ["RS256"],
          typ: "hemia-context+jwt",
          clockTolerance: 0,
          requiredClaims: ["iat", "nbf", "exp", "jti", "sub"],
        },
      );
      if (
        protectedHeader.typ !== "hemia-context+jwt" ||
        !protectedHeader.kid ||
        payload.aud !== input.audience
      )
        throw new Error("Invalid header or audience");
      return payload;
    } catch {
      throw new AccessContextError(
        403,
        "Invalid system context signature or claims",
      );
    }
  }

  private systemJwks?: ReturnType<typeof createRemoteJWKSet>;

  private requireAccessConfig() {
    if (!this.cfg.access) throw new ConfigError("access config not configured");
    return this.cfg.access;
  }
}
