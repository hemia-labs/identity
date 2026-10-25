# CI/CD de Identity: tags, Releases, Tailscale y rollback

## Alcance y flujo

Solo Identity; Access queda fuera. Changesets mantiene dos flujos independientes:
el SDK `@hemia/auth` en `develop` y la aplicacion Identity en `main`.

1. La PR funcional incluye un changeset para `backend` o `frontend` (`bun run
   changeset`, impacto patch/minor/major). Backend y frontend comparten version
   mediante un grupo fijo. Usar notas separadas para la aplicacion y el SDK;
   nunca mezclar ambos destinos en el mismo archivo changeset.
2. Al fusionar a `main`, `identity-release.yml` crea o actualiza una PR automatica
   `chore(identity): release application version`. Agrupa los changesets pendientes,
   actualiza ambas versiones, ambos changelogs y `bun.lock`. No despliega aun.
3. Al fusionar esa PR de version a `main`, se ejecuta CI completo y se conservan
   las imagenes probadas. Si pasa, se genera automaticamente el tag
   `identity-vMAJOR.MINOR.PATCH`, se publican las imagenes en el registry privado y la Release inmutable
   con sus assets. No hay que crear ni empujar tags manualmente.
4. Tras publicar, un job con environment `prod` lee `ENABLE_IDENTITY_DEPLOY`.
   Si vale exactamente `true`, solicita `Identity deployment` desde `main` con
   operacion `deploy` y ese tag. El resultado aparece en otra ejecucion de Actions.
5. `Identity deployment` conserva `deploy`, `rollback` y `migrate` manuales.
   Solo ese workflow se conecta por Tailscale y SSH.

La PR de version requiere un merge adicional: un merge funcional acumula cambios;
el merge de version publica. El changeset inicial solicita `1.0.0`. Los tags y
los digests publicados se conservan; no mover tags ni usar `latest` para desplegar.
Los builds actuales son amd64, igual que apps; un VPS ARM requiere imagenes ARM.

## Estado remoto verificado: 24 de octubre de 2026

| Componente | Observacion |
| --- | --- |
| GitHub | `hemia-labs/identity` privado, default branch `main`, Actions habilitado |
| Environments | Se conservan `npm` para el SDK y `prod` para Identity |
| Secrets de repositorio/organizacion | Ninguno en las consultas realizadas |
| Secrets de `prod` | `DEPLOY_SSH_KNOWN_HOSTS`, `DEPLOY_SSH_PRIVATE_KEY` presentes en la ultima auditoria |
| Variables | Repositorio: `ENABLE_NPM_PUBLISH`. En `prod`: las cinco variables de destino/habilitacion y `TS_CLIENT_ID`/`TS_AUDIENCE` configuradas |
| Protecciones | `prod` no tiene reglas de aprobacion/restriccion de rama; branch protection/rulesets devuelve 403 indicando upgrade de plan o hacer publico el repo |
| Releases | No hay Releases existentes; inmutabilidad desactivada |
| Proxmox | Tailscale activo, IP `100.103.216.101`, ruta activa anunciada `192.168.100.0/24` |
| Apps | `192.168.100.102`, Docker/Compose y Python disponibles; sin Tailscale propio |
| Usuario de despliegue | `identity-deploy` creado en apps y agregado a Docker; SSH y acceso a Docker verificados |
| Directorio | `/opt/hemia/identity` y `shared/` creados, propiedad de `identity-deploy`, modo 700 |
| Tailscale OIDC | Identidad compartida `Hemia GitHub CI - prod` creada y politica guardada para `tag:hemia-ci` solo hacia apps TCP 22 |

Los secretos de `prod` se consultaron solo por nombre. GitHub no entrega sus valores.
Posteriormente, a peticion del usuario, se creo `identity-deploy` en apps, se
autorizo una clave SSH dedicada con `restrict` y se verifico el acceso a Docker.
Aprobado por el usuario, tambien se guardo la politica Tailscale y se creo la
identidad OIDC compartida. No se publicaron Releases ni tags. La credencial local permite consultar GitHub; el conector
GitHub de la sesion devuelve 404 para este repositorio privado.

