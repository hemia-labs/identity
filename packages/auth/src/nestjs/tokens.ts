/** Token de DI para el {@link SsoConfig} validado que provee la app cliente. */
export const SSO_CONFIG = Symbol('SSO_CONFIG');

/** Token de DI bajo el cual la app cliente debe proveer su {@link SessionStore}. */
export const SESSION_STORE = Symbol('SESSION_STORE');
