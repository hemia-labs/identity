# @hemia/auth

SSO de Hemia (OAuth2 / OIDC con PKCE) para apps cliente, sin reescribir el flujo en
cada una. **Core en TypeScript puro** (sin framework) + **adapter NestJS** encima.

- `@hemia/auth` → core framework-agnostic (login PKCE, verificación JWKS, sesión con
  refresh, logout, token servicio-a-servicio, firma de webhooks).
- `@hemia/auth/nestjs` → module, controller `/auth/*`, guard y decoradores listos.

El core nunca toca `req`/`res` ni lanza excepciones de NestJS: devuelve *intenciones*
(`{ url }`, `{ cookieValue, redirectUrl }`) y clases de error propias
(`UnauthorizedError`, `ConfigError`) que el adapter aplica/mapea.

---

## Instalación

```bash
npm i @hemia/auth
```

NestJS es **peer opcional**: si solo usas el core no lo necesitas. El adapter requiere
`@nestjs/common` y `@nestjs/core` (>=10), que tu app ya tiene.

---

## Funcionalidad

### Core (`@hemia/auth`)

| Export | Qué hace |
|---|---|
| `SsoCore` | Motor del login: `buildLoginRedirect`, `completeCallback`, `getSession` (con refresh automático), `logout`, `buildErrorRedirect`. |
| `SsoClient` | Cliente servicio-a-servicio (`client_credentials`) con token cacheado + `request<T>()` autenticado. |
| `verifyWebhookSignature` | Verifica firma HMAC `sha256=<hex>` en tiempo constante. |
| `validateConfig` | Validación fail-fast de `SsoConfig` (lanza `ConfigError`). |
| `claimsToUser` | Normaliza los claims crudos del JWT a `AuthenticatedUser`. |
| `UnauthorizedError`, `ConfigError` | Errores del core, sin acoplar a ningún framework. |
| tipos | `SsoConfig`, `SessionStore`, `Session`, `AuthenticatedUser`, `SsoClaims`, `TokenResponse`. |

### Adapter NestJS (`@hemia/auth/nestjs`)

| Export | Qué hace |
|---|---|
| `SsoModule.forRootAsync(...)` | Dynamic module: toma tu config + store, instancia `SsoCore`/`SsoClient`, registra controller y guard. |
| `SsoAuthGuard` | Guard global: lee la cookie, resuelve la sesión y cuelga `req.user`. |
| `SsoExceptionFilter` | Mapea `UnauthorizedError` → 401, `ConfigError` → 500. |
| `Public()` | Marca una ruta/controlador como público (sin sesión). |
| `CurrentUser()` | Inyecta el `AuthenticatedUser` autenticado. |
| `SSO_CONFIG`, `SESSION_STORE` | Tokens de DI. |

Rutas que monta el module automáticamente:

| Método | Ruta | Efecto |
|---|---|---|
| `GET` | `/auth/login` | Redirige al endpoint de autorización del SSO. |
| `GET` | `/auth/callback` | Intercambia el code, crea sesión, setea la cookie y redirige al frontend. |
| `GET` | `/auth/session` | Devuelve `{ authenticated, user }`; refresca si está por expirar. |
| `POST` | `/auth/logout` | Revoca tokens y limpia la cookie. |

---

## Uso en NestJS

Lo que escribe la app es: registrar el module, activar guard + filtro globales, y usar
los decoradores. Todo el flujo OAuth/PKCE/JWKS/sesión/refresh/logout viene resuelto.

### 1. Registrar el module

