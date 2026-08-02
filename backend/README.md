# Hemia ID Backend

Backend NestJS para identidad central, sesiones, SSO interno y OAuth/OIDC.

Este README explica como consumir cada tipo de autenticacion, cuando elegir cada flujo, que debe hacer una app cliente y como operar el backend con una o varias bases de datos.

## Mapa rapido

```txt
/api/v1/auth/* = login central Hemia ID con cookies HttpOnly
/api/v1/sso/*  = SSO interno Hemia para apps de confianza
/oauth/*       = OAuth 2.0 estandar, sin prefijo api/v1
/oidc/*        = OIDC userinfo, sin prefijo api/v1
/.well-known/* = discovery OIDC y JWKS, sin prefijo api/v1
```

Regla practica:

| Caso | Usar | Quien guarda sesion | Tokens visibles en browser |
| --- | --- | --- | --- |
| Frontend propio de Hemia ID | `/api/v1/auth/*` | Hemia ID | Ninguno; cookies HttpOnly |
| Producto interno Hemia | `/api/v1/sso/*` | App cliente + Hemia ID | Ninguno; code temporal |
| Cliente externo/mobile/integracion estandar | `/oauth/*` + `/oidc/*` | Cliente OAuth/OIDC | Access token del cliente |
| Servicio backend a backend | `/oauth/token` con `client_credentials` | Servicio consumidor | Access token de servicio |

## Configuracion minima

Variables principales:

```env
PORT=3000
APP_ISSUER=https://id.hemia.cloud
APP_CORS_ORIGINS=https://id.hemia.cloud,https://console.hemia.cloud

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=hemia
DB_PASSWORD=hemia
DB_DATABASE=hemia_id
DB_SSL=false

JWT_ACCESS_SECRET=change_me_at_least_32_chars_access
JWT_REFRESH_SECRET=change_me_at_least_32_chars_refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

COOKIE_DOMAIN=.hemia.cloud
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Notas:

- `APP_ISSUER` debe ser la URL publica estable de Hemia ID. OIDC discovery, `iss` de tokens y JWKS dependen de esto.
- En produccion usar `COOKIE_SECURE=true`.
- Si las apps viven en subdominios de la misma raiz, usar `COOKIE_DOMAIN=.hemia.cloud`.
- Si una app esta en otro dominio, no depender de cookies globales en browser; usar OAuth/OIDC.

## Tipo 1: Login directo Hemia ID

Usar cuando el frontend es el de Hemia ID, por ejemplo `id.hemia.cloud`.

Flujo:

1. Usuario manda `identifier` y `password` a `/api/v1/auth/login`.
2. Backend valida password con Argon2id.
3. Backend crea una sesion.
4. Backend guarda refresh token hasheado.
5. Backend envia cookies HttpOnly:
  - `access_token`
  - `refresh_token`
6. Frontend llama endpoints privados con `credentials: "include"`.

Login:

```ts
await fetch('https://id.hemia.cloud/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'user@hemia.cloud',
    password: 'password123',
  }),
});
```

Sesion actual:

```ts
const response = await fetch('https://id.hemia.cloud/api/v1/auth/session', {
  credentials: 'include',
});

