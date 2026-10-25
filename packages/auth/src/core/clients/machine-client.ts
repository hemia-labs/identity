import { ConfigError, MachineClientError } from "../errors";

/** A trusted API and the exact scopes this client may request for it. */
export type MachineDestination = {
  baseUrl: string;
  scopes: readonly string[];
  /** Omit only for an OAuth client with one fixed audience. */
  audience?: string;
  /** Registered OAuth resource; must belong to the API's origin. */
  resource?: string;
};

/** Server-side credentials, independent of login, cookies and SessionStore. */
export type MachineClientConfig = {
  issuer: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  destinations: Readonly<Record<string, MachineDestination>>;
  tokenTimeoutMs?: number;
  requestTimeoutMs?: number;
  /** Development only. Production always requires HTTPS. */
  allowHttpLoopback?: boolean;
};

export type MachineRequestInit = Omit<
  RequestInit,
  "redirect" | "credentials"
> & {
  scopes?: readonly string[];
};

type Destination = {
  baseUrl: URL;
  scopes: string[];
  audience?: string;
  resource?: string;
};
const scopePattern = /^[\x21\x23-\x5B\x5D-\x7E]+$/;
const tokenMarginMs = 30_000;

/**
 * OAuth client_credentials with process-local expiry and single-flight issuance.
 * HTTP responses remain available to domain clients; POSTs are never retried here.
 */
export class MachineClient {
  private readonly issuer: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly destinations = new Map<string, Destination>();
  private readonly tokenTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly cache = new Map<
    string,
    { token: string; refreshAt: number }
  >();
  private readonly pending = new Map<string, Promise<string>>();

  constructor(config: MachineClientConfig) {
    if (
      !config ||
      !config.destinations ||
      typeof config.destinations !== "object" ||
      Array.isArray(config.destinations)
    )
      throw new ConfigError("Machine destinations are required");
    const allowHttp =
      config.allowHttpLoopback === true &&
      process.env.NODE_ENV !== "production";
    const issuer = this.endpoint(config.issuer, allowHttp);
    const tokenUrl = this.endpoint(config.tokenUrl, allowHttp);
    if (issuer.origin !== tokenUrl.origin)
      throw new ConfigError(
        "Token endpoint must belong to the configured issuer",
      );
    if (
      typeof config.clientId !== "string" ||
      !config.clientId ||
      config.clientId.length > 120 ||
      typeof config.clientSecret !== "string" ||
      !config.clientSecret ||
      config.clientSecret.length > 255
    )
      throw new ConfigError("Machine credentials are required");
    this.issuer = issuer.href;
    this.tokenUrl = tokenUrl.href;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenTimeoutMs = this.timeout(config.tokenTimeoutMs ?? 5_000);
    this.requestTimeoutMs = this.timeout(config.requestTimeoutMs ?? 5_000);
    for (const [name, value] of Object.entries(config.destinations)) {
      if (!value || typeof value !== "object")
        throw new ConfigError("Invalid machine destination");
      if (!name) throw new ConfigError("Machine destination name is required");
      const baseUrl = this.endpoint(value.baseUrl, allowHttp);
      if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
      if (
        value.audience !== undefined &&
        (typeof value.audience !== "string" ||
          !value.audience ||
          /\s/.test(value.audience))
      )
        throw new ConfigError("Invalid machine audience");
      const resource =
        value.resource === undefined
          ? undefined
          : this.endpoint(value.resource, allowHttp);
      if (resource && resource.origin !== baseUrl.origin)
        throw new ConfigError(
          "Resource must belong to the machine destination",
        );
      this.destinations.set(name, {
        baseUrl,
        audience: value.audience,
        resource: value.resource,
        scopes: this.scopes(value.scopes),
      });
    }
    if (!this.destinations.size)
      throw new ConfigError("At least one machine destination is required");
  }

  /** Issue or reuse a token only for a configured destination and allowed scopes. */
  getAccessToken(
    destination: string,
    scopes?: readonly string[],
  ): Promise<string> {
    const target = this.destination(destination);
    const selected = this.scopes(scopes ?? target.scopes);
    if (selected.some((scope) => !target.scopes.includes(scope)))
      throw new ConfigError("Scopes are outside the machine destination");
    const key = JSON.stringify([
      this.issuer,
      this.tokenUrl,
      this.clientId,
      target.baseUrl.href,
      target.audience,
      target.resource,
      selected,
    ]);
    for (const [oldKey, oldValue] of this.cache)
      if (oldValue.refreshAt <= Date.now()) this.cache.delete(oldKey);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached.token);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const issued = this.issue(target, selected)
      .then(({ token, refreshAt }) => {
        if (refreshAt > Date.now()) this.cache.set(key, { token, refreshAt });
        return token;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, issued);
    return issued;
  }

