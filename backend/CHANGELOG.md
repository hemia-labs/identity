# backend

## 1.0.2

### Patch Changes

- 9524441: Reduce the Debian slim backend runtime by excluding package managers, development headers and dependency-only documentation, type declarations and source maps. Preserve Node 22, native modules, compiled migrations and the operational TypeORM CLI.

## 1.0.1

## 1.0.0

### Major Changes

- 40fe2e9: Primer despliegue versionado de Identity: imagenes Docker, releases inmutables,
  despliegue por Tailscale y rollback manual. PostgreSQL y cloudflared externos;
  migraciones y bootstrap explicitos. Google OAuth opcional.