const session = await response.json();
```

Refresh:

```ts
await fetch('https://id.hemia.cloud/api/v1/auth/refresh', {
  method: 'POST',
  credentials: 'include',
});
```

Logout:

```ts
await fetch('https://id.hemia.cloud/api/v1/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
```

No hacer:

- No guardar access/refresh tokens en `localStorage`.
- No leer cookies desde JS; son HttpOnly.
- No compartir refresh token de Hemia ID con otras apps.

### Login con Google

Usar cuando quieres que un usuario entre a Hemia ID con su cuenta Google, pero que al final quede autenticado igual que un usuario que hizo login con password.

Este metodo no reemplaza OAuth/OIDC de Hemia ID como proveedor para terceros. Google aqui funciona como proveedor externo de identidad para crear o recuperar una sesion central Hemia ID.

Que hace:

- Redirige al usuario a Google.
- Valida el callback de Google con `state` firmado y cookie temporal `oauth_state`.
- Exige email de Google verificado.
- Linkea la cuenta Google con un user Hemia ID mediante `external_accounts`.
- Si el user ya existe por email, conecta Google a ese user.
- Si el user no existe, crea un user activo con `password_hash=null`.
- Crea una sesion normal Hemia ID.
- Setea las cookies HttpOnly existentes:

```txt
access_token
refresh_token
```

Flujo:

1. Frontend manda al usuario a `/api/v1/auth/google?redirect_uri=...`.
2. Backend valida que `redirect_uri` este permitido en `AUTH_ALLOWED_REDIRECT_URIS`.
3. Backend crea `state` firmado con `OAUTH_STATE_SECRET`.
4. Backend guarda el mismo `state` en cookie HttpOnly `oauth_state` por 5 minutos.
5. Backend redirige al usuario a Google.
6. Google vuelve a `/api/v1/auth/google/callback`.
7. Backend valida que el `state` query coincida con la cookie `oauth_state`.
8. Backend valida firma, expiracion y proposito del `state`.
9. Backend valida profile Google y `email_verified`.
10. Backend busca o crea el user Hemia ID.
11. Backend crea sesion, refresh token hasheado y cookies Hemia.
12. Backend limpia `oauth_state` y redirige al `redirect_uri` original.

Inicio desde browser:

```txt
GET https://id.hemia.cloud/api/v1/auth/google?redirect_uri=https%3A%2F%2Fconsole.hemia.cloud%2Fauth%2Fcallback
```

Callback registrado en Google:

```txt
https://id.hemia.cloud/api/v1/auth/google/callback
```

Variables necesarias:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://id.hemia.cloud/api/v1/auth/google/callback
OAUTH_STATE_SECRET=change_me_at_least_32_chars
AUTH_ALLOWED_REDIRECT_URIS=https://console.hemia.cloud/auth/callback
```

El `redirect_uri` debe coincidir exactamente con un valor en `AUTH_ALLOWED_REDIRECT_URIS`.

Ejemplo frontend:

```ts
const redirectUri = 'https://console.hemia.cloud/auth/callback';
const url = new URL('https://id.hemia.cloud/api/v1/auth/google');

url.searchParams.set('redirect_uri', redirectUri);
window.location.href = url.toString();
```

Ejemplo callback frontend:

```ts
const response = await fetch('https://id.hemia.cloud/api/v1/auth/session', {
  credentials: 'include',
});

if (response.ok) {
  const session = await response.json();
  // Usuario autenticado con sesion Hemia ID.
}
```

No hay que intercambiar `code` en el frontend. El callback Google lo recibe el backend y el frontend solo recibe la redireccion final con cookies ya seteadas.

Link de usuario:

- Si ya existe `external_accounts(provider=google, provider_account_id=<google_id>)`, se usa ese user.
- Si no existe link, se busca user por email normalizado.
- Si el user existe y esta activo, se crea el link con Google.
- Si el user no existe, se crea activo con `password_hash=null`.
- El auto-link por email solo ocurre si Google entrega email verificado.

Tabla requerida:

```txt
external_accounts
```

Campos esperados:

```txt
id
user_id
provider
provider_account_id
email
email_verified
created_at
updated_at
deleted_at
```

Indice unico recomendado:

```sql
CREATE UNIQUE INDEX "IDX_external_accounts_provider_account_active_unique"
ON "external_accounts" ("provider", "provider_account_id")
WHERE "deleted_at" IS NULL;
```

Este feature requiere migracion manual para la tabla `external_accounts`; no se genera migracion automaticamente.

## Tipo 2: SSO interno Hemia

Usar cuando la app cliente es un producto interno de confianza, por ejemplo `console.hemia.cloud`, `billing.hemia.cloud` o `admin.hemia.cloud`.

Este flujo no es OAuth estandar. Es un SSO simple interno basado en code temporal de un solo uso.

### Modelo recomendado para sistemas internos Hemia

Hemia debe modelarse como un tenant normal, no como un caso especial hardcodeado.

```txt
Tenant: Hemia
  Organizaciones/equipos:
    - Hemia HQ
    - Producto
    - Soporte

  Usuarios:
    - cristian@hemia.mx
    - soporte@hemia.mx

  Apps internas:
    - hemia_console
    - hemia_crm
    - hemia_deploy
    - hemia_admin
```

Regla conceptual:

```txt
tenant_id   = contexto organizacional activo
client_id   = app que solicita acceso
membership  = permisos del usuario dentro del tenant/org/team
issuer      = Hemia ID, por ejemplo https://id.hemia.cloud
```

Ejemplo para un usuario interno entrando a Hemia Console:

```txt
tenant_id = Hemia
client_id = hemia_console
audience  = hemia_console
issuer    = https://id.hemia.cloud
```

Ejemplo para un cliente externo usando la misma Hemia Console:

```txt
tenant_id = Cliente ABC
client_id = hemia_console
audience  = hemia_console
issuer    = https://id.hemia.cloud
```

La app puede ser la misma (`hemia_console`), pero el contexto activo cambia por tenant, organizacion o equipo. Por eso el backend no debe inferir permisos solo por `client_id`; debe combinarlos con membership y contexto activo.

Para productos first-party de Hemia, registrar el cliente con politica de confianza:

```txt
client_id: hemia_console
first_party: true
requires_consent: false
allowed_tenant_ids:
  - <tenant_id_hemia>
allowed_redirect_uris:
  - https://console.hemia.cloud/auth/callback
```

Si esos campos aun no existen en schema, tratarlos como politica objetivo. No hardcodear `Hemia` como bypass; agregar flags/configuracion explicita al cliente cuando haga falta.

Preparacion:

1. Crear un registro en `sso_clients`.
2. Definir `client_id`, por ejemplo `hemia_console`.
3. Definir `allowed_redirect_uris`, por ejemplo `https://console.hemia.cloud/auth/callback`.
4. Definir `allowed_origins` si el cliente necesita validaciones por origen.
5. Mantener `status=active`.

Flujo:

1. App cliente redirige a Hemia ID.
2. Hemia ID valida sesion con cookies.
3. Si no hay sesion, Hemia ID manda a login y vuelve al authorize.
4. Hemia ID genera `code` temporal de un solo uso.
5. Hemia ID redirige a `redirect_uri` con `code` y `state`.
6. Backend de la app cliente intercambia el `code` server-to-server.
7. App cliente crea su propia cookie local.

Authorize desde browser:

```txt
GET https://id.hemia.cloud/api/v1/sso/authorize?client_id=hemia_console&redirect_uri=https%3A%2F%2Fconsole.hemia.cloud%2Fauth%2Fcallback&state=random_state
```

Callback recibido por la app cliente:

```txt
https://console.hemia.cloud/auth/callback?code=temporary_code&state=random_state
```

Intercambio desde backend de la app cliente:

```http
POST https://id.hemia.cloud/api/v1/sso/token
Content-Type: application/json

{
  "clientId": "hemia_console",
  "code": "temporary_code",
  "redirectUri": "https://console.hemia.cloud/auth/callback"
}
```

Respuesta esperada: datos de usuario/sesion para que la app cliente cree su sesion local.

Check session:

```http
GET https://id.hemia.cloud/api/v1/sso/check-session?clientId=hemia_console
Cookie: access_token=...
```

Logout de cliente:

```http
POST https://id.hemia.cloud/api/v1/sso/logout-client
Cookie: access_token=...
Content-Type: application/json

{
  "clientId": "hemia_console"
}
```

Usar este flujo si:

- App es propiedad de Hemia.
- Backend cliente puede intercambiar `code` de forma segura.
- Quieres evitar exponer access tokens OAuth en browser.
- La app cliente tendra su propia cookie/sesion.

No usar este flujo si:

- Cliente es externo o no confiable.
- Necesitas compatibilidad con librerias estandar OIDC.
- Necesitas `id_token`, `userinfo`, discovery o JWKS.

Para esos casos usar OAuth/OIDC.

## Tipo 3: OAuth/OIDC como proveedor de identidad

Usar cuando otra app quiere usar Hemia ID como proveedor OAuth 2.0 / OpenID Connect. Ejemplos:

- Un SaaS externo quiere "Login with Hemia".
- Una mobile app necesita Authorization Code + PKCE.
- Una integracion necesita validar identidad con `id_token`.
- Un servicio necesita access token con `client_credentials`.

Hemia ID actua como proveedor OIDC. La app consumidora es el relying party o cliente OIDC.

### Endpoints OIDC publicos

Discovery:

```txt
GET https://id.hemia.cloud/.well-known/openid-configuration
```

JWKS:

```txt
GET https://id.hemia.cloud/.well-known/jwks.json
```

Authorize:

```txt
GET https://id.hemia.cloud/oauth/authorize
```

Token:

```txt
POST https://id.hemia.cloud/oauth/token
```

Userinfo:

```txt
GET https://id.hemia.cloud/oidc/userinfo
```

### Registrar cliente OAuth/OIDC

Crear un registro en `oauth_clients`.

Cliente publico, recomendado para SPA/mobile con PKCE:

```txt
client_id: public_mobile_app
type: public
client_secret_hash: null
redirect_uris:
  - com.hemia.app:/oauth/callback
grant_types:
  - authorization_code
  - refresh_token
response_types:
  - code
scopes:
  - openid
  - profile
  - email
  - offline_access
status: active
```

Cliente confidencial, recomendado para web server con backend:

```txt
client_id: partner_dashboard
type: confidential
client_secret_hash: <hash del secret>
redirect_uris:
  - https://partner.example.com/auth/callback
grant_types:
  - authorization_code
  - refresh_token
response_types:
  - code
scopes:
  - openid
  - profile
  - email
status: active
```

Cliente backend a backend:

```txt
client_id: billing_worker
type: confidential
client_secret_hash: <hash del secret>
redirect_uris: []
grant_types:
  - client_credentials
response_types: []
scopes:
  - profile
status: active
```

### Authorization Code + PKCE

La app cliente genera:

- `code_verifier`: string secreto aleatorio.
- `code_challenge`: base64url(sha256(code_verifier)).
- `state`: valor aleatorio para prevenir CSRF.
- `nonce`: recomendado cuando se pide `openid`.

Redireccion:

```txt
GET https://id.hemia.cloud/oauth/authorize?client_id=partner_dashboard&redirect_uri=https%3A%2F%2Fpartner.example.com%2Fauth%2Fcallback&response_type=code&scope=openid%20profile%20email&code_challenge=abc&code_challenge_method=S256&state=random_state&nonce=random_nonce
```

Si el usuario no tiene sesion en Hemia ID, el backend redirige a:

```txt
/login?returnTo=<authorize_original>
```

Despues de login, Hemia ID vuelve al authorize y finalmente redirige al cliente:

```txt
https://partner.example.com/auth/callback?code=temporary_code&state=random_state
```

El backend del cliente intercambia el code:

```http
POST https://id.hemia.cloud/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "partner_dashboard",
  "client_secret": "plain_client_secret_if_confidential",
  "code": "temporary_code",
  "redirect_uri": "https://partner.example.com/auth/callback",
  "code_verifier": "original_code_verifier"
}
```

Respuesta tipica:

```json
{
  "access_token": "oauth_access_token",
  "refresh_token": "oauth_refresh_token",
  "id_token": "oidc_id_token_if_scope_openid",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "openid profile email"
}
```

Usar `id_token` para autenticar identidad inicial del usuario en el cliente. Validar:

- Firma con JWKS.
- `iss` igual a `APP_ISSUER`.
- `aud` igual a `client_id`.
- `exp` y `iat`.
- `nonce` si se envio en authorize.

Usar `access_token` para llamar APIs protegidas por OAuth, por ejemplo `userinfo`.

```http
GET https://id.hemia.cloud/oidc/userinfo
Authorization: Bearer oauth_access_token
```

### Refresh token OAuth

El refresh token OAuth pertenece al cliente OAuth, no a la sesion global de Hemia ID.

```http
POST https://id.hemia.cloud/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "partner_dashboard",
  "client_secret": "plain_client_secret_if_confidential",
  "refresh_token": "oauth_refresh_token"
}
```

### Client credentials

Usar para integraciones backend a backend sin usuario final.

```http
POST https://id.hemia.cloud/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "billing_worker",
  "client_secret": "plain_client_secret",
  "scope": "profile"
}
```

Este flujo requiere cliente `confidential`.

### Revocation e introspection

Revocar token:

```http
POST https://id.hemia.cloud/oauth/revoke
Content-Type: application/json

{
  "client_id": "partner_dashboard",
  "client_secret": "plain_client_secret_if_confidential",
  "token": "token_to_revoke"
}
```

Inspeccionar token:

```http
POST https://id.hemia.cloud/oauth/introspect
Content-Type: application/json

{
  "client_id": "access",
  "client_secret": "<secret>",
  "token": "<token-a-validar>"
}
```

## Si alguien quiere usar "mi SSO/OIDC"

Darles estos datos:

```txt
Issuer: https://id.hemia.cloud
Discovery URL: https://id.hemia.cloud/.well-known/openid-configuration
JWKS URL: https://id.hemia.cloud/.well-known/jwks.json
Authorization URL: https://id.hemia.cloud/oauth/authorize
Token URL: https://id.hemia.cloud/oauth/token
Userinfo URL: https://id.hemia.cloud/oidc/userinfo
Scopes recomendados: openid profile email
Response type: code
PKCE: S256
```

Checklist para integrar un cliente externo:

1. Pedir al cliente sus `redirect_uri` exactas.
2. Crear `oauth_clients.client_id`.
3. Elegir `type=public` si no puede guardar secreto; `type=confidential` si tiene backend seguro.
4. Habilitar `authorization_code`; agregar `refresh_token` solo si necesita sesiones largas.
5. Agregar scopes permitidos.
6. Entregar `client_id`; entregar `client_secret` solo a clientes confidenciales.
7. Probar discovery, authorize, token y userinfo.

No entregar:

- `JWT_ACCESS_SECRET`.
- `JWT_REFRESH_SECRET`.
- Secrets internos.
- Cookies Hemia ID.
- Acceso directo a tablas.

## Si Hemia ID debe usar un OIDC externo como login

El codigo actual esta documentado como proveedor OIDC, no como consumidor de un proveedor externo.

Si quieres login con Google, Azure AD, Okta u otro IdP OIDC externo, agregar un modulo nuevo tipo `identity-providers` o `external-auth` que haga:

1. Registrar proveedor externo: issuer, client_id, client_secret, scopes y redirect_uri.
2. Redirigir a authorize del proveedor externo.
3. Recibir callback.
4. Intercambiar code por tokens con el proveedor externo.
5. Validar `id_token` externo contra JWKS externo.
6. Mapear usuario externo a `users` y `memberships`.
7. Crear sesion Hemia ID propia con `/api/v1/auth` internamente.

No mezclar tokens externos con cookies internas. El token externo prueba identidad ante el proveedor externo; la sesion Hemia ID sigue siendo propia.

## Tenants, organizaciones y cuentas

El backend usa modelo multi-tenant logico:

- `tenants` separa clientes/espacios.
- `organizations` cuelga de `tenant_id`.
- `teams` cuelga de `tenant_id` y opcionalmente organizacion.
- `memberships` relaciona usuario con tenant.
- Roles pueden ser globales (`tenant_id IS NULL`) o por tenant.
- Sesiones pueden llevar `tenant_id` para contexto actual.

Para endpoints tenant-aware, el backend usa guards/decorators como:

```txt
JwtAuthGuard + TenantGuard + @CurrentTenant()
```

Patron recomendado:

1. Usuario inicia sesion en Hemia ID.
2. Backend lista cuentas/memberships disponibles.
3. Usuario elige tenant/cuenta.
4. Backend emite access token con contexto de tenant.
5. Endpoints filtran por `tenant_id`.

## Base de datos: una o mas

### Modelo actual: una base de datos compartida

El codigo actual configura una sola conexion TypeORM con:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=hemia
DB_PASSWORD=hemia
DB_DATABASE=hemia_id
```

Este modelo es el recomendado para empezar:

- Una DB PostgreSQL.
- Todas las tablas comparten la misma DB.
- Aislamiento por `tenant_id`.
- Indices unicos incluyen `tenant_id` cuando aplica.
- Migraciones corren una vez sobre esa DB.

Ventajas:

- Operacion simple.
- Menos conexiones.
- Reportes cross-tenant posibles.
- Menor costo.

Cuidados:

- Todo query tenant-aware debe filtrar por `tenant_id`.
- No devolver recursos por `id` sin validar tenant.
- Preferir guards/decorators de tenant en controllers.
- Tests deben cubrir acceso cruzado entre tenants.

### Varias bases de datos

Varias DB no esta implementado en el runtime actual. Solo existe una configuracion `DB_*`.

Si se necesita separar por cliente grande, region o compliance, hay dos rutas:

#### Opcion A: una instancia Hemia ID por DB

Levantar una instancia del backend por base de datos:

```txt
id-us.hemia.cloud -> DB_DATABASE=hemia_id_us
id-eu.hemia.cloud -> DB_DATABASE=hemia_id_eu
id-enterprise-a.hemia.cloud -> DB_DATABASE=hemia_id_enterprise_a
```

Usar cuando:

- Hay pocos tenants grandes.
- Requieres aislamiento fuerte.
- Puedes operar deploys por instancia.

Implicaciones:

- Cada instancia tiene su propio `APP_ISSUER`.
- Cada instancia tiene su propio JWKS.
- Clientes OIDC deben apuntar al issuer correcto.
- Migraciones deben correr por cada DB.
- No hay sesion global entre instancias salvo que se disene aparte.

#### Opcion B: multi-DB dinamico por tenant

Requiere cambios de arquitectura:

- Resolver tenant antes de abrir repositorios.
- Mantener pool de conexiones por tenant.
- Crear `DataSource` dinamico por DB.
- Ejecutar migraciones por tenant/DB.
- Separar seeds por DB.
- Asegurar cache, sesiones y jobs con namespace por tenant.

No activar esto solo cambiando env vars. Requiere diseno y pruebas de aislamiento.

Recomendacion:

- Usar una DB compartida mientras el aislamiento por `tenant_id` sea suficiente.
- Usar instancia por DB para casos enterprise/regionales.
- Evitar multi-DB dinamico hasta que haya necesidad clara.

## Seguridad operativa

- Usar HTTPS en produccion.
- Usar secrets JWT fuertes y distintos por ambiente.
- En `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OAUTH_STATE_SECRET`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` son obligatorios.
- En `NODE_ENV=production`, `APP_CORS_ORIGINS` debe tener origins explicitos; el backend no permite CORS abierto.
- En `NODE_ENV=production`, debe existir una llave activa persistida en `jwks_keys`; el fallback dev en memoria no se usa.
- Rotar llaves JWKS con cuidado; mantener llaves anteriores hasta que expiren tokens emitidos.
- Validar siempre `redirect_uri` contra lista registrada.
- Usar `state` en SSO/OAuth.
- Usar `nonce` cuando se pida `openid`.
- Usar PKCE `S256`; evitar `plain` salvo compatibilidad puntual.
- No permitir wildcards en redirect URIs.
- No registrar origins/redirects de desarrollo en produccion.
- No loggear tokens, codes, passwords ni client secrets.

## Observabilidad

El backend emite logs JSON por stdout/stderr para que el runtime o plataforma los recolecte.

Cada request recibe un `x-request-id`:

- Si el cliente manda `x-request-id`, se reutiliza si mide 128 caracteres o menos.
- Si no existe, el backend genera un UUID.
- La respuesta siempre incluye `x-request-id`.
- Los logs HTTP y errores incluyen `requestId`.

Formato de error global:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "requestId": "uuid",
  "timestamp": "2026-06-05T00:00:00.000Z",
  "path": "/api/v1/example"
}
```

## External APIs para Docs

Usar cuando Hemia Docs o una integracion backend necesita resolver identidad, membresias e invitaciones sin entrar al API admin de Hemia ID.

Autenticacion:

- Usar `Authorization: Bearer <access_token>`.
- El token debe venir de `/oauth/token`.
- Para backend-to-backend, usar `client_credentials`.
- El cliente OAuth debe tener scopes/permisos explicitos:
  - `identity.users.read`
  - `identity.memberships.read`
  - `identity.teams.read`
  - `identity.invitations.write`
  - `identity.events.read`

Endpoints:

```txt
GET  /api/v1/external/users/by-email?email=user@example.com
GET  /api/v1/external/users/by-sub/:sub
GET  /api/v1/external/users/:sub/memberships
GET  /api/v1/external/teams?tenantId=&organizationId=
GET  /api/v1/external/teams/:id?tenantId=
POST /api/v1/external/invitations
POST /api/v1/external/invitations/:id/resend
POST /api/v1/external/invitations/:id/cancel
GET  /api/v1/external/events?tenantId=&type=&after=&limit=
```

Resolver user devuelve profile basico estable:

```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "firstName": "Jane",
  "lastName": "Doe",
  "avatarUrl": null,
  "status": "active",
  "rawStatus": "active"
}
```

`status` externo se normaliza a:

```txt
active | suspended | deleted
```

Invitacion externa:

```http
POST /api/v1/external/invitations
Authorization: Bearer <docs_service_token>
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "tenantId": "tenant_uuid",
  "organizationId": "org_uuid",
  "teamId": "team_uuid",
  "emailContext": {
    "app": "Hemia Docs",
    "actorName": "Cristian",
    "actorEmail": "cristian@example.com",
    "action": "workspace.member_invited",
    "actionLabel": "te invito a colaborar",
    "resourceName": "Workspace de Producto"
  }
}
```

Identity provee automaticamente para el template:

- `inviteeEmail`: correo invitado.
- `tenantId`, `organizationId`, `teamId`: scope de la invitacion.
- `acceptUrl`: liga publica con token para aceptar.
- `expiresAt`: fecha de expiracion formateada.
- `actorLabel`: nombre/correo calculado para mostrar quien invita.

External API debe enviar `emailContext` con:

- `app`: sistema origen mostrado en el correo, por ejemplo `Hemia Docs`.
- `actorName`: persona, servicio o sistema que origina la accion.
- `actorEmail`: opcional, correo del actor si existe.
- `action`: codigo estable para auditoria/plantillas, por ejemplo `workspace.member_invited`.
- `actionLabel`: texto humano de accion, por ejemplo `te invito a colaborar`.
- `resourceName`: nombre visible del recurso, por ejemplo el workspace.

La aceptacion de invitacion es publica porque normalmente llega desde email/callback:

```txt
POST /api/v1/invitations/accept
```

Eventos disponibles para polling/audit sink:

```txt
user.created
user.updated
user.suspended
user.deleted
invitation.accepted
team.member.added
team.member.removed
org.member.added
org.member.removed
```

## Comandos

```bash
bun --cwd backend build
bun --cwd backend test
bun --cwd backend test:e2e
bun --cwd backend migration:run
bun --cwd backend seed:run
bun --cwd backend start:prod
```

## Seeds

El seed inicial crea permisos, roles de sistema y un usuario `SUPER_ADMIN` global.
Tambien asegura una llave JWKS activa si no existe una en `jwks_keys`.

`SUPER_ADMIN_PASSWORD` es obligatorio. No tiene default para evitar crear un admin con password conocida.

Variables disponibles:

```env
SUPER_ADMIN_EMAIL=admin@hemia.cloud
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_FIRST_NAME=Hemia
SUPER_ADMIN_LAST_NAME=Admin
SUPER_ADMIN_PASSWORD=change_me_strong_password

