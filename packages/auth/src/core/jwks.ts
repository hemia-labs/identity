import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedError } from './errors';
import type { SsoConfig } from './config';
import type { SsoClaims, AuthenticatedUser } from './types';

const stringClaim = (v: unknown): string => (typeof v === 'string' ? v : '');
const stringArrayClaim = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const uniqueStrings = (v: string[]): string[] => [...new Set(v)];

/**
 * Proyecta los claims crudos del JWT sobre el {@link AuthenticatedUser} normalizado,
 * forzando los claims ausentes o con tipo incorrecto a cadenas/arrays vacíos.
 */
export function claimsToUser(payload: SsoClaims): AuthenticatedUser {
  return {
    ssoUserId: String(payload.sub ?? ''),
    email: stringClaim(payload.email),
    name: stringClaim(payload.name),
    tenantId: stringClaim(payload.tenant_id),
    organizationId: stringClaim(payload.organization_id),
    teamId: stringClaim(payload.team_id),
    roles: stringArrayClaim(payload.roles),
    permissions: uniqueStrings(stringArrayClaim(payload.permissions)),
  };
}

/**
 * Construye un verificador de access tokens ligado al JWKS, audience e issuer del SSO. El
 * conjunto de claves remoto lo descarga y cachea `jose`, por lo que la función devuelta es
 * barata de llamar repetidamente.
 *
 * @returns Un verificador que resuelve a los {@link SsoClaims} del token, o lanza
 *   {@link UnauthorizedError} si la firma, el audience o el issuer son inválidos.
 */
export function createVerifier(cfg: SsoConfig) {
  const jwks = createRemoteJWKSet(new URL(cfg.jwksUrl));
  return async function verifyAccessToken(token: string): Promise<SsoClaims> {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        audience: cfg.audience,
        issuer: cfg.issuer,
      });
      return payload as SsoClaims;
    } catch {
      throw new UnauthorizedError('Access token signature does not match JWKS');
    }
  };
}
