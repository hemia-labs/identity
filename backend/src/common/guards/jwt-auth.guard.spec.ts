import { ModuleRef } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard dual-mode (Bearer OAuth)', () => {
  const introspect = jest.fn();
  const moduleRef = { get: () => ({ introspect }) } as unknown as ModuleRef;

  const ctx = (req: Record<string, unknown>) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

  beforeEach(() => introspect.mockReset());

  it('builds request.user from an active introspection', async () => {
    introspect.mockResolvedValue({
      active: true,
      sub: 'user-1',
      email: 'a@b.com',
      session_id: 'sess-1',
      tenant_id: 't-1',
    });
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer tok' },
      cookies: {},
    };
    const guard = new JwtAuthGuard(moduleRef);

    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({
      id: 'user-1',
      sessionId: 'sess-1',
      tenantId: 't-1',
    });
  });

  it('overrides tenantId from the X-Tenant-Id header', async () => {
    introspect.mockResolvedValue({
      active: true,
      sub: 'user-1',
      session_id: 'sess-1',
      tenant_id: 't-1',
    });
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer tok', 'x-tenant-id': 't-other' },
      cookies: {},
    };

    await new JwtAuthGuard(moduleRef).canActivate(ctx(req));
    expect((req.user as { tenantId: string }).tenantId).toBe('t-other');
  });

  it('throws when passport produces no user (no token)', () => {
    const guard = new JwtAuthGuard(moduleRef);
    expect(() => guard.handleRequest(null, false)).toThrow('Invalid access token');
  });
});
