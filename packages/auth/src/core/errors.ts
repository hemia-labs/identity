/**
 * Fallo de autenticación/autorización. Independiente del framework por diseño; el
 * adaptador de NestJS lo mapea a HTTP 401.
 */
export class UnauthorizedError extends Error {}

/**
 * Configuración inválida o incompleta, detectada al arrancar o en el primer uso. El
 * adaptador de NestJS la mapea a HTTP 500.
 */
export class ConfigError extends Error {}

/** Status-preserving system authorization failure; contains no tokens. */
export class AccessContextError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AccessContextError";
  }
}

/** Sanitized transport/token failure. Never contains provider bodies or secrets. */
export class MachineClientError extends Error {
  constructor(
    public readonly stage: "token" | "request",
    public readonly status?: number,
  ) {
    super(
      stage === "token"
        ? "Machine token request failed"
        : "Machine API request failed",
    );
    this.name = "MachineClientError";
  }
}
