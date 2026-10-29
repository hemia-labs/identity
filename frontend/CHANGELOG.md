# frontend

## 1.2.0

### Minor Changes

- d229656: Recover a deleted Identity account through a new or resent invitation and its previously linked Google account, preserving the same user ID. Bind the invitation cookie to signed OAuth state, validate its signed issuance date after deletion, and require the verified Google email to match the invitation. Keep locked, suspended and replacement accounts protected, invalidate old sessions and OAuth tokens, and audit the recovery.

  Show an explicit user-not-found message for deleted Google accounts signing in without a recovery invitation. Organization membership still requires explicit invitation acceptance in Access.

### Patch Changes

- 96ef5b4: Continue invitation onboarding through Google and redirect accepted invitations to Console. Select the environment file explicitly for production and local development.

## 1.1.1

### Patch Changes

- 0a0c50e: Make Google the primary sign-in option with its official icon and reveal the existing password form through a secondary button.

## 1.1.0

### Minor Changes

- c2515dc: Add invitation registration and acceptance with Google sign-in return flow.

## 1.0.3

### Patch Changes

- 8788008: Unify the OAuth scope and API catalog, validate client permissions, and bind authorization codes and refresh tokens to their API audience. Requires the explicit UniqueOAuthScopeCatalog database migration before serving the new backend.

  Reconcile main and consolidate isolated Identity test runners without changing the public SDK API.

## 1.0.2

## 1.0.1

### Patch Changes

- 9a4d85e: Show a clear required-password message on login instead of exposing a schema error, and handle rejected login requests without an unhandled promise rejection.

## 1.0.0
