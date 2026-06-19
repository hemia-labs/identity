import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifica una firma HMAC de webhook `sha256=<hex>` en tiempo constante.
 *
 * @param rawBody - El cuerpo crudo exacto de la petición sobre el que se calculó la firma.
 * @param signature - La cabecera de firma recibida, p. ej. `sha256=abc123…`.
 * @param secret - El secreto compartido del webhook.
 * @returns `true` solo si todos los datos están presentes y la firma coincide.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret || !signature || !rawBody) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}
