import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { Repository } from 'typeorm';
import { OAuthClientsService } from '../../../../../backend/src/modules/oauth-clients/oauth-clients.service';
import { OAuthClientsController } from '../../../../../backend/src/modules/oauth-clients/oauth-clients.controller';
import {
  OAuthClientEntity,
  OAuthClientStatus,
  OAuthClientType,
} from '../../../../../backend/src/modules/oauth/entities/oauth-client.entity';
import { ADMIN_ACTION_KEY } from '../../../../../backend/src/common/decorators/admin-action.decorator';
const destination = {
  resource: 'https://support.example',
  audience: 'support-api',
  scopes: ['legal.consumer_context.read'],
};
function fixture() {
  const row = {
    id: randomUUID(),
    clientId: 'legal-service',
    status: OAuthClientStatus.Active,
    type: OAuthClientType.Confidential,
    grantTypes: ['client_credentials'],
    clientSecretHash: 'private-hash',
    audience: 'identity-api',
    redirectUris: ['https://example.com/callback'],
    scopes: ['unchanged'],
    serviceDestinations: [
      {
        resource: 'https://identity.example',
        audience: 'identity-api',
        scopes: ['identity.oauth_clients.read'],
      },
    ],
  } as OAuthClientEntity;
  let saved = row;
  const repository = {
    findOne: jest.fn().mockResolvedValue(row),
    findOneByOrFail: jest.fn().mockImplementation(() => Promise.resolve(saved)),
    update: jest
      .fn()
      .mockImplementation((_id: string, next: Partial<OAuthClientEntity>) => {
        saved = { ...row, ...next };
        return Promise.resolve({ affected: 1 });
      }),
  };
  const service = new OAuthClientsService({
    manager: {
      transaction: (work: (m: unknown) => unknown) =>
        work({ getRepository: () => repository }),
    },
  } as unknown as Repository<OAuthClientEntity>);
  return { row, repository, service };
}
it('adds one destination atomically while preserving every unrelated client field', async () => {
  const f = fixture();
  const before = structuredClone(f.row);
  const result = await f.service.ensureServiceDestination(
    f.row.id,
    destination,
  );
  expect(f.repository.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
  );
  expect(f.repository.update).toHaveBeenCalledWith(f.row.id, {
    serviceDestinations: [...before.serviceDestinations!, destination],
  });
  expect(f.row).toEqual(before);
  expect(result).not.toHaveProperty('clientSecretHash');
  expect(result).toMatchObject({
    audience: before.audience,
    redirectUris: before.redirectUris,
    scopes: before.scopes,
  });
});
it('merges scopes without removing existing permissions and is idempotent', async () => {
  const f = fixture();
  f.row.serviceDestinations!.push({ ...destination, scopes: ['existing'] });
  const result = await f.service.ensureServiceDestination(
    f.row.id,
    destination,
  );
  expect(result.serviceDestinations!.at(-1)!.scopes).toEqual([
    'existing',
    'legal.consumer_context.read',
  ]);
  f.row.serviceDestinations = result.serviceDestinations;
  f.repository.update.mockClear();
  await f.service.ensureServiceDestination(f.row.id, destination);
  expect(f.repository.update).not.toHaveBeenCalled();
});
it.each(['audience', 'resource'])(
  'rejects conflicting %s without changing the policy',
  async (key) => {
    const f = fixture();
    f.row.serviceDestinations!.push({
      ...destination,
      [key]: key === 'resource' ? 'https://other.example' : 'other-api',
    });
    await expect(
      f.service.ensureServiceDestination(f.row.id, destination),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.repository.update).not.toHaveBeenCalled();
  },
);
it('refuses to silently replace a single-destination policy', async () => {
  const f = fixture();
  f.row.serviceDestinations = null;
  await expect(
    f.service.ensureServiceDestination(f.row.id, destination),
  ).rejects.toMatchObject({ status: 409 });
  expect(f.repository.update).not.toHaveBeenCalled();
});
it('requires an active confidential service client and the existing administrative permission', async () => {
  const f = fixture();
  f.row.type = OAuthClientType.Public;
  await expect(
    f.service.ensureServiceDestination(f.row.id, destination),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    new Reflector().get(
      ADMIN_ACTION_KEY,
      Object.getOwnPropertyDescriptor(
        OAuthClientsController.prototype,
        'ensureServiceDestination',
      )!.value as () => unknown,
    ),
  ).toBe('identity.oauth_clients.update');
});

it('removes only requested destination scopes under lock without changing credentials or other grants', async () => {
  const f = fixture();
  f.row.serviceDestinations!.push({
    ...destination,
    scopes: ['retained', ...destination.scopes],
  });
  const before = structuredClone(f.row);
  const result = await f.service.removeServiceDestinationScopes(
    f.row.id,
    destination,
  );
  expect(f.repository.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
  );
  expect(f.repository.update).toHaveBeenCalledWith(f.row.id, {
    serviceDestinations: [
      before.serviceDestinations![0],
      { ...destination, scopes: ['retained'] },
    ],
  });
  expect(result).not.toHaveProperty('clientSecretHash');
  expect(result.scopes).toEqual(before.scopes);
  expect(f.row).toEqual(before);
});
it('removes the final destination as [] and can grant again without a fallback policy', async () => {
  const f = fixture();
  f.row.serviceDestinations = [destination];
  const result = await f.service.removeServiceDestinationScopes(
    f.row.id,
    destination,
  );
  expect(result.serviceDestinations).toEqual([]);
  f.row.serviceDestinations = [];
  await expect(
    f.service.ensureServiceDestination(f.row.id, destination),
  ).resolves.toMatchObject({ serviceDestinations: [destination] });
});
it('removal is idempotent and matches both audience and resource', async () => {
  const f = fixture();
  await f.service.removeServiceDestinationScopes(f.row.id, destination);
  await f.service.removeServiceDestinationScopes(f.row.id, {
    ...f.row.serviceDestinations![0],
    audience: 'wrong-api',
  });
  expect(f.repository.update).not.toHaveBeenCalled();
  expect(
    new Reflector().get(
      ADMIN_ACTION_KEY,
      Object.getOwnPropertyDescriptor(
        OAuthClientsController.prototype,
        'removeServiceDestinationScopes',
      )!.value as () => unknown,
    ),
  ).toBe('identity.oauth_clients.update');
});
it('does not convert the top-level policy during a destination removal', async () => {
  const f = fixture();
  f.row.serviceDestinations = null;
  await expect(
    f.service.removeServiceDestinationScopes(f.row.id, destination),
  ).rejects.toMatchObject({ status: 409 });
  expect(f.repository.update).not.toHaveBeenCalled();
});
