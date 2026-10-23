# @hemia/auth

## 1.1.0

### Minor Changes

- 86c65f6: Add a server-side MachineClient API independent of human login and SessionStore.
  Scope token caches by issuer, client, destination and normalized scopes; coalesce
  concurrent issuance and renew before expiry without extending short token lifetimes.
  Restrict API destinations, disable redirects/cookies, add bounded timeouts and
  sanitized token/transport errors. Existing SsoClient delegates to the same core.

  SsoClient retains its constructor and JSON response API; machine tokens now use
  process-local memory instead of the supplied session store. Unsafe destinations
  and token responses outside the Hemia contract are rejected. Consumers need the
  new release before adopting MachineClient.
