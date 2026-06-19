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
