import { fetchJson } from '@/lib/api'
import type {
  ApproveOAuthConsentResponse,
  AuthSession,
  OAuthConsentRequest,
} from '@/features/identity/types/api.types'

export type LoginInput = {
  identifier: string
  password: string
  deviceName?: string
}

export function login(input: LoginInput) {
  return fetchJson<{ session: AuthSession }>('/auth/login', {
    method: 'POST',
    body: input,
  })
}

export function getSession() {
  return fetchJson<AuthSession>('/auth/session')
}

export function refreshSession() {
  return fetchJson<{ session: AuthSession }>('/auth/refresh', { method: 'POST' })
}

export function logout() {
  return fetchJson<{ revoked: true }>('/auth/logout', { method: 'POST' })
}

export function forgotPassword(email: string) {
  return fetchJson<{ accepted: true }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })
}

export function resetPassword(input: { token: string; password: string }) {
  return fetchJson('/auth/reset-password', {
    method: 'POST',
    body: input,
  })
}

export function getOAuthConsentRequest(returnTo: string) {
  return fetchJson<OAuthConsentRequest>(
    `/consents/oauth/request?returnTo=${encodeURIComponent(returnTo)}`,
  )
}

export function approveOAuthConsent(returnTo: string) {
  return fetchJson<ApproveOAuthConsentResponse>('/consents/oauth/approve', {
    method: 'POST',
    body: { returnTo },
  })
}
