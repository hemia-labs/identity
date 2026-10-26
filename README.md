# Hemia ID
Proveedor central de identidad para el ecosistema Hemia: autenticacion, sesiones, OAuth2/OIDC, JWKS, usuarios y cuentas.

Hemia ID ya no administra tenants, organizations, memberships, roles, permisos ni invitaciones. Ese dominio vive en [Hemia Access](../access/README.md), segun el [Plan de Migracion Identity + Access](../docs/migracion/plan-migracion-identity-access.md) y el [ADR](../docs/ADR/documentoADR.md).

## Resumen

Este repositorio contiene los servicios de Hemia ID:

- `backend`: API NestJS para login, sesiones, OAuth2/OIDC, Google login, token exchange, JWKS y administracion de usuarios/OAuth clients.
- `frontend`: interfaz web para login, consentimiento, sesion y perfil basico.
- `packages/auth`: SDK `@hemia/auth` v1 para consumidores OAuth/OIDC + contexto de Access.

## Separacion Identity / Access

- Identity autentica y emite tokens sin claims organizacionales (`tenant_id`, roles, permissions u organization).
- Access autoriza: organizations, memberships, roles globales, permisos globales, invitaciones, productos y context tokens.
- Los productos resuelven `iss + sub` contra Access mediante `@hemia/auth` y `AccessClient`.
- No existe capa legacy: sin `legacy_tenant_mapping`, claims de transicion ni endpoints puente.

## Corte por ambiente

El corte es big bang por ambiente. No hay migracion de datos: las bases nuevas se crean vacias y se recrean con seeds.

```bash
# 1) Identity
cd identity/backend
bun run migration:run
bun run seed:run

# 2) Access, despues de obtener el user_id admin sembrado en Identity
cd ../../access/apps/api
bun run migration:run
bun run seed:run
```

Reglas:

- `synchronize: true` y `migrationsRun: true` estan prohibidos.
- Migraciones y seeds se ejecutan manualmente, nunca en el arranque.
- `/health/ready` queda not ready con `pending_migrations` hasta aplicar migraciones pendientes.
- Las sesiones y refresh tokens anteriores al corte quedan invalidados; los usuarios vuelven a iniciar sesion.

## Consumir Identity (OAuth2 / OIDC)

Hemia ID es un proveedor OAuth2 + OpenID Connect. Un cliente se integra con el
flujo **Authorization Code + PKCE** (PKCE es obligatorio para todos los clientes).

- **Issuer:** `https://api-id.hemia.cloud`
- **Discovery:** `GET /.well-known/openid-configuration` (de ahí salen todos los endpoints)
- **JWKS (validar tokens):** `GET /.well-known/jwks.json` (RS256)

### 1. Registro previo del cliente

Antes de integrarse, el cliente debe estar dado de alta en Hemia ID. Datos que necesita:

| Dato | Descripción |
|---|---|
| `client_id` | Identificador del cliente (case-insensitive). |
| `type` | `public` (SPA/móvil, solo PKCE) o `confidential` (backend, PKCE + `client_secret`). |
| `client_secret` | Solo clientes `confidential`. Se entrega una vez. |
| `redirect_uris` | Lista exacta de URIs de retorno permitidas. |
| `grant_types` | `authorization_code`, `refresh_token`, `client_credentials`. |
| `scopes` | Subconjunto de `openid profile email offline_access`. |
| `audience` | Audiencia (`aud`) que llevará el access token. |

### 2. Endpoints

| Función | Endpoint |
|---|---|
| Authorize | `GET /oauth/authorize` |
| Token | `POST /oauth/token` |
| UserInfo | `GET /oidc/userinfo` (Bearer access token) |
| Introspection | `POST /oauth/introspect` |
| Revocation | `POST /oauth/revoke` |
| Logout / End session | `POST /oauth/logout` |

### 3. Flujo Authorization Code + PKCE

1. El cliente genera `code_verifier` y `code_challenge = BASE64URL(SHA256(verifier))`.
2. Redirige al usuario a:
   ```
   GET /oauth/authorize?
     response_type=code&
     client_id=mi-cliente&
     redirect_uri=https://app.cliente.com/callback&
     scope=openid profile email offline_access&
     code_challenge=<challenge>&
     code_challenge_method=S256&
     state=<aleatorio>&
     nonce=<aleatorio>
   ```
   Si el usuario no tiene sesión, Hemia ID lo manda al login y vuelve aquí.
3. Hemia ID redirige a `redirect_uri?code=<code>&state=<state>`.
4. El cliente intercambia el código (clientes `confidential` añaden `client_secret`):
   ```
   POST /oauth/token   (application/x-www-form-urlencoded o JSON)
     grant_type=authorization_code
     client_id=mi-cliente
     code=<code>
     redirect_uri=https://app.cliente.com/callback
     code_verifier=<verifier>
     client_secret=<secret>        # solo confidential
   ```
   Respuesta:
   ```json
   {
     "access_token": "<JWT RS256>",
     "token_type": "Bearer",
     "expires_in": 900,
     "refresh_token": "<opaco>",
     "id_token": "<JWT>",          // si se pidió scope openid
     "scope": "openid profile email offline_access"
   }
   ```

### 4. Usar y refrescar

- Llamar APIs / `GET /oidc/userinfo` con `Authorization: Bearer <access_token>`.
- Validar el access token contra el `jwks_uri`, verificando `iss`, `aud` y `exp`.
- Refrescar (rotación con detección de reuso):
  ```
  POST /oauth/token
    grant_type=refresh_token
    client_id=mi-cliente
    refresh_token=<refresh_token>
    client_secret=<secret>        # solo confidential
  ```

### 5. Resumen: qué necesita el cliente

- **Para registrarse:** `client_id`, `redirect_uris`, `grant_types`, `scopes`, `type` (+ `client_secret` si es confidential).
- **En cada login:** generar PKCE (`code_verifier`/`code_challenge`) y `state`/`nonce`.
- **Para validar tokens:** el `issuer`, el `jwks_uri` y su `aud`.

> Servicio-a-servicio (sin usuario): usar `grant_type=client_credentials` con un cliente `confidential` (`client_id` + `client_secret` + `scope`). Para Access en nombre de un usuario, usar token exchange hacia `aud=access-api`.

## Documentacion

La documentacion central esta en [Obsidian: Identity](../../../obsidian-hemia-kb/11-reviews/pending/identity/README.md).
El expediente incluye CI/CD, despliegue, entorno, registry, OAuth y contratos.
Las notas de cada release se generan desde los changelogs versionados de backend y frontend.

## Pruebas y organización

Todas las pruebas están centralizadas en [`test/`](test/README.md). Ejecutar `bun run test` desde esta raíz; las comprobaciones del artefacto del SDK usan `bun run test:package` y `bun run test:tarball`.

## Fuente del SDK y paquetes publicados

`packages/auth` conserva la fuente, pruebas y flujo de publicación de `@hemia/auth`. Su entrada workspace en el lockfile corresponde a esa autoría; backend y frontend de Identity no dependen del SDK ni lo importan localmente. Las aplicaciones consumidoras instalan la versión publicada `@hemia/auth@1.0.8` desde npm, sin dependencias `file:`, `link:`, tarballs de vendor ni imports de `packages/auth`. Los cambios pendientes de una próxima versión del SDK se prueban aquí y no se consideran disponibles en los consumidores hasta su publicación.
