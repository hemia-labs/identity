import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOAuthClientDto } from '../../../../../../backend/src/modules/oauth-clients/dtos/create-oauth-client.dto';

const destination = {
  resource: 'https://identity.test',
  audience: 'identity-api',
  scopes: ['identity.oauth_clients.read'],
};
const client = {
  clientId: 'legal-service-dev',
  audience: 'legal-api',
  type: 'confidential',
  grantTypes: ['client_credentials'],
};

describe('OAuth service destination validation', () => {
  it('accepts distinct destinations with their own scopes', async () => {
    expect(
      await validate(
        plainToInstance(CreateOAuthClientDto, {
          ...client,
          serviceDestinations: [
            destination,
            {
              resource: 'https://access.test',
              audience: 'access-api',
              scopes: ['legal.consumer_context.read'],
            },
          ],
        }),
      ),
    ).toHaveLength(0);
  });
  it('accepts an explicit policy with no authorized destinations', async () => {
    expect(
      await validate(
        plainToInstance(CreateOAuthClientDto, {
          ...client,
          serviceDestinations: [],
        }),
      ),
    ).toHaveLength(0);
  });
  it.each(
    [
      [destination, destination],
      [null],
      [{ ...destination, resource: 'https://identity.test#fragment' }],
      [{ ...destination, scopes: ['invalid scope'] }],
      [{ ...destination, scopes: [] }],
      [destination, { ...destination, resource: 'https://other.test' }],
      [destination, { ...destination, audience: 'other-api' }],
    ].map((policy) => [policy]),
  )(
    'rejects malformed or ambiguous destination policies %j',
    async (serviceDestinations) => {
      expect(
        (
          await validate(
            plainToInstance(CreateOAuthClientDto, {
              ...client,
              serviceDestinations,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
});
