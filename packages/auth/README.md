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
  clientId: 'console',
  clientSecret: process.env.HEMIA_CLIENT_SECRET,
  audience: 'console-api',
  jwksUrl: 'https://id.hemia.cloud/.well-known/jwks.json',
  authorizationUrl: 'https://id.hemia.cloud/oauth/authorize',
  tokenUrl: 'https://id.hemia.cloud/oauth/token',
  redirectUri: 'https://console.hemia.cloud/auth/callback',
  frontendUrl: 'https://console.hemia.cloud',
  scope: 'openid profile email offline_access',
  cookieName: 'console_session',
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

En despliegues con varias instancias, el `SessionStore` debe implementar `withLock` para
serializar las operaciones de sesión —refresh y logout— por sesión. El core usa una cola local
por `sessionId` como fallback; configura `requireDistributedRefreshLock: true` para fallar al
arrancar si falta el lock distribuido.

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

## Cambios de la 1.0.8 frente a la 1.0.4

Las versiones 1.0.5 a 1.0.7 se usaron en pruebas locales y no se publicaron en npm. Estas capacidades se entregan juntas en la 1.0.8.

### Contexto de autorización de sistemas

`AccessClient.resolveSystemContext(accessToken, { organization_id, product_code, audience })` solicita un contexto nuevo y verifica RS256/JWKS, `typ: hemia-context+jwt`, issuer igual a `access.apiBaseUrl` (sin slash final), audiencia escalar y vigencia sin tolerancia adicional. Conserva 401/403/409/503 mediante `AccessContextError`; no sustituye una resolución fallida por un token guardado. La aplicación valida además el contrato y el significado de las asignaciones de su producto. Los tokens permanecen server-side.

El perfil Billing v1 no modifica el flujo OAuth de Identity ni la autorización organizacional propia de Access.

### Contexto de sistema reutilizable

`SystemContextCache(store).resolve(scope, fresh, loadVerified)` comparte contextos entre instancias mediante el `SessionStore` de servidor. Requiere `withLock` distribuido. `scope` contiene sessionId, issuer, subject, organizationId, membershipId, product y audience. El callback debe verificar firma y todos los claims del contrato/identidad del producto **antes de devolverlos**. No persistir un payload decodificado sin verificación.

Para lecturas (`fresh=false`), la ventana es 60 segundos desde el inicio de resolución, limitada además por `iat + 60` y `exp`. No se prolonga al leer. Las mutaciones usan `fresh=true`, sin fallback y sin compartir una resolución anterior. Un error de resolución elimina la entrada previa. La sesión `sso:session:<id>` debe existir; logout impide reutilización aunque una entrada permanezca hasta su TTL.

El consumidor de eventos llama `invalidate({organizationId, issuer?, subject?})` antes de confirmar el mensaje: con emisor/sujeto invalida esa identidad en la organización; sin ellos invalida toda la organización. Generaciones compartidas cercan resoluciones en curso y evitan restauración por eventos fuera de orden. Su retención de diez minutos excede ampliamente la ventana de 60 segundos y el presupuesto de resolución de 25 segundos. El consumidor mantiene la política existente de eliminación de sesiones.

Caída de Access: solo se pueden servir lecturas con contexto aún válido y no invalidado. Redis inaccesible, contexto vencido o inválido: denegar. Revalidar permiso y alcance del recurso en cada petición. La pérdida de eventos puede demorar revocación de nuevas lecturas hasta 60 segundos. Las operaciones ya autorizadas no se cancelan. `exchangeUserToken` y resolución HTTP tienen timeout de cinco segundos cada una.

### Empaquetado NestJS

El adaptador NestJS importa el core publicado como módulo hermano en CJS y ESM. No duplica clases usadas como tokens DI: `SsoCore` y `AccessClient` tienen la misma identidad desde ambos entrypoints. Validación del artefacto: `bun run build && bun run test:built`. Esto corrige el fallo de arranque detectado al levantar Billing durante la aceptación integrada.

### Fallos de Access durante el login

La consulta inicial de contexto tiene timeout de cinco segundos. Fallos de red,
respuestas 5xx o JSON inválido producen `AccessContextError(503)`; 401/403 conservan
su estado. Nest redirige con `error=access_unavailable`, `access_denied` o
`auth_failed` y registra únicamente ese código cerrado, sin credenciales.
El frontend debe presentar una página pública de error y reintento manual;
redirigir automáticamente a SSO desde esa página genera un bucle.

Verificación: `bun run test`, `bun run typecheck`, `bun run build` y
`bun run test:built`.
