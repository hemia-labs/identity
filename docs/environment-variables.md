# Ejemplos de variables de entorno de Identity

Estos bloques son ejemplos publicos sin credenciales reales. Los archivos
`.env.local`, `.env.production` y `.env.bootstrap` son privados e ignorados por
Git. No copiar el archivo de produccion existente sobre estos ejemplos ni
reemplazarlo si ya contiene credenciales. No se generan archivos `.env` en CI.

## Produccion

Referencia para `backend/.env.production` local o
`/opt/hemia/identity/shared/production.env` en apps/VPS. Completar los valores
vacios y confirmar el dominio y destino PostgreSQL. Compose usa `format: raw`:
los valores son literales, sin comillas envolventes y en una sola linea.

```dotenv
# Compose env_file format: raw. Values are literal: do not wrap them in quotes.

# Production configuration. Confirm public domains and fill the empty required values before deploying.
NODE_ENV=production
PORT=4000
APP_CORS_ORIGINS=https://id.hemia.cloud,https://console.hemia.cloud,https://legal.hemia.cloud,https://billing.hemia.cloud,https://access.hemia.cloud,https://docs.hemia.cloud,https://helpdesk.hemia.cloud
APP_ISSUER=https://id.hemia.cloud
ID_FRONTEND_URL=https://id.hemia.cloud
AUTH_ALLOWED_REDIRECT_URIS=https://id.hemia.cloud/auth/callback

# External PostgreSQL. Dedicated production database/user must be provisioned; never target identity_feature implicitly.
DB_HOST=192.168.100.103
DB_PORT=5432
DB_USERNAME=identity
DB_PASSWORD=
DB_DATABASE=hemia_id
DB_SSL=true
DB_LOGGING=false
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=3000

# Access URLs must be reachable from the backend. JWKS URI is required by startup validation, currently not consumed for JWKS lookup.
ACCESS_API_URL=https://access.hemia.cloud
ACCESS_JWKS_URI=https://access.hemia.cloud/.well-known/jwks.json
ACCESS_AUDIENCE=access-api

# Independent production secrets; never reuse the development defaults. JWT_REFRESH_SECRET remains required by startup validation.
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
OAUTH_STATE_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Optional SMTP: leave all three values empty or omit them to disable email delivery.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_APP=Hemia ID


# Same-origin HTTPS cookies.
COOKIE_DOMAIN=
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
COOKIE_ACCESS_TOKEN_MAX_AGE_SECONDS=900
COOKIE_REFRESH_TOKEN_MAX_AGE_SECONDS=604800
```

Google esta deshabilitado por omision. Para habilitarlo, configurar juntos
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y el callback HTTPS registrado en
Google. El backend puede arrancar sin esas credenciales; sus rutas Google
responden 503 mientras no esten configuradas.

`ACCESS_JWKS_URI` y `JWT_REFRESH_SECRET` siguen exigidos por la validacion de
arranque actual. Las credenciales de seeds no van en el archivo de runtime.

## Configuracion de Compose

Opcional: copiar este bloque en `.env` en la raiz de Identity, solo si se
necesita cambiar el bind, puerto o imagenes. No contiene secretos de aplicacion.
Sin este archivo, Compose usa sus valores predeterminados (bind en loopback).

```dotenv
# Proxmox apps: gateway reaches the frontend over the LAN.
IDENTITY_BIND_ADDRESS=192.168.100.102
IDENTITY_HTTP_PORT=8080
IDENTITY_IMAGE_TAG=local
IDENTITY_ENV_FILE=./backend/.env.production

# Single VPS with Nginx on the host: use IDENTITY_BIND_ADDRESS=127.0.0.1.
```

En Proxmox, el bind privado permite que gateway llegue a apps. En un VPS con
Nginx en el host, usar `IDENTITY_BIND_ADDRESS=127.0.0.1`. `IDENTITY_ENV_FILE` se
resuelve desde la ubicacion del archivo Compose.

## Bootstrap manual de una base nueva

