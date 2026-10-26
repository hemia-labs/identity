# frontend

## 1.0.3

### Patch Changes

- 8788008: Unify the OAuth scope and API catalog, validate client permissions, and bind authorization codes and refresh tokens to their API audience. Requires the explicit UniqueOAuthScopeCatalog database migration before serving the new backend.

  Reconcile main and consolidate isolated Identity test runners without changing the public SDK API.

## 1.0.2

## 1.0.1

### Patch Changes

- 9a4d85e: Show a clear required-password message on login instead of exposing a schema error, and handle rejected login requests without an unhandled promise rejection.

## 1.0.0
