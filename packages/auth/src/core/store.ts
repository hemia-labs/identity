/**
 * Almacén clave/valor intercambiable para sesiones, estado PKCE y el token de servicio
 * cacheado. El núcleo depende de esta interfaz, no de Redis; el cliente aporta cualquier
 * implementación (un servicio de Redis suele encajar ya con esta forma).
 */
export interface SessionStore {
  get<T>(key: string): Promise<T | null>;
  /** Guarda `value` bajo `key`, expirando tras `ttlSeconds`. */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
