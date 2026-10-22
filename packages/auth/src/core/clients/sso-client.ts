import { ConfigError, MachineClientError, UnauthorizedError } from "../errors";
import { MachineClient } from "./machine-client";
import type { SsoConfig } from "../config";
import type { SessionStore } from "../session/store";

/**
 * Existing SSO-shaped API. MachineClient owns token issuance and HTTP restrictions;
 * new service integrations should use it directly without a human login config.
 */
export class SsoClient {
  private machine?: MachineClient;

  /** The store parameter remains accepted; machine tokens use process-local cache. */
  constructor(
    private readonly cfg: SsoConfig,
    _store: SessionStore,
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const service = this.cfg.service;
    if (!service) throw new ConfigError("service credentials not configured");
    this.machine ??= new MachineClient({
      issuer: this.cfg.issuer,
      tokenUrl: this.cfg.tokenUrl,
      clientId: service.clientId ?? this.cfg.clientId,
      clientSecret: service.clientSecret ?? this.cfg.clientSecret ?? "",
      allowHttpLoopback: !this.cfg.cookieSecure,
      destinations: {
        service: {
          baseUrl: service.apiBaseUrl,
          scopes: service.scopes.trim().split(/\s+/),
        },
      },
    });
    let response: Response;
    try {
      response = await this.machine.request("service", path, init);
    } catch (error) {
      if (error instanceof MachineClientError && error.stage === "token")
        throw new UnauthorizedError("Identity token exchange failed");
      throw error;
    }
    if (!response.ok) throw new Error("Identity external API failed");
    try {
      return (await response.json()) as T;
    } catch {
      throw new Error("Invalid Identity external API response");
    }
  }
}