JWKS_KEY_KID=local-dev-rs256
JWKS_PRIVATE_KEY_PATH=./secrets/jwks-private.pem
```

Ejecutar en local:

```bash
SUPER_ADMIN_PASSWORD='change_me_strong_password' bun --cwd backend seed:run
```

Ejecutar con datos completos:

```bash
SUPER_ADMIN_EMAIL='admin@hemia.cloud' \
SUPER_ADMIN_USERNAME='superadmin' \
SUPER_ADMIN_FIRST_NAME='Hemia' \
SUPER_ADMIN_LAST_NAME='Admin' \
SUPER_ADMIN_PASSWORD='change_me_strong_password' \
JWKS_KEY_KID='prod-rs256-2026-01' \
JWKS_PRIVATE_KEY_PATH='./secrets/jwks-private.pem' \
bun --cwd backend seed:run
```

El seed es idempotente: si el email ya existe y no esta borrado, actualiza username, nombre, password y status a `active`, y asegura el rol `SUPER_ADMIN`.
Para JWKS, deriva `public_key` desde `JWKS_PRIVATE_KEY_PATH` o `JWKS_PRIVATE_KEY`. Si ya existe una llave activa con el mismo `kid` y private key, no crea otra. Si `JWKS_KEY_KID` cambia, rota la llave activa anterior e inserta la nueva como `active`.
