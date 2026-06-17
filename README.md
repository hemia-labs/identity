# identity
Sistema centralizado de identidad, autenticacion, autorizacion, sesiones, tenants y permisos para el ecosistema de Hemia.

## Resumen

Este repositorio contiene los servicios de Hemia ID:

- `backend`: API NestJS para login, sesiones, SSO interno, OAuth/OIDC, Google login, tenants, roles y permisos.
- `frontend`: interfaz web para consumir y administrar la identidad central.
- `auth-gateway`: referencia funcional previa para autenticacion con Google.

## Consumir el SSO (OAuth2 / OIDC)

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

> Servicio-a-servicio (sin usuario): usar `grant_type=client_credentials` con un cliente `confidential` (`client_id` + `client_secret` + `scope`).

## Documentacion

- [Backend README](./backend/README.md)
