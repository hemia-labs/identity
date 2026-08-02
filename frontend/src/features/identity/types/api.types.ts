export type AuthSession = {
  sessionId: string
  user: {
    email: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    avatarUrl?: string | null
  }
  expiresAt: string
}

export type OAuthConsentScope = {
  key: string
  label: string
  description: string
}

export type OAuthConsentRequest = {
  clientId: string
  clientName: string
  redirectUri: string
  scopes: OAuthConsentScope[]
  state?: string | null
  returnTo: string
  approved: boolean
}

export type ApproveOAuthConsentResponse = {
  approved: true
  authorizeUrl: string
}
