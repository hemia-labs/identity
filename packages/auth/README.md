# @hemia/auth

SDK oficial para integrar productos con Hemia ID y Hemia Access.

v1 usa OAuth2/OIDC con Authorization Code + PKCE, sesiones propias de la app y contexto global de Access. Los tokens de Identity ya no contienen datos organizacionales: la identidad vive en `sub` + `iss`; el acceso global se resuelve con `AccessClient`.

## Install

```bash
npm i @hemia/auth
```

## Core

```ts
import { AccessClient, SsoCore, validateConfig } from '@hemia/auth'
import type { SsoConfig } from '@hemia/auth'

const config: SsoConfig = validateConfig({
  issuer: 'https://id.hemia.cloud',
  clientId: 'horus',
  clientSecret: process.env.HEMIA_CLIENT_SECRET,
  audience: 'horus-api',
  jwksUrl: 'https://id.hemia.cloud/.well-known/jwks.json',
  authorizationUrl: 'https://id.hemia.cloud/oauth/authorize',
  tokenUrl: 'https://id.hemia.cloud/oauth/token',
  redirectUri: 'https://horus.hemia.cloud/auth/callback',
  frontendUrl: 'https://horus.hemia.cloud',
  scope: 'openid profile email offline_access',
  cookieName: 'horus_session',
  sessionTtlSeconds: 7 * 24 * 3600,
  cookieSecure: true,
  access: {
    apiBaseUrl: 'https://access.hemia.cloud',
    jwksUrl: 'https://access.hemia.cloud/.well-known/jwks.json',
    audience: 'access-api',
  },
})

const access = new AccessClient(config)
```

## Authenticated User

```ts
type AuthenticatedUser = {
  sub: string
  iss?: string
  email: string
  name: string
  internalUserId?: string
}
```

`Session` contiene:

```ts
type Session = {
  id: string
  user: AuthenticatedUser
  accessContext?: AccessContext
  contextToken?: string
  accessToken: string
  refreshToken?: string
  expiresAt: string
}
```

## Access Context

`AccessClient` cubre:

- Token exchange contra Identity para obtener `aud=access-api`.
- `GET /v1/me/context`.
- `POST /v1/me/context/resolve`.
- Validacion de context tokens con el JWKS de Access.

```ts
const exchanged = await access.exchangeUserToken(identityAccessToken)
const context = await access.getContext(exchanged)
const resolved = await access.resolveContext(exchanged, {
  organization_id: context.organizations[0].organization_id,
  product_code: 'horus',
})
await access.verifyContextToken(resolved.context_token)
```

El SDK no evalua autorizacion especifica de producto. Cada producto resuelve su contexto local con su propio modelo.

## NestJS

```ts
import { SsoModule, SESSION_STORE } from '@hemia/auth/nestjs'

SsoModule.forRootAsync({
  store: {
    provide: SESSION_STORE,
    useClass: RedisSessionStore,
  },
  useFactoryConfig: () => config,
})
```

El guard expone:

- `req.user`
- `req.accessContext`
- `@CurrentUser()`
- `@CurrentAccessContext()`

## SvelteKit

```ts
import { SsoCore } from '@hemia/auth'
import { createSsoHandlers, createSsoHook } from '@hemia/auth/sveltekit'

export const ssoCore = new SsoCore(config, store)
export const ssoHandlers = createSsoHandlers(ssoCore, config)
export const handle = createSsoHook(ssoCore, config)
```

El hook escribe `locals.user` y `locals.accessContext`.

## Migration Checklist

- Actualizar a `@hemia/auth@1`.
- Dejar de leer datos organizacionales desde tokens de Identity.
- Usar `user.sub` + `user.iss` como referencia de identidad.
- Resolver contexto global con `AccessClient`.
- Resolver contexto y autorizacion especificos en el producto.
