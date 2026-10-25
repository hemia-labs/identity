# Identity en Docker: Proxmox y VPS

Solo despliega Identity: backend NestJS y frontend Vue compilado servido por
Nginx. PostgreSQL, Access y cloudflared son servicios externos. No requiere Redis
para los modulos actuales de Identity. Las mismas imagenes funcionan en Proxmox
y VPS; las direcciones y secretos quedan fuera de las imagenes.

## Estructura actual de Proxmox

Inventario verificado el 24 de octubre de 2026:

```text
Cloudflare
  -> cloudflared en gateway (LXC 120, 192.168.100.104)
    -> apps (VM 100, 192.168.100.102:8080)
      -> frontend Nginx :8080
        -> backend :4000 (solo red Docker)
          -> PostgreSQL (VM 110, 192.168.100.103:5432)
```

El gateway conserva cloudflared y su Nginx existente. Para Identity, la ruta del
tunel puede apuntar directamente a `http://192.168.100.102:8080`. No hace falta
otro cloudflared ni configurar las rutas internas de la API en el gateway.
El tunel inspeccionado solo tenia una regla final `http_status:404`; hay que
agregar el hostname de Identity en su configuracion administrada en Cloudflare.

El ejemplo usa `id.hemia.cloud`. Antes del primer despliegue, confirmar el dominio
canonico con los consumidores existentes: el README anterior menciona
`api-id.hemia.cloud`. Conservar el issuer establecido al mover el servicio de
maquina; cambiarlo afecta a los clientes y a la validacion de tokens.

## Configuracion

Ejecutar desde la raiz `identity/`:

Crear solo los archivos que falten usando los bloques de
[ejemplos de entorno](environment-variables.md): `.env` para Compose (opcional)
y `backend/.env.production` para el backend. No sobrescribir credenciales
existentes. Proteger ambos archivos con `chmod 600`.

`.env` configura Compose (bind, puerto, etiqueta y ruta del archivo de entorno).
`backend/.env.production` configura el backend. Ambos estan ignorados por Git y
excluidos del contexto Docker. Los ejemplos del Markdown no contienen credenciales reales.

Completar antes del arranque:

- `DB_HOST`, usuario, password y base de datos dedicada. En Proxmox el host es
  `192.168.100.103`; `hemia_id` y el usuario `identity` son ejemplos, no recursos
  creados por Compose. No reutilizar `identity_feature` sin decidirlo expresamente.
- Tres secretos independientes para JWT y OAuth state (`openssl rand -hex 32`).
- SMTP es opcional: omitir host, usuario y password si no se enviaran correos.
  Google OAuth tambien es opcional;
  sin `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` no se registra la estrategia
  y sus rutas responden 503. Para habilitarlo configurar ambos valores reales.
- URLs de Access: `https://access.hemia.cloud` y
  `https://access.hemia.cloud/.well-known/jwks.json`. Configurar ese dominio para
  apuntar al despliegue real de Access, que es independiente de este Compose.
- Issuer, frontend y CORS con HTTPS y el dominio publico real. Si se habilita
  Google, registrar tambien su callback HTTPS. Mantener `COOKIE_SECURE=true`.
- Al inicializar una base nueva, password del administrador y secretos de los
  clientes OAuth indicados en la seccion bootstrap de `docs/environment-variables.md`. El seed requiere
  secretos de clientes nuevos. Guardarlos por un canal seguro para los consumidores
  y preparar el bootstrap por separado; no van en el archivo de runtime.

La VM database ya permite conexiones TCP desde apps a PostgreSQL y tiene SSL
habilitado. Esto no valida usuario, password ni privilegios. El usuario de
migraciones necesita permisos DDL sobre el esquema. `DB_SSL=true` cifra la
conexion, pero la implementacion actual usa `rejectUnauthorized:false`: no
verifica la identidad del servidor. Para una base en otro VPS, usar una red
privada/VPN o configurar validacion de CA antes de atravesar una red no confiable.

## Construir y preparar la base

```bash
docker compose build

# Accion manual sobre la base configurada: revisar destino y backup primero.
docker compose run --rm --no-deps backend \
  node node_modules/typeorm/cli.js migration:run -d dist/data-source.js

# Inicializacion explicita de una base nueva; no ejecutar en cada arranque.
# Crear backend/.env.bootstrap desde docs/environment-variables.md y completarlo.
chmod 600 backend/.env.bootstrap
# Completar backend/.env.bootstrap. Requiere Compose con --env-from-file.
docker compose run --rm --no-deps --env-from-file backend/.env.bootstrap backend \
  node dist/src/database/seeds/run-seeds.js

docker compose up -d --wait
docker compose ps
```

El seed crea la clave activa JWKS en PostgreSQL si falta; no necesita un archivo
PEM montado. Respaldar esa base y sus claves. No activar `synchronize` ni
`migrationsRun`. El backend arranca sin aplicar migraciones y responde 503 con
`pending_migrations` en `/api/v1/health/ready` hasta aplicarlas manualmente.
El frontend espera que el backend este healthy. Docker marca unhealthy pero no
reinicia automaticamente un proceso vivo por ese estado; `restart` cubre salidas.