```ts
import { SsoModule, SESSION_STORE } from '@hemia/auth/nestjs';
import { claimsToUser } from '@hemia/auth';
import type { SsoConfig } from '@hemia/auth';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [ssoConfig] }),
    RedisModule,                       // el módulo redis propio de la app
    SsoModule.forRootAsync({
      imports: [ConfigModule, RedisModule, UsersModule],
      inject: [ConfigService, UsersService],

      // tu servicio Redis ya cumple la interfaz SessionStore (get/set/delete)
      store: { provide: SESSION_STORE, useExisting: AuthRedisService },

      useFactoryConfig: (cfg: ConfigService, users: UsersService): SsoConfig => ({
        issuer:           cfg.getOrThrow('sso.issuer'),
        clientId:         cfg.getOrThrow('sso.clientId'),
        clientSecret:     cfg.get('sso.clientSecret'),
        audience:         cfg.getOrThrow('sso.audience'),
        jwksUrl:          cfg.getOrThrow('sso.jwksUrl'),
        authorizationUrl: cfg.getOrThrow('sso.authorizationUrl'),
        tokenUrl:         cfg.getOrThrow('sso.tokenUrl'),
        revocationUrl:    cfg.get('sso.revocationUrl'),
        redirectUri:      cfg.getOrThrow('sso.redirectUri'),
        frontendUrl:      cfg.getOrThrow('sso.frontendUrl'),
        scope:            'openid profile email offline_access docs.access',
        cookieName:       'docs_session',
        sessionTtlSeconds: 7 * 24 * 3600,
        cookieSecure:     cfg.get('NODE_ENV') === 'production',

        // servicio-a-servicio (opcional): solo si la app usa SsoClient
        service: {
          apiBaseUrl:   cfg.getOrThrow('identity.apiBaseUrl'),
          clientId:     cfg.get('identity.serviceClientId'),     // default: clientId del login
          clientSecret: cfg.get('identity.serviceClientSecret'),
          scopes:       cfg.getOrThrow('identity.serviceScopes'),
        },

        // lo único específico de esta app: 2 hooks
        authorize: (claims) =>
          claimsToUser(claims).permissions.some((p) =>
            ['docs.access', 'docs.admin'].includes(p)),
        onUserResolved: async (user) => {
          const internal = await users.resolveFromSsoUser(user);
          return { internalUserId: internal.id };
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. Bootstrap obligatorio (main.ts)

Dos líneas imprescindibles, independientes de cómo apliques el guard:

```ts
import { SsoExceptionFilter } from '@hemia/auth/nestjs';
import cookieParser from 'cookie-parser';

app.use(cookieParser());                          // el guard lee req.cookies[cookieName]
app.useGlobalFilters(new SsoExceptionFilter());   // UnauthorizedError → 401, ConfigError → 500
```

Sin `cookieParser` el guard no ve la cookie de sesión; sin el filtro, los errores del
core salen como 500 genérico.

### 3. Proteger rutas con el guard

`SsoModule` es global, así que `SsoAuthGuard` (y `SSO_CONFIG`, del que depende) están
disponibles en toda la app. Dos modos:

**a) Por ruta/controlador** — explícito, granular:

```ts
import { Public, CurrentUser, SsoAuthGuard } from '@hemia/auth/nestjs';
import type { AuthenticatedUser } from '@hemia/auth';

