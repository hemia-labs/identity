import { AccountsService } from '../../../../../backend/src/modules/accounts/accounts.service';

describe('AccountsService', () => {
  it('returns the identity account only', () => {
    const service = new AccountsService();

    expect(
      service.getAccount({
        id: 'user-id',
        email: 'user@hemia.cloud',
        username: null,
        sessionId: 'session-id',
      }),
    ).toEqual({
      id: 'user-id',
      email: 'user@hemia.cloud',
      username: null,
      sessionId: 'session-id',
    });
  });
});
