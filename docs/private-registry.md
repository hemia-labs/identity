# Registry privado de Hemia

## Infraestructura

- Proxmox CT 140 no privilegiado, Debian 13, hostname registry.
- 1 vCPU, 1024 MiB RAM, 256 MiB swap; servicio registry limitado a 512 MiB.
- Discos NVMe local-lvm: rootfs 8 GiB y datos 50 GiB, backup=1.
- Datos: /var/lib/registry. Administracion LAN: 192.168.100.107.
- Endpoint: https://registry.tail41610c.ts.net, Tailscale 100.67.113.62.
- Distribution 3.1.2 nativo; no Docker anidado.

Tailscale Serve termina TLS y gestiona la renovacion de certificados. Solo escucha
HTTPS en Tailscale; no hay Funnel ni listener del registry en la LAN. Nginx escucha
en loopback 5001 y aplica permisos por credencial; Distribution escucha en loopback
5000 y tambien valida Basic auth. No configurar insecure-registries ni omitir TLS.

## Cuentas y secretos

- registry-admin: administracion existente; clave en /root/registry-admin.env.
- identity-ci: lectura y publicacion; clave en /root/identity-ci-registry.env.
- identity-apps: solo GET/HEAD; clave en /root/identity-apps-registry.env.

Los archivos anteriores estan dentro del LXC con modo 600. Los hashes bcrypt se
almacenan en /etc/registry/htpasswd y /etc/registry/writers.htpasswd, modo 640,
root:registry. Nginx usa la segunda lista para operaciones de escritura.
Distribution tiene eliminacion deshabilitada; no ejecutar GC sin politica explicita.

GitHub environment prod contiene REGISTRY_HOST y REGISTRY_USERNAME como variables,
y REGISTRY_PASSWORD como secret cifrado de la cuenta identity-ci. La cuenta de
lectura se instala en el Docker config de identity-deploy en apps, con directorio
700 y archivo 600. El env privado de la aplicacion no se cambia.

## Red

La VM apps tiene Tailscale propio y MagicDNS; conserva su IP LAN y el despliegue
SSH actual. El grant nuevo permite tag:hemia-ci a 100.67.113.62/32 solo tcp:443.
Se conservan el grant de SSH de CI a apps y las otras reglas preexistentes.

Las pruebas guardadas de Tailscale aceptan registry:443 para hemia-ci y deniegan
registry:22 y registry:5000. Tambien permanecen las pruebas de aislamiento de
Proxmox y PostgreSQL. La red no sustituye la autenticacion del registry.

La clave actual del nodo registry vence el 22 de abril de 2027 a las 19:34,
America/Mexico_City. Renovarla antes o decidir una identidad de servicio con otra
politica de expiracion. No se cambio la expiracion de claves existentes.

## CI, Releases y rollback

Las imagenes nuevas son REGISTRY_HOST/identity/backend y /identity/frontend.
En la release, el mismo job construye, prueba y publica por Tailscale: no se suben
imagenes ni artifacts de imagen a GitHub. GitHub conserva tags identity-vX.Y.Z,
changelogs, Releases inmutables, release.json, compose.json e identity-deploy.py.

El manifiesto fija el registry y los digests; host.json incluye registry_host.
Los validadores rechazan registries distintos al configurado y referencias
mutables. El rollback manual descarga exactamente la version anterior. No se
reconstruye ni se ejecutan migraciones o seeds al arrancar.

Los paquetes bootstrap publicos de GHCR no se usan ni eliminan automaticamente.
La primera ejecucion real de publicacion debe confirmar OIDC de GitHub; las
pruebas desde apps y las pruebas de politica no sustituyen esa ejecucion.

## Respaldo y migracion

Proxmox job registry-daily: CT 140 solamente, 04:15 America/Mexico_City, HDD
homelab-storage, modo snapshot, zstd un hilo, limite 50 MiB/s, retencion 7 diarios
y 2 semanales. Usa /var/tmp para metadatos y mantiene dump con permisos 700.
Incluye rootfs, datos, hashes, claves, Nginx, servicios y estado de Tailscale.

El respaldo contiene secretos: mantener permisos restringidos. Se verifican
integridad zstd y presencia de archivos/datos. No se ha probado restauracion
completa en otro CT.

Para un VPS, conservar datos/configuracion y el nombre del registry, o planificar
la accesibilidad de los nombres anteriores para conservar rollback. No ejecutar
dos nodos simultaneamente con el mismo estado Tailscale restaurado. Si se cambia
el nombre, actualizar REGISTRY_HOST y registry_host para releases nuevas; los
assets inmutables anteriores no se reescriben automaticamente.
