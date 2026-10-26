import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { OAuthClientEntity } from '../oauth/entities/oauth-client.entity';
type Scope = { code: string; kind: 'api' | 'protocol'; enabled: boolean };
type Api = {
  audience: string;
  resource: string | null;
  enabled: boolean;
  scopes: string[];
};
export async function assertClientCatalog(
  manager: EntityManager,
  client: Pick<
    OAuthClientEntity,
    'audience' | 'scopes' | 'serviceDestinations'
  >,
  previous?: Pick<
    OAuthClientEntity,
    'audience' | 'scopes' | 'serviceDestinations'
  >,
): Promise<void> {
  if (
    previous &&
    previous.audience === client.audience &&
    client.scopes.every((code) => previous.scopes.includes(code)) &&
    (client.serviceDestinations ?? []).every((d) =>
      previous.serviceDestinations?.some(
        (old) =>
          old.audience === d.audience &&
          old.resource === d.resource &&
          d.scopes.every((code) => old.scopes.includes(code)),
      ),
    )
  )
    return;
  const scopes: Scope[] = await manager.query(
    'SELECT code,kind,enabled FROM oauth_scopes',
  );
  const apis: Api[] =
    await manager.query(`SELECT a.audience,a.resource,a.enabled,
    COALESCE(array_agg(s.code) FILTER (WHERE s.code IS NOT NULL),'{}') AS scopes
    FROM oauth_apis a LEFT JOIN oauth_api_scopes r ON r.api_id=a.id
    LEFT JOIN oauth_scopes s ON s.id=r.scope_id GROUP BY a.id`);
  const base = apis.find((a) => a.audience === client.audience && a.enabled);
  if (!base && (!previous || previous.audience !== client.audience))
    throw new BadRequestException(
      'Selecciona una API habilitada para la audiencia del cliente.',
    );
  const known = (code: string) =>
    scopes.find((s) => s.code === code && s.enabled);
  for (const code of client.scopes) {
    if (
      previous?.audience === client.audience &&
      previous.scopes.includes(code)
    )
      continue;
    const scope = known(code);
    if (!scope || (scope.kind === 'api' && !base?.scopes.includes(code)))
      throw new BadRequestException(
        'El scope no está habilitado para la API seleccionada.',
      );
  }
  for (const destination of client.serviceDestinations ?? []) {
    const existing = previous?.serviceDestinations?.find(
      (d) =>
        d.audience === destination.audience &&
        d.resource === destination.resource,
    );
    const additions = destination.scopes.filter(
      (code) => !existing?.scopes.includes(code),
    );
    if (existing && !additions.length) continue;
    const api = apis.find(
      (a) =>
        a.enabled &&
        a.resource === destination.resource &&
        a.audience === destination.audience,
    );
    if (
      !api ||
      additions.some(
        (code) => known(code)?.kind !== 'api' || !api.scopes.includes(code),
      )
    )
      throw new BadRequestException(
        'La API o sus scopes no están autorizados en el catálogo.',
      );
  }
}
