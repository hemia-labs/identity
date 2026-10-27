# backend

## 1.1.1

## 1.1.0

### Minor Changes

- c2515dc: Add invitation registration and acceptance with Google sign-in return flow.

## 1.0.3

### Patch Changes

- 8788008: Unify the OAuth scope and API catalog, validate client permissions, and bind authorization codes and refresh tokens to their API audience. Requires the explicit UniqueOAuthScopeCatalog database migration before serving the new backend.

  Reconcile main and consolidate isolated Identity test runners without changing the public SDK API.

## 1.0.2

### Patch Changes

- 9524441: Reduce the Debian slim backend runtime by excluding package managers, development headers and dependency-only documentation, type declarations and source maps. Preserve Node 22, native modules, compiled migrations and the operational TypeORM CLI.

## 1.0.1

## 1.0.0

### Major Changes

- 40fe2e9: Primer despliegue versionado de Identity: imagenes Docker, releases inmutables,
  despliegue por Tailscale y rollback manual. PostgreSQL y cloudflared externos;
  migraciones y bootstrap explicitos. Google OAuth opcional.
