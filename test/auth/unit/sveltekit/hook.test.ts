import { expect, test } from 'bun:test';
import { createSsoHook } from '../../../../packages/auth/src/sveltekit/hook';
import type { SsoConfig } from '../../../../packages/auth/src/core/config';

const config = {
  cookieName: 'session',
  sessionTtlSeconds: 3600,
  cookieSecure: true,
} as SsoConfig;

test('does not load the session on the logout route', async () => {
  const getSession = async () => {
    throw new Error('logout must not refresh');
  };
  const locals: Record<string, unknown> = {};
  let resolved = false;

  await createSsoHook({ getSession } as never, config)({
    event: {
      url: new URL('https://app.example.com/auth/logout'),
      cookies: { get: () => 'session-1' },
      locals,
    },
    resolve: async () => {
      resolved = true;
      return new Response('ok');
    },
  } as never);

  expect(resolved).toBe(true);
});

test('loads the session on regular routes', async () => {
  let calls = 0;
  const getSession = async () => {
    calls += 1;
    return {
      user: { sub: 'user-1', email: 'user@example.com', name: 'User' },
      accessContext: undefined,
    };
  };
  const locals: Record<string, unknown> = {};

  await createSsoHook({ getSession } as never, config)({
    event: {
      url: new URL('https://app.example.com/dashboard'),
      cookies: { get: () => 'session-1' },
      locals,
    },
    resolve: async () => new Response('ok'),
  } as never);

  expect(calls).toBe(1);
  expect(locals.user).toMatchObject({ sub: 'user-1' });
});