@Controller('me')
export class MeController {
  @Get()
  @UseGuards(SsoAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
```

**b) Global** — protege todo, y eximís endpoints con `@Public()`:

```ts
// en main.ts, junto al bootstrap de arriba
app.useGlobalGuards(app.get(SsoAuthGuard));       // o un provider APP_GUARD
```

```ts
import { Public, CurrentUser } from '@hemia/auth/nestjs';
import type { AuthenticatedUser } from '@hemia/auth';

@Controller('documents')
export class DocumentsController {
  @Get()                                          // protegido por el guard global
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.docs.listFor(user.internalUserId);
  }

  @Public()                                        // sin sesión
  @Get('health')
  health() {
    return { ok: true };
  }
}
```

### Decoradores y forma del usuario

| Decorador | Qué hace |
|---|---|
| `@UseGuards(SsoAuthGuard)` | Protege la ruta/controlador: exige sesión válida o responde 401. |
| `@Public()` | Exime del guard global una ruta/controlador. |
| `@CurrentUser()` | Inyecta el `AuthenticatedUser` que el guard cuelga en `req.user`. |

`@CurrentUser()` solo está poblado en rutas que pasan por `SsoAuthGuard`: en una ruta
`@Public()` (o sin guard) devuelve `undefined`, porque es el guard quien lo adjunta. No
acepta selector de campo (`@CurrentUser('email')` no está soportado).

Devuelve el `AuthenticatedUser` **más** el contexto de auth (`CurrentUserPayload`), para
poder reenviar el token del usuario a APIs de contexto-usuario:

```ts
/** Lo que inyecta @CurrentUser(): AuthenticatedUser & RequestAuthContext */
type CurrentUserPayload = AuthenticatedUser & RequestAuthContext;

interface AuthenticatedUser {
  ssoUserId: string;
  email: string;
  name: string;
  tenantId: string;
  organizationId: string;
  teamId: string;
  roles: string[];
  permissions: string[];
  internalUserId?: string;   // poblado por el hook onUserResolved
}

interface RequestAuthContext {
  accessToken: string;       // access token del usuario (de la sesión en el store, ya refrescado)
  cookie: string;            // valor crudo de la cookie de sesión (id opaco)
  authorization: string;     // `Bearer <accessToken>`, listo para reenviar
}
```

Ejemplo: reenviar el token del usuario a una API de identity de contexto-usuario:

```ts
@Get('profile')
@UseGuards(SsoAuthGuard)
profile(@CurrentUser() user: CurrentUserPayload) {
  return fetch('https://identity.../identity-access/users/' + user.ssoUserId, {
    headers: { Authorization: user.authorization },   // Bearer <accessToken> del usuario
  }).then((r) => r.json());
}
```

> El `accessToken`/`authorization` quedan disponibles en **todas** las rutas protegidas
> por el guard. Si tu modelo de seguridad prefiere no exponer el token al handler, no lo
> uses — `@CurrentUser()` sigue trayendo el usuario igual.

### 4. (Opcional) Llamadas servicio-a-servicio

`SsoClient` da el token `client_credentials` cacheado + `request()` autenticado. Cada
app arma sus endpoints encima — eso es código de la app, no del package:

```ts
import { SsoClient } from '@hemia/auth';

@Injectable()
export class IdentityClient {
  constructor(private readonly sso: SsoClient) {}  // exportado por SsoModule

  findUserByEmail(email: string) {
    return this.sso.request(
      `/api/v1/external/users/by-email?email=${encodeURIComponent(email)}`);
  }

  createInvitation(payload: CreateInvitationPayload) {
    return this.sso.request('/api/v1/external/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### 5. (Opcional) Webhook

```ts
import { verifyWebhookSignature } from '@hemia/auth';

@Public()
@Controller('identity/webhooks')
export class IdentityWebhooksController {
  @Post()
  handle(
    @Headers('x-identity-signature') sig: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!verifyWebhookSignature(req.rawBody, sig, process.env.IDENTITY_WEBHOOK_SECRET!))
      throw new ForbiddenException('Invalid signature');
    return this.workspaces.handleIdentityWebhook(req.body);   // efecto = de la app
  }
}
```

---

## SessionStore

El core no depende de Redis, sino de esta interfaz. Cualquier impl sirve (un servicio
Redis típico ya encaja):

```ts
interface SessionStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
```

Guarda sesiones (`sso:session:<id>`), estado PKCE transitorio (`sso:pkce:<state>`, TTL
5 min) y el token de servicio cacheado (`sso:service-token`).

---

## Hooks (lo específico de cada app)

Se inyectan en la config; nunca entran al package:

- `authorize(claims)` → `boolean` — rechaza el login si la app no autoriza al usuario
  (p. ej. le falta un permiso). Recibe los claims crudos; usa `claimsToUser(claims)`
  para la vista normalizada.
- `onUserResolved(user)` → `{ internalUserId }` — mapea el usuario del SSO a tu registro
  interno; el id se guarda en `user.internalUserId`.

---

## Uso sin NestJS (core directo)

El core es independiente del framework. Para un adapter Express/Fastify (no incluido
hoy), instancia `SsoCore` y aplica tú mismo las intenciones:

```ts
import { SsoCore, validateConfig } from '@hemia/auth';

const core = new SsoCore(validateConfig(cfg), store);

// login
const { url } = await core.buildLoginRedirect(returnTo);
res.redirect(url);

// callback
const { cookieValue, redirectUrl } = await core.completeCallback(code, state);
res.cookie(cfg.cookieName, cookieValue, { httpOnly: true, /* ... */ });
res.redirect(redirectUrl);
```