## Configurar GitHub

Usar el environment existente **`prod`** en Settings > Environments. El workflow
usa ese nombre exacto y el SDK conserva `npm`. No hace falta crear otro environment.
El merge de una PR funcional prepara version; solo el merge de la PR de version publica.

Variables del environment `prod`:

| Variable | Valor inicial |
| --- | --- |
| `ENABLE_IDENTITY_DEPLOY` | `true` habilita despliegues y solicita deploy automatico tras publicar cada Release; mantener `false` hasta preparar host, env, registro y ruta publica |
| `DEPLOY_HOST` | `192.168.100.102` |
| `DEPLOY_USER` | `identity-deploy` (usuario dedicado a crear) |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_PATH` | `/opt/hemia/identity` |
| `TS_CLIENT_ID` | Client ID de la nueva identidad federada OIDC de Tailscale |
| `TS_AUDIENCE` | Audience exacto configurado/mostrado para esa identidad federada |

Secrets del mismo environment:

| Secret | Contenido |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Clave privada OpenSSH dedicada al usuario `identity-deploy` |
| `DEPLOY_SSH_KNOWN_HOSTS` | Entrada `known_hosts` de apps, verificada por un canal confiable |

No se necesita `BACKEND_ENV`, token Cloudflare ni secreto OAuth Tailscale en este
workflow. `GITHUB_TOKEN` lo proporciona GitHub: crea la Release con
permisos limitados al job de publicacion. El job de despliegue solo lee contenido y
solicita OIDC. El job que solicita deploy automatico tiene unicamente
`actions: write` para despachar el workflow; no solicita OIDC ni usa secretos SSH.
Los secretos de aplicacion permanecen en el servidor.

En Settings > Actions > General, permitir que GitHub Actions cree pull requests.
Para que las PR automaticas disparen CI sin intervencion, configurar a nivel
**repositorio** `RELEASE_APP_CLIENT_ID` (variable) y `RELEASE_APP_PRIVATE_KEY`
(secret) de una GitHub App instalada en `identity`, con Contents y Pull requests
Read & write. Son los mismos nombres que usa el flujo del SDK. El job que abre
la PR no usa `prod`; configurar estos valores solo en `prod` no sirve.
Sin App se usa `GITHUB_TOKEN`, pero GitHub no dispara los workflows de PR por
esos cambios: revisar y disparar los checks manualmente antes del merge.
[Referencia de GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Activar **release immutability** en Settings > General > Releases. El workflow
crea la Release como draft, sube todos los assets y despues publica: permite
adjuntar assets antes de que queden bloqueados. No reconstruir una version ya
publicada; el publicador y el despliegue exigen que GitHub reporte `immutable=true`.
Habilitarlo antes de fusionar la primera PR de version; las releases creadas previamente sin esa opcion
no se aceptan para despliegue. Un reintento detecta la Release existente y falla. Un draft incompleto
requiere inspeccion y recuperacion manual antes de repetir, sin mover el tag.

Configurar protecciones para `main` y tags `identity-v*` si el plan lo permite;
exigir el check `Identity CI / identity`. Usar aprobacion de environment cuando
este disponible. GitHub limita estas funciones segun plan/visibilidad: la consulta
actual ya reporta una restriccion de plan, asi que no asumir que quedaron activas.
El despliegue sigue corriendo desde `main`, tanto si es manual como si lo solicita
la publicacion de la Release, exige un tag contenido en `main` y valida el commit
del manifiesto. Si se configuran restricciones de ramas/tags en `prod`, permitir
`main` para ambos jobs; las
aprobaciones del environment se siguen respetando y pueden requerirse en ambos.
Esto no sustituye las
protecciones administrativas frente a alguien con permisos para modificar CI.

## Publicar el SDK

El SDK `@hemia/auth` se publica por separado desde `develop` con
`auth-release.yml`; la aplicación Identity usa `main` y su propio flujo. Cada PR
que cambie `packages/auth` debe incluir un changeset. Al fusionarse a `develop`,
Changesets abre o actualiza la PR de versión. Revisar y fusionar esa PR para
ejecutar `package-auth.yml`, construir y validar el tarball y publicar ese mismo
artefacto. El workflow comprueba su SHA-512 y el estado de la versión en npm; no
reconstruye ni sobrescribe contenido distinto para una versión publicada.

Antes de habilitar la publicación, permitir PR creadas por Actions, exigir
revisión y el check `Auth package` en `develop`, crear el environment `npm` y
configurar npm Trusted Publishing para `@hemia/auth` con organización
`hemia-labs`, repositorio `identity`, workflow `auth-release.yml` y permiso
directo de `npm publish`. Después fijar `ENABLE_NPM_PUBLISH=true` como variable
del repositorio. No se necesita un `NPM_TOKEN` de escritura. La GitHub App
`RELEASE_APP_CLIENT_ID` / `RELEASE_APP_PRIVATE_KEY` es opcional si los checks de
PR creadas con `GITHUB_TOKEN` requieren disparo manual.

## Configurar Tailscale

La ruta actual permite:

```text
Runner efimero de GitHub
  -> Tailscale
    -> subnet router Proxmox (100.103.216.101)
      -> SSH apps (192.168.100.102:22)
