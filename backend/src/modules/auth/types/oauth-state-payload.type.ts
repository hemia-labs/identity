export type OAuthStatePayload = {
  nonce: string;
  purpose: 'google_login_redirect';
  redirectUri: string;
};
