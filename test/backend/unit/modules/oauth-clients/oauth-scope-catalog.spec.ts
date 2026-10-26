import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OAuthScopesService } from '../../../../../backend/src/modules/oauth-scopes/oauth-scopes.service';
import { OAuthScopesController } from '../../../../../backend/src/modules/oauth-scopes/oauth-scopes.controller';
import { SaveOAuthScopeDto } from '../../../../../backend/src/modules/oauth-scopes/oauth-scope.dto';
import { OAuthApisService } from '../../../../../backend/src/modules/oauth-scopes/oauth-apis.service';
import { IdentityAdminGuard } from '../../../../../backend/src/common/guards/identity-admin.guard';
const dto = {
  code: 'notifications.messages.send',
  name: 'Enviar notificaciones',
  description: 'Permite enviar mensajes.',
  enabled: true,
};
function fixture() {
  const query = jest.fn<Promise<unknown>, [string, unknown[]?]>();
  return { query, service: new OAuthScopesService({ query } as never) };
}
test('catalog routes require Identity administrator authorization', () => {
  expect(Reflect.getMetadata(GUARDS_METADATA, OAuthScopesController)).toContain(
    IdentityAdminGuard,
  );
});
test('scope definitions contain no audience or resource and never create grants', async () => {
  const f = fixture();
  f.query.mockResolvedValue([{ id: 'scope-id', ...dto, kind: 'api' }]);
  await expect(f.service.save(dto)).resolves.toMatchObject({ id: 'scope-id' });
  expect(f.query).toHaveBeenCalledTimes(1);
  expect(f.query.mock.calls[0][0]).toContain('INSERT INTO oauth_scopes');
  expect(f.query.mock.calls[0][1]).toEqual([
    dto.code,
    dto.name,
    dto.description,
    true,
  ]);
  expect(f.query.mock.calls[0][0]).not.toContain('oauth_clients');
});
test('scope names cannot be blank', async () => {
  const f = fixture();
  await expect(f.service.save({ ...dto, name: ' ' })).rejects.toThrow();
  expect(f.query).not.toHaveBeenCalled();
});
test('scope codes remain stable', async () => {
  const f = fixture();
  f.query.mockResolvedValue([{ id: 'scope-id', ...dto }]);
  await expect(
    f.service.save({ ...dto, code: 'changed' }, 'scope-id'),
  ).rejects.toMatchObject({ status: 409 });
});
test('globally duplicated codes report a conflict', async () => {
  const f = fixture();
  f.query.mockRejectedValue({ code: '23505' });
  await expect(f.service.save(dto)).rejects.toMatchObject({ status: 409 });
});
test('DTO refuses audience, resource, protocol classification and invalid tokens', () => {
  const errors = validateSync(
    plainToInstance(SaveOAuthScopeDto, {
      ...dto,
      code: 'invalid scope',
      audience: 'api',
      resource: 'https://api',
      kind: 'protocol',
    }),
    { whitelist: true, forbidNonWhitelisted: true },
  );
  expect(errors.map((e) => e.property).sort()).toEqual([
    'audience',
    'code',
    'kind',
    'resource',
  ]);
});
test.each([
  'https://user:password@example.com',
  'https://example.com/?secret=1',
  'https://example.com/#fragment',
  'file:///etc/passwd',
  'invalid',
])('API refuses unsafe resource %s before writes', async (resource) => {
  const query = jest.fn();
  const service = new OAuthApisService({ query } as never);
  await expect(
    service.save({
      name: 'API',
      audience: 'api',
      resource,
      scopes: [],
      enabled: true,
    }),
  ).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});

test('API registration stores a normalized resource and catalog links in one transaction', async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM oauth_scopes'))
      return [
        { id: 'scope-id', code: dto.code, enabled: true, assigned: false },
      ];
    if (sql.includes('INSERT INTO oauth_apis'))
      return [
        {
          id: 'api-id',
          audience: 'notifications-api',
          resource: 'https://notifications.example',
          name: 'Notifications',
          enabled: true,
        },
      ];
    return [];
  });
  const transaction = jest.fn(
    (work: (manager: { query: typeof query }) => unknown) => work({ query }),
  );
  const service = new OAuthApisService({ transaction } as never);
  await expect(
    service.save({
      name: 'Notifications',
      audience: 'notifications-api',
      resource: 'https://notifications.example/',
      scopes: [dto.code],
      enabled: true,
    }),
  ).resolves.toMatchObject({ id: 'api-id', scopes: [dto.code] });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO oauth_api_scopes'),
    ['api-id', ['scope-id']],
  );
  expect(query).not.toHaveBeenCalledWith(
    expect.stringContaining('oauth_clients'),
    expect.anything(),
  );
});
test('API registration refuses unknown or protocol scopes before persistence', async () => {
  const query = jest.fn().mockResolvedValue([]);
  const service = new OAuthApisService({
    transaction: (work: (manager: { query: typeof query }) => unknown) =>
      work({ query }),
  } as never);
  await expect(
    service.save({
      name: 'API',
      audience: 'api',
      resource: 'https://api.example',
      scopes: ['openid'],
      enabled: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(query).toHaveBeenCalledTimes(1);
});
