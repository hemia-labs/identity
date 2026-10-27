import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createPublicKey, generateKeyPairSync } from 'crypto';
import { InvitationOnboardingService } from '../../../../../backend/src/modules/auth/invitation-onboarding.service';
import { UserStatus } from '../../../../../backend/src/modules/users/entities/user.entity';

const token = 'a'.repeat(43);
const jwt = new JwtService();
const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const config = new ConfigService({
  ACCESS_API_URL: 'https://access.example.test',
  ACCESS_JWKS_URI: 'https://access.example.test/.well-known/jwks.json',
  ACCESS_ISSUER: 'https://access.example.test',
  app: { issuer: 'https://id.example.test' },
});
function fixture(
  options: { email?: string; audience?: string; hash?: string } = {},
) {
  const proof = jwt.sign(
    {
      email: 'invitee@example.test',
      token_hash:
        options.hash ?? createHash('sha256').update(token).digest('hex'),
    },
    {
      algorithm: 'RS256',
      privateKey: keys.privateKey,
      keyid: 'key',
      header: { alg: 'RS256', kid: 'key', typ: 'invitation-registration+jwt' },
      issuer: 'https://access.example.test',
      audience: options.audience ?? 'hemia-id-invitation',
      expiresIn: '5m',
    },
  );
  const users = {
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'user' }),
    findOne: jest.fn().mockResolvedValue({
      id: 'user',
      email: options.email ?? 'invitee@example.test',
      status: UserStatus.Active,
    }),
  };
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockImplementation((url, init) => {
      const address =
        typeof url === 'string'
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url;
      if (address.endsWith('/preview'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              email: 'invitee@example.test',
              organization: 'Org',
              expiresAt: '2030-01-01',
              proof,
            }),
          ),
        );
      if (address.includes('jwks'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              keys: [
                {
                  ...createPublicKey(keys.publicKey).export({ format: 'jwk' }),
                  kid: 'key',
                },
              ],
            }),
          ),
        );
      if (address.endsWith('/accept')) {
        const body = JSON.parse(init?.body as string) as {
          identity_proof: string;
          token: string;
        };
        const payload = jwt.verify<{ email: string; token_hash: string }>(
          body.identity_proof,
          {
            publicKey: keys.publicKey,
            algorithms: ['RS256'],
            audience: 'hemia-access-invitation-accept',
            issuer: 'https://id.example.test',
          },
        );
        expect(payload.email).toBe('invitee@example.test');
        expect(payload.token_hash).toBe(
          createHash('sha256').update(token).digest('hex'),
        );
        expect(body.token).toBe(token);
        return Promise.resolve(
          new Response(
            JSON.stringify({ accepted: true, membership_id: 'membership' }),
          ),
        );
      }
      throw new Error('Unexpected request');
    });
  const service = new InvitationOnboardingService(
    config,
    jwt,
    { getActiveKey: () => Promise.resolve({ ...keys, kid: 'key' }) } as never,
    users as never,
  );
  return { service, users, fetchMock };
}
afterEach(() => jest.restoreAllMocks());
describe('Invitation onboarding trust boundary', () => {
  it('registers only the email proven by Access, as active and verified', async () => {
    const { service, users } = fixture();
    await service.register({
      token,
      firstName: 'Person',
      lastName: 'Invited',
      password: 'safe-password',
    });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invitee@example.test',
        status: UserStatus.Active,
      }),
      undefined,
      true,
    );
  });
  it('does not overwrite or link an existing account', async () => {
    const { service, users } = fixture();
    users.findByEmail.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({
        token,
        firstName: 'Name',
        lastName: '',
        password: 'safe-password',
      }),
    ).rejects.toThrow('already has an account');
    expect(users.create).not.toHaveBeenCalled();
  });
  it.each([{ audience: 'wrong' }, { hash: 'wrong' }])(
    'rejects invalid proof binding: %p',
    async (options) => {
      const { service, users } = fixture(options);
      await expect(
        service.register({
          token,
          firstName: 'Name',
          lastName: '',
          password: 'safe-password',
        }),
      ).rejects.toThrow('Invalid invitation proof');
      expect(users.create).not.toHaveBeenCalled();
    },
  );
  it('refuses acceptance from a different signed-in email', async () => {
    const { service, fetchMock } = fixture({ email: 'other@example.test' });
    await expect(service.accept(token, 'user')).rejects.toThrow(
      'email that received',
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.endsWith('/accept'),
      ),
    ).toHaveLength(0);
  });
  it('accepts with a signed, short-lived user assertion bound to the invitation', async () => {
    const { service } = fixture();
    await expect(service.accept(token, 'user')).resolves.toEqual({
      accepted: true,
      membership_id: 'membership',
    });
  });
});
