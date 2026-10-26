---
"backend": patch
"frontend": patch
---

Unify the OAuth scope and API catalog, validate client permissions, and bind authorization codes and refresh tokens to their API audience. Requires the explicit UniqueOAuthScopeCatalog database migration before serving the new backend.

Reconcile main and consolidate isolated Identity test runners without changing the public SDK API.