  /**
   * Fetch within the configured origin and base path. Never follows redirects or
   * forwards cookies; preserves upstream HTTP status for the domain's error policy.
   */
  async request(
    destination: string,
    path: string,
    init: MachineRequestInit = {},
  ): Promise<Response> {
    const target = this.destination(destination);
    let url: URL;
    try {
      if (typeof path !== "string") throw new Error();
      url = new URL(path, target.baseUrl);
    } catch {
      throw new ConfigError("Invalid machine request URL");
    }
    if (
      url.origin !== target.baseUrl.origin ||
      url.username ||
      url.password ||
      url.hash ||
      !url.pathname.startsWith(target.baseUrl.pathname) ||
      /%(?:2f|5c|25)/i.test(url.pathname)
    )
      throw new ConfigError("Request URL is outside the machine destination");
    const { scopes, ...options } = init;
    try {
      options.signal?.throwIfAborted();
    } catch {
      throw new MachineClientError("request");
    }
    const token = await this.getAccessToken(destination, scopes);
    try {
      options.signal?.throwIfAborted();
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.delete("Cookie");
      return await fetch(url, {
        ...options,
        headers,
        redirect: "error",
        credentials: "omit",
        signal: options.signal
          ? AbortSignal.any([
              options.signal,
              AbortSignal.timeout(this.requestTimeoutMs),
            ])
          : AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      throw new MachineClientError("request");
    }
  }

  private async issue(target: Destination, scopes: string[]) {
    const startedAt = Date.now();
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: scopes.join(" "),
      });
      if (target.resource !== undefined) body.set("resource", target.resource);
      if (target.audience !== undefined) body.set("audience", target.audience);
      const response = await fetch(this.tokenUrl, {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(this.tokenTimeoutMs),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new MachineClientError("token", response.status);
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new MachineClientError("token");
      const result = value as Record<string, unknown>;
      if (
        typeof result.access_token !== "string" ||
        result.access_token.length > 16384 ||
        !/^[A-Za-z0-9._~-]+$/.test(result.access_token) ||
        result.token_type !== "Bearer" ||
        typeof result.expires_in !== "number" ||
        !Number.isInteger(result.expires_in) ||
        result.expires_in <= 0 ||
        result.expires_in > 600 ||
        typeof result.scope !== "string" ||
        JSON.stringify(this.scopes(result.scope.split(" "))) !==
          JSON.stringify(scopes)
      )
        throw new MachineClientError("token");
      // The lifetime starts before transport, never when a slow response arrives.
      const expiresAt = startedAt + result.expires_in * 1000;
      if (expiresAt <= Date.now()) throw new MachineClientError("token");
      return {
        token: result.access_token,
        refreshAt: expiresAt - tokenMarginMs,
      };
    } catch (error) {
      if (error instanceof MachineClientError) throw error;
      throw new MachineClientError("token");
    }
  }

  private destination(name: string) {
    const value = this.destinations.get(name);
    if (!value) throw new ConfigError("Unknown machine destination");
    return value;
  }

  private scopes(values: readonly string[]) {
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.some(
        (value) => typeof value !== "string" || !scopePattern.test(value),
      )
    )
      throw new ConfigError("Invalid machine scopes");
    const normalized = [...new Set(values)].sort();
    if (normalized.join(" ").length > 500)
      throw new ConfigError("Machine scopes exceed the token contract");
    return normalized;
  }

  private timeout(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 30_000)
      throw new ConfigError("Machine timeout must be between 1 and 30000 ms");
    return value;
  }

  private endpoint(value: string, allowHttp: boolean) {
    let url: URL;
    try {
      if (typeof value !== "string") throw new Error();
      url = new URL(value);
    } catch {
      throw new ConfigError("Invalid machine endpoint");
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && local && allowHttp))
    )
      throw new ConfigError(
        "Machine endpoints require HTTPS; development loopback is explicit",
      );
    return url;
  }
}
