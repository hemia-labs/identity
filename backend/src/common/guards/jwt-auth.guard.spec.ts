import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('throws when passport produces no user', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, false)).toThrow('Invalid access token');
  });
});