```

Identidad compartida creada en Tailscale: **Hemia GitHub CI - prod**. La pueden
utilizar los repositorios de `hemia-labs` con environment `prod` desde `main`:

- Issuer: `https://token.actions.githubusercontent.com`.
- Subject: `repo:hemia-labs/*:environment:prod`.
- Custom claim `repository_owner`: `hemia-labs`.
- Custom claim `ref`: `refs/heads/main`.
- Scope `auth_keys` y tag autorizado `tag:hemia-ci`.
- `TS_CLIENT_ID` y `TS_AUDIENCE` ya se configuraron y verificaron en `prod` de
  `hemia-labs/identity`. En otros repositorios hay que configurar esas mismas
  variables de forma explicita; no reciben la configuracion de Identity.

Estos valores asumen el formato OIDC por defecto de GitHub. Si la organizacion
personaliza `sub`, ajustar el subject para que coincida con el token real. No usar
un subject mas amplio que la organizacion y environment aprobados. Al compartir
esta identidad, todos los repositorios que cumplan sus claims reciben el mismo
permiso de red hacia apps; las claves SSH siguen autorizando el usuario Linux. La accion oficial usa OIDC,
`id-token: write`, nodos efimeros y `--accept-routes`; no necesita una auth key
permanente. Referencias: [accion GitHub](https://tailscale.com/docs/integrations/github/github-action)
y [federacion](https://tailscale.com/docs/features/workload-identity-federation).

Fusionar el fragmento [tailscale-policy.example.jsonc](tailscale-policy.example.jsonc)
con la politica existente. Autoriza unicamente TCP 22 hacia apps desde el tag CI.
Incluye tests que deben denegar Proxmox SSH/API y PostgreSQL. Los grants/ACL se
suman: agregar este fragmento no restringe una regla `allow all` ya existente.
Revisar la politica completa y sus tests en consola. No reemplazarla con el ejemplo.
No habilitar Tailscale SSH: aqui se usa OpenSSH ordinario sobre la red privada.

La politica guardada conserva acceso amplio para `autogroup:member` y el tag
previo `tag:ci`. El tag nuevo `tag:hemia-ci` solo tiene apps TCP 22. Se guardaron
tests que verifican ese acceso y deniegan Proxmox SSH/API, PostgreSQL y apps 8080.
Todavia falta una ejecucion real de GitHub Actions para verificar el intercambio
OIDC y el acceso del runner; no se genero una auth key permanente para probarlo.

## Preparar apps una sola vez

Un administrador debe crear un usuario dedicado, autorizarle su clave publica,
dar acceso a Docker y crear el directorio. Esto ya quedo preparado en apps; los
comandos siguientes son referencia para un host nuevo:

```bash
sudo adduser --disabled-password --gecos '' identity-deploy
sudo usermod -aG docker identity-deploy
sudo install -d -o identity-deploy -g identity-deploy -m 700 \
  /home/identity-deploy/.ssh /opt/hemia/identity /opt/hemia/identity/shared
```

Instalar la clave publica en `/home/identity-deploy/.ssh/authorized_keys` con
propietario correcto y modo 600. Desactivar forwarding de agente, puertos y PTY
para esa clave (`restrict` en `authorized_keys`). No usar root ni la clave privada
personal del administrador.
En esta maquina, la clave privada dedicada esta en
`/Users/cristianmendez/.ssh/id_ed25519_identity_ci_apps` y la host key verificada
en `/Users/cristianmendez/.ssh/identity_ci_apps_known_hosts`. Sus contenidos no
se incluyen en el repositorio. Fingerprint de host apps:
`SHA256:md+zXYT1LMbtrNb5+gBQaqQEPNbemevvOE5+O7geRPs`. Pertenecer al grupo Docker equivale practicamente a
administrar el host; ese acceso debe concederse explicitamente al usuario de CI.
En apps ya se concedio expresamente a peticion del usuario.

Generar la pareja de claves de CI en un lugar seguro:

```bash
ssh-keygen -t ed25519 -f ./identity-ci -C identity-ci -N ''
# identity-ci.pub -> authorized_keys del usuario dedicado.
# identity-ci -> secret DEPLOY_SSH_PRIVATE_KEY. Nunca agregarla al repositorio.
```

Obtener la host key publica por consola confiable de apps y verificar fingerprint:

```bash
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

El secret `DEPLOY_SSH_KNOWN_HOSTS` debe tener esta forma, con la clave real:

```text
192.168.100.102 ssh-ed25519 AAAA...clave-publica-real...
```

Para puerto distinto de 22 usar `[host]:puerto`. No usar
`StrictHostKeyChecking=no` ni confiar un `ssh-keyscan` sin verificarlo.

Las imagenes se publican en `registry.tail41610c.ts.net/identity/backend` y
`registry.tail41610c.ts.net/identity/frontend`. El registry es privado, requiere
Tailscale, TLS y autenticacion. No se suben imagenes ni artifacts de imagen a
GitHub: se construyen y prueban en el mismo job que las publica directamente.
GitHub conserva tags, changelogs, Releases inmutables y assets de despliegue.

En el environment `prod` configurar `REGISTRY_HOST`, `REGISTRY_USERNAME` y el
secret `REGISTRY_PASSWORD`. La credencial de CI puede publicar; la de apps solo
puede consultar y descargar (GET/HEAD). Esta ultima vive en el Docker config de
`identity-deploy`, modo 600, y se conserva para deploy y rollback. No transferir
la credencial de escritura al servidor de aplicaciones.

El job publicador usa environment `prod`, OIDC y tag `hemia-ci`; su permiso de red
al registry es unicamente TCP 443. Se conserva el acceso SSH a apps. No se usa
`packages: write`, GHCR, `insecure-registries` ni certificados sin validar.

Crear estos archivos propiedad del usuario dedicado:

```text
/opt/hemia/identity/shared/production.env   # modo 600; variables de backend
/opt/hemia/identity/shared/host.json        # direccion, puerto y URL publica
```

Usar los [ejemplos de entorno](environment-variables.md) y
[identity-host.example.json](identity-host.example.json). En `production.env` usar valores
reales; se usa `env_file` con `format: raw` (Compose >= 2.30): los valores, incluidos
`$`, `#` y comillas, se entregan literalmente; no envolverlos en comillas.
Mantener cada valor en una sola linea. El controlador no imprime el archivo.
El directorio shared y la configuracion del registro se respaldan por separado
de las releases.

`host.json` en Proxmox:

```json
{
  "bind_address": "192.168.100.102",
  "http_port": 8080,
  "public_url": "https://id.hemia.cloud"
}
```

Confirmar dominio canonico antes del primer tag: debe coincidir con `APP_ISSUER` y
`ID_FRONTEND_URL`. Configurar el hostname del tunel en gateway hacia
`http://192.168.100.102:8080`; en la inspeccion anterior solo tenia la regla 404.
El host debe poder consultar la URL publica HTTPS para verificar el despliegue.
Aplicar las restricciones de red descritas en [Docker deployment](docker-deployment.md).

## Configuracion privada de produccion

Archivo local preparado: `backend/.env.production`, con modo 600, ignorado por
Git y excluido del contexto Docker. Los ejemplos publicos sin secretos estan en
[environment-variables.md](environment-variables.md). No sobrescribir el archivo
privado con los ejemplos si ya contiene credenciales.

Se revisaron las lecturas de ConfigService, `process.env`, los factories de
configuracion y la validacion Joi del backend:

- Runtime/startup: 34 variables de aplicacion, PostgreSQL, Access, JWT/state,
  cookies y SMTP opcional. PORT/NODE_ENV tambien estan fijados por Compose. Google es
  opcional y se omite en el archivo de produccion preparado.
- `ACCESS_JWKS_URI` y `JWT_REFRESH_SECRET` siguen siendo exigidos por la validacion
  de arranque, aunque no hay consumo de lookup JWKS ni de firma de refresh con
  ese secreto en el flujo actual. Se conservan para no romper el arranque.
- `SUPER_ADMIN_*`, `OAUTH_CLIENT_SECRET_*`, `JWKS_KEY_KID` y la clave opcional
  `JWKS_PRIVATE_KEY` pertenecen a bootstrap/seeds y no van en el archivo de
  runtime. Usar la seccion bootstrap de `docs/environment-variables.md` para ese paso manual.
- `JWKS_PRIVATE_KEY_PATH` aparece en la configuracion local, pero el codigo actual
  no lo lee. No se copio. La aplicacion obtiene la clave activa desde PostgreSQL.
- No hay consumo activo de Redis en Identity; no se agregaron variables Redis.

El archivo de produccion es privado: revisar sus credenciales reales sin
sobrescribirlo. SMTP puede omitirse o quedar vacio y no bloquea el arranque. Access se configura en
`https://access.hemia.cloud` y su ruta `/.well-known/jwks.json`; el dominio debe
apuntar al servicio real de Access. Google queda deshabilitado: si se incorpora
en el futuro, configurar conjuntamente sus dos credenciales y callback HTTPS.
Ademas hay que
confirmar el dominio publico y provisionar el usuario/base de PostgreSQL indicados.
No se conecta ni migra una base como parte de generar el archivo.

Para este despliegue, provisionar el archivo una vez en la VM apps y actualizarlo
solo cuando cambie la configuracion. El CI descarga imagenes y usa el archivo ya
presente; no lo copia, genera ni sustituye en cada release. No hace falta que las
credenciales de DB, SMTP o Google pasen por GitHub Actions. Mantener la fuente de
verdad en un gestor de contrasenas/secretos y un respaldo cifrado.

Despues de completar los pendientes, desde la raiz `identity/` se puede copiar
por SSH a apps (este comando no se ejecuto al generar el archivo):

```bash
scp -i "$HOME/.ssh/id_ed25519_identity_ci_apps" \
  -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$HOME/.ssh/identity_ci_apps_known_hosts" \
  backend/.env.production \
  identity-deploy@192.168.100.102:/opt/hemia/identity/shared/production.env
```

Verificar propietario `identity-deploy` y modo 600 en destino. El destino es la
VM apps, no el hipervisor Proxmox ni gateway. En un VPS se provisiona el mismo
`shared/production.env` en el host de la aplicacion, ajustando DB_HOST y host.json.
Para multiples servidores o rotacion frecuente se puede incorporar un gestor de
secretos; el backend actual consume variables de entorno y no implementa lectura
`*_FILE` para Docker secrets. No agregar ese mecanismo sin adaptar el consumidor.
[Referencia Docker](https://docs.docker.com/compose/how-tos/use-secrets/).

## Publicar, migrar, desplegar y volver atras

Subir y fusionar estos cambios a `main`. El changeset inicial abrira la PR de
version `1.0.0`. Revisar esa PR y fusionarla; el tag y la Release se generan solos.
Para versiones siguientes, incluir un changeset en la PR funcional y actualizar
`docs/release-notes.md` cuando cambien las instrucciones operativas o migraciones.

`identity-release.yml` publica las imagenes privadas y adjunta `release.json`, `compose.json`
y `identity-deploy.py`. El manifiesto fija commit, digests, hashes de assets y
contenido del conjunto de migraciones. Se valida tanto en runner como en host.
Las dos imagenes proceden del smoke test del mismo job que las publica.
No se transfieren a otro job ni se almacenan como artifacts en GitHub.

Con `prod.ENABLE_IDENTITY_DEPLOY=true`, la publicacion solicita automaticamente
`deploy` para esa Release. Revisar tambien la ejecucion **Identity deployment**:
que la Release se publique o que el despacho tenga exito no significa que el
despliegue haya terminado correctamente. El propio despliegue vuelve a comprobar
la variable antes de conectarse por Tailscale. Se usa `workflow_dispatch` explicito
porque los eventos `release` creados por `GITHUB_TOKEN` no disparan otro workflow;
GitHub permite expresamente despachar workflows con ese token.
[Referencia de GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

No aplica migraciones automaticamente. Si el preflight encuentra pendientes,
falla antes de reemplazar los contenedores. Ejecutar `migrate` manualmente tras
verificar backup y luego reintentar `deploy` manualmente para la misma Release.
Si la variable esta deshabilitada, sigue bloqueando tambien las operaciones
manuales: habilitarla expresamente para deploy, rollback o migrate.

En Actions > **Identity deployment** > Run workflow, seleccionar rama `main`:

- `migrate`: tag destino y `backup_confirmation=I_HAVE_A_BACKUP`. Ejecuta
  `migration:run` una sola vez por invocacion, nunca seeds y sin arrancar esa
  version ni cambiar `current`. La orden expresa la decision del operador; no es
  un hook de arranque. Si las migraciones fallan se registra el fallo y se detiene.
- `deploy`: mismo tag, despues de preparar esquema y seeds iniciales. Si hay
  migraciones pendientes falla antes de sustituir los contenedores existentes.
- `rollback`: tag anterior publicado. No reconstruye ni ejecuta migraciones. Si
  los manifiestos tienen conjuntos de migraciones distintos, exige revisar la
  compatibilidad y marcar `acknowledge_schema`. Esto no demuestra compatibilidad:
  es una confirmacion expresa del operador.

Base nueva: ejecutar el seed como operacion administrativa manual usando la imagen
publicada y variables exclusivas del seed; ver la guia Docker. El CI no incorpora
un boton de seed y no cambia Access. JWKS debe estar inicializado para pasar las
comprobaciones del despliegue.

El controlador conserva `releases/<tag>`, `current`, `previous` e historial
`history.jsonl`. Usa un bloqueo Linux para serializar tambien invocaciones fuera
de GitHub; Compose siempre usa el proyecto `hemia-identity`. No ejecutar otro
Compose con ese mismo proyecto sobre el mismo host. No editar los assets de una
release existente; el controlador rechaza contenido distinto para el mismo tag.

Descarga las imagenes primero, verifica migraciones y luego arranca con `--wait`.
Comprueba readiness, discovery y JWKS dentro de Docker y a traves de la URL
publica. Solo entonces cambia los punteros de version. `current` representa la
ultima version validada; si falla un despliegue y tambien su recuperacion, consultar
Compose y el historial para conocer los contenedores realmente activos.

Si el arranque o las comprobaciones fallan, intenta recuperar la version anterior
solo si el conjunto de migraciones es identico y esa version pasa el preflight.
El workflow sigue fallando aunque haya recuperado el servicio, para dejar el
incidente visible. Ante esquemas distintos o fallo de recuperacion, requiere
intervencion. Nunca restaura backups ni ejecuta `migration:revert` automaticamente.
Una restauracion de datos puede perder escrituras: se decide fuera del rollback
de imagenes. Incluso con el mismo conjunto de migraciones, cambios manuales de
base o sistemas externos pueden impedir recuperar el servicio.

No elimina imagenes automaticamente: mantener las referencias de releases
soportadas en el registry privado. Cualquier limpieza futura debe respetar current/previous y la
ventana de rollback. Hay una interrupcion breve al reemplazar contenedores; no es
blue/green ni un despliegue sin corte.

## Cambiar de Proxmox a VPS

Copiar/restaurar la configuracion compartida y los datos de PostgreSQL mediante
un corte coordinado. Instalar Tailscale en el VPS, darle un tag de servidor y
ajustar el grant CI hacia ese servidor TCP 22. Cambiar `DEPLOY_HOST`, host key y
clave SSH si corresponde. Conservar `DEPLOY_PATH` y nombre de environment.

Si Nginx del VPS esta en el host, usar `bind_address=127.0.0.1` en host.json y
proxy hacia `127.0.0.1:8080`. Cambiar `DB_HOST` al servidor privado de BD. Mantener
issuer/dominio y digests de release. No reinstalar Proxmox ni modificar CI para
interpretar comandos de virtualizacion: el workflow solo conoce SSH y Docker.
Al pasar la base a otro VPS, resolver la validacion de certificado PostgreSQL o
usar VPN/red privada; el soporte actual `DB_SSL` no verifica la CA del servidor.

## Validacion y limites de esta entrega

- `actionlint` en los tres workflows de Identity.
- Tests de backend/frontend, type-check/build y smoke Docker local.
- Pruebas unitarias del controlador: checksums, rollback, preflight, migraciones
  explicitas y recuperacion. No se invocan APIs remotas en estos tests.
- Falta la primera ejecucion GitHub real con credenciales, politica OIDC/grants,
  usuario y registro configurados. No se publico ninguna imagen ni tag ni se
  ejecuto un despliegue/migracion sobre tus VMs.

## Comprobaciones publicas y Cloudflare

El controlador consulta readiness, discovery y JWKS mediante GET con
`User-Agent: Hemia-Identity-Deploy/1.0` y `Accept: application/json`. Browser
Integrity Check rechazo el cliente predeterminado `Python-urllib/3.14` con
`403 / 1010`; la identificacion explicita pasa esa comprobacion sin excepciones
ni cambios en WAF o Browser Integrity Check. No es una credencial ni sustituye
la autenticacion.

Validado desde apps para las tres rutas publicas. Mientras no haya contenedores
escuchando en apps:8080, la respuesta esperada es 502; el controlador seguira
exigiendo respuestas exitosas y contenido valido despues del arranque.

## Orden de CI en main

En main, `Identity release` ejecuta los checks antes de crear la PR de version.
Cuando se fusiona la version, el job publicador ejecuta los mismos checks y
construye las imagenes antes de publicar y solicitar deploy. Asi cada ejecucion
construye una sola vez, sin almacenar imagenes en GitHub. `Identity CI` conserva su ejecucion independiente
para PR y pushes a develop; no se duplica como otro push a main.

El job de version consulta todos los changesets pendientes sin `--since`: despues
del merge, origin/main ya coincide con HEAD y ese filtro ocultaria las notas
pendientes que acaban de fusionarse. La validacion de PR puede seguir usando
`--since` contra su base para verificar las notas aportadas por la PR.

El checkout del runner sobre main solo crea referencias remotas para develop.
Antes de consultar Changesets se crea la rama local develop desde origin/develop,
porque es la base configurada para el SDK compartido. Esto no filtra ni consume
los changesets pendientes de Identity y no modifica ninguna rama remota.
La prueba del job reproduce un checkout con origin/main y origin/develop, sin
rama local develop.

## Registry privado y portabilidad

`host.json` contiene `registry_host`, y `prod.REGISTRY_HOST` debe coincidir. El
manifiesto guarda ese host y los digests; ambos validadores rechazan otro registry
o una referencia mutable. Al migrar a VPS puede conservarse el registry por
Tailscale. Si cambia su nombre, planificar la conservacion de los nombres/digests
utilizados por Releases anteriores; cambiar una variable no reescribe assets
inmutables ni migra imagenes. Ver [private-registry.md](private-registry.md).