Los builds usan Bun 1.3.14, `bun.lock` congelado e instalaciones separadas para
build y produccion. Solo el resultado compilado y dependencias de produccion
llegan al backend final; no incluye Bun ni compiladores. El build frontend usa
`build-only`; ejecutar el type-check del frontend por separado en CI.
Las versiones base estan fijadas por serie, no por digest: reconstruir recoge
actualizaciones de esa serie. Para promover exactamente un artefacto ya probado,
publicarlo en un registro y desplegarlo por digest.

## Entrada desde gateway

En `.env` de apps:

```dotenv
IDENTITY_BIND_ADDRESS=192.168.100.102
IDENTITY_HTTP_PORT=8080
```

Publicar el hostname elegido en el tunel con servicio
`http://192.168.100.102:8080`. Permitir el puerto desde `192.168.100.104` y los
consumidores privados autorizados; no abrirlo a toda la LAN/Internet. El bind
por si solo no restringe origen. Validar reglas Proxmox o `DOCKER-USER`/forwarding:
los puertos publicados por Docker pueden evitar reglas UFW de INPUT.

Nginx de Identity sirve la SPA y reenvia `/api/v1/`, `/oauth/`, `/oidc/` y
`/.well-known/` sin cambiar sus rutas. Conserva `X-Forwarded-Proto` del proxy
anterior. Cloudflare debe evitar cachear API, OAuth, OIDC y respuestas personales;
no usar una regla global de cache para el sitio. `/healthz` solo verifica Nginx;
usar `/api/v1/health/ready` para la disponibilidad real del backend y base.

El backend actual no habilita Express `trust proxy`; sus registros basados en
`request.ip` pueden mostrar el proxy. No tratar esa IP como una identidad de
cliente. La confianza y normalizacion de IPs requiere una configuracion explicita
si se introduce control de acceso o limitacion por IP.

## Mover a un VPS con Nginx en el host

Conservar imagenes, secretos, issuer y datos. Cambiar en `.env`:

```dotenv
IDENTITY_BIND_ADDRESS=127.0.0.1
IDENTITY_HTTP_PORT=8080
```

En el virtual host HTTPS existente del VPS, dentro de `server`:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Este ejemplo asume que Nginx del host termina HTTPS. Si recibe HTTP desde
cloudflared, preservar el protocolo publico desde ese proxy de confianza en vez
de sustituirlo por `$scheme`. Los certificados y el tunel los administra el host;
el contenedor sigue sirviendo HTTP privado. Si Nginx del VPS tambien esta en
Docker, conectarlo a una red compartida y usar el servicio frontend, porque
`127.0.0.1` dentro de ese Nginx seria su propio contenedor.

Cambiar `DB_HOST` por la direccion privada del VPS de base de datos y autorizar
la nueva IP de apps en firewall y `pg_hba.conf`. No publicar PostgreSQL para todo
Internet. Si PostgreSQL esta en el mismo host, el backend dispone del alias
`host.docker.internal`; configurar PostgreSQL y su firewall para aceptar solo la
red Docker necesaria. `localhost` dentro del backend apunta al contenedor.

Al migrar datos, hacer backup/restauracion y coordinar el corte del escritor;
Compose no mueve la base automaticamente. No ejecutar seeds como sustituto de
restaurar usuarios, clientes, sesiones y claves. Una base restaurada conserva
secretos y JWKS. Construir las imagenes para la arquitectura del destino
(`linux/amd64` en el Proxmox verificado); una imagen arm64 local no se debe copiar
a amd64 sin reconstruir o publicar una imagen multiarquitectura.

## Recursos y verificacion

| Servicio | Limite RAM | Limite CPU |
| --- | --- | --- |
| Backend | 512 MiB | 1 CPU |
| Frontend Nginx | 64 MiB | 0.25 CPU |

Son techos iniciales, no memoria reservada ni consumos garantizados. El heap JS
se limita a 256 MiB para dejar margen a memoria nativa, buffers y Argon2; ese
limite no limita la memoria nativa. Medir autenticaciones concurrentes antes de
reducirlo. No rebajar el coste de Argon2 para ahorrar memoria. Los builds no
estan sujetos a estos limites: compilar en CI u otra maquina evita sus picos.
Cada servicio rota logs (3 archivos de 10 MB), corre sin root, sin capacidades
adicionales y con sistema de archivos de solo lectura y `/tmp` temporal limitado.

```bash
docker compose stats --no-stream
curl --fail http://192.168.100.102:8080/api/v1/health/ready

# Prueba aislada local: imagenes ya construidas, PostgreSQL temporal y limpieza.
# No lee backend/.env.production ni toca la VM database. Requiere Python 3 y Docker.
python3 test/docker/smoke.py
```

La prueba comprueba que el arranque no aplica migraciones, ejecuta migraciones y
seeds manuales, verifica readiness, rutas SPA/OAuth/OIDC/JWKS y login con cookies
Secure/HttpOnly. Elimina sus propios
contenedores y volumenes al terminar. No cubre Google, correo ni integracion con
Access reales. Para futuras apps en la misma VM se pueden usar redes Docker
compartidas de forma explicita; este Compose no expone el puerto del backend.