Copiar este bloque en `backend/.env.bootstrap`, completar secretos y protegerlo
con `chmod 600`. Solo se inyecta al comando explicito de seed; no al arranque.
Los clientes nuevos necesitan sus secretos en produccion. Reejecutar el seed
no rota los hashes existentes.

```dotenv
# Initial seed only: fill for a NEW database, run the seed, then remove these
# variables before starting the application. Existing hashes are not rotated.
SUPER_ADMIN_EMAIL=admin@hemia.cloud
SUPER_ADMIN_PASSWORD=
OAUTH_CLIENT_SECRET_CONSOLE_IDENTITY_ADMIN=
OAUTH_CLIENT_SECRET_CONSOLE_ACCESS_ADMIN=
OAUTH_CLIENT_SECRET_BILLING_LEGAL_SERVICE=
OAUTH_CLIENT_SECRET_ACCESS_LEGAL_VALIDATOR=
OAUTH_CLIENT_SECRET_BALANZ_BILLING_SERVICE=
OAUTH_CLIENT_SECRET_LEGAL_SERVICE_DEV=
OAUTH_CLIENT_SECRET_LEGAL=
OAUTH_CLIENT_SECRET_CONSOLE=
OAUTH_CLIENT_SECRET_BILLING=
OAUTH_CLIENT_SECRET_DOCS=
OAUTH_CLIENT_SECRET_ACCESS=
OAUTH_CLIENT_SECRET_HELPDESK=
```

Con la configuracion de runtime ya disponible:

```bash
docker compose run --rm --no-deps --env-from-file backend/.env.bootstrap backend \
  node dist/src/database/seeds/run-seeds.js
```

El seed crea la clave JWKS activa en PostgreSQL si falta. `JWKS_KEY_KID` y
`JWKS_PRIVATE_KEY` son opciones exclusivas de ese paso. `JWKS_PRIVATE_KEY_PATH`
no se usa en el codigo actual. Migraciones y seeds nunca se ejecutan al arrancar.

## Desarrollo local

Referencia para un nuevo `backend/.env.local`; no reemplazar el archivo local
existente. Reemplazar los placeholders antes de iniciar: los tres secretos JWT/state
requieren al menos 32 caracteres y deben ser independientes. Ajustar la contraseña
local de PostgreSQL y el frontend para usar el puerto elegido. No se requiere Redis.

```dotenv
NODE_ENV=development
PORT=3000
# Optional explicit interface; local supervised profile uses ::1.
APP_BIND_HOST=
APP_CORS_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:5176,http://localhost:5178,http://localhost:5180,http://localhost:3019
APP_ISSUER=https://id.hemia.cloud
ID_FRONTEND_URL=http://localhost:5173
AUTH_ALLOWED_REDIRECT_URIS=http://localhost:5173/auth/callback

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=hemia
DB_PASSWORD=<db-password>
DB_DATABASE=hemia_id
DB_SSL=false
DB_LOGGING=false
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=3000


SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM_APP=Hemia ID

ACCESS_API_URL=http://localhost:3019
ACCESS_JWKS_URI=http://localhost:3019/.well-known/jwks.json
ACCESS_AUDIENCE=access-api

JWT_ACCESS_SECRET=<jwt-access-secret>
JWT_REFRESH_SECRET=<jwt-refresh-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OAUTH_STATE_SECRET=<oauth-state-secret>


COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_ACCESS_TOKEN_MAX_AGE_SECONDS=900
COOKIE_REFRESH_TOKEN_MAX_AGE_SECONDS=2592000
```

La configuracion y validacion reales estan en `backend/src/config/`. Para el
flujo de releases y provisioning consultar [CI/CD](identity-ci-cd.md) y
[Docker](docker-deployment.md).

## SMTP opcional

Identity puede arrancar en produccion sin `SMTP_HOST`, `SMTP_USER` ni `SMTP_PASS`.
Omitir las tres o dejarlas vacias desactiva el cliente de correo; no se abren
conexiones SMTP. Si se habilita, configurar las tres juntas. Un intento de envio
sin configuracion devuelve `503 EMAIL_NOT_CONFIGURED`. El login y OAuth/OIDC no
dependen de SMTP actualmente.
