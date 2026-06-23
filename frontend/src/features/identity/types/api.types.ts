export type AuthSession = {
  sessionId: string
  user: {
    email: string
    username?: string | null
    firstName?: string | null
    lastName?: string | null
    avatarUrl?: string | null
  }
  tenantId?: string | null
  organizationId?: string | null
  teamId?: string | null
  expiresAt: string
}

export type SessionAccount = {
  accountIndex: number
  membershipId: string
  tenantId?: string | null
  organizationId?: string | null
  teamId?: string | null
  status: string
  tenant?: {
    name: string
    slug: string
    status: string
    plan?: string | null
  } | null
  organization?: {
    name: string
    slug: string
    legalName?: string | null
  } | null
  team?: {
    name: string
    slug: string
    description?: string | null
  } | null
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
