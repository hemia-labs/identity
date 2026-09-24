# `@hemia/auth` 1.0.8

La 1.0.8 reúne los cambios desarrollados desde la última versión publicada en npm, 1.0.4. Las versiones 1.0.5 a 1.0.7 se usaron localmente y no se publicaron.

## Contrato público

- `AccessClient.resolveSystemContext` solicita un contexto nuevo de Access y verifica firma RS256, JWKS, issuer, audiencia escalar, tipo y vigencia del token. Conserva los estados 401, 403, 409 y 503 mediante `AccessContextError`.
- `SystemContextCache` permite compartir lecturas verificadas durante un máximo de 60 segundos entre instancias. Exige un `SessionStore` compartido con `withLock`; las mutaciones resuelven contexto fresco y no usan el valor anterior si Access falla. La aplicación sigue validando los claims y permisos propios de su producto.
- El adaptador NestJS comparte las clases del core entre sus entrypoints CommonJS y ESM, de modo que los tokens de inyección conservan su identidad.
- Durante el callback de login, fallos de disponibilidad o respuesta inválida de Access redirigen con `access_unavailable`; 401/403 usan `access_denied`. El frontend consumidor debe mostrar un error público con reintento manual para evitar un bucle de login.

La guía de uso y las condiciones de invalidación están en [el README del paquete](../packages/auth/README.md#cambios-de-la-108-frente-a-la-104).

## Verificación previa a publicar

Ejecutar desde la raíz del repositorio `bun install --frozen-lockfile`, `bun run --cwd packages/auth typecheck`, `bun run --cwd packages/auth test`, `bun run --cwd packages/auth build` y `node packages/auth/test-built-nestjs.cjs`. Revisar el contenido con `npm pack --dry-run` desde `packages/auth` y probar los imports públicos desde el tarball antes de publicar.
