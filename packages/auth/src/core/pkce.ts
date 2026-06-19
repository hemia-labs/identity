import { createHash, randomBytes } from 'node:crypto';

const randomToken = (bytes: number) => randomBytes(bytes).toString('base64url');
const base64UrlSha256 = (v: string) =>
  createHash('sha256').update(v).digest('base64url');

/**
 * Genera el material PKCE y CSRF por login para un flujo de authorization-code.
 *
 * @returns `state` y `nonce` (tokens aleatorios de 32 bytes), un `codeVerifier` de 64
 *   bytes y su `codeChallenge` S256. Todos los valores van codificados en base64url.
 */
export function buildPkce() {
  const codeVerifier = randomToken(64);
  return {
    state: randomToken(32),
    nonce: randomToken(32),
    codeVerifier,
    codeChallenge: base64UrlSha256(codeVerifier),
  };
}
