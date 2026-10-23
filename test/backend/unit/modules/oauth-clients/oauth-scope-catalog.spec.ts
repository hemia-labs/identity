import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OAuthScopesService } from '../../../../../backend/src/modules/oauth-scopes/oauth-scopes.service';
import { OAuthScopesController } from '../../../../../backend/src/modules/oauth-scopes/oauth-scopes.controller';
import { SaveOAuthScopeDto } from '../../../../../backend/src/modules/oauth-scopes/oauth-scope.dto';
import { IdentityAdminGuard } from '../../../../../backend/src/common/guards/identity-admin.guard';
const dto = {
  code: 'notifications.messages.send',
  audience: 'notifications-api',
  name: 'Enviar notificaciones',
  description: 'Permite enviar mensajes.',
  resource: 'https://notifications.example/',
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
test('saving catalog metadata normalizes resource URLs without creating OAuth client grants', async () => {
  const f = fixture();
  f.query.mockResolvedValue([
    { id: 'scope-id', ...dto, resource: 'https://notifications.example' },
  ]);
  await expect(f.service.save(dto)).resolves.toMatchObject({ id: 'scope-id' });
  expect(f.query).toHaveBeenCalledTimes(1);
  expect(f.query.mock.calls[0][0]).toContain('INSERT INTO oauth_scopes');
  expect(f.query.mock.calls[0][1]).toEqual([
    dto.code,
    dto.audience,
    dto.name,
    dto.description,
    'https://notifications.example',
    true,
  ]);
});
test('catalog rejects credentials, fragments, malformed resources and blank names before writes', async () => {
  for (const next of [
    { name: ' ' },
    { resource: 'https://user:password@example.com' },
    { resource: 'https://example.com/?token=secret' },
    { resource: 'https://example.com/#fragment' },
    { resource: 'file:///etc/passwd' },
    { resource: 'invalid' },
  ]) {
    const f = fixture();
    await expect(f.service.save({ ...dto, ...next })).rejects.toThrow();
    expect(f.query).not.toHaveBeenCalled();
  }
});
test('registered scope identities remain stable', async () => {
  const f = fixture();
  f.query.mockResolvedValue([{ id: 'scope-id', ...dto }]);
  await expect(
    f.service.save({ ...dto, code: 'changed' }, 'scope-id'),
  ).rejects.toThrow('fijos');
  expect(f.query).toHaveBeenCalledTimes(1);
});
test('duplicate scope identity reports a conflict', async () => {
  const f = fixture();
  f.query.mockRejectedValue({ code: '23505' });
  await expect(f.service.save(dto)).rejects.toMatchObject({ status: 409 });
});
test('scope DTO rejects whitespace tokens and unknown caller properties', () => {
  expect(
    validateSync(
      plainToInstance(SaveOAuthScopeDto, {
        ...dto,
        code: 'invalid scope',
        scopes: ['admin'],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ).length,
  ).toBeGreaterThan(0);
});
