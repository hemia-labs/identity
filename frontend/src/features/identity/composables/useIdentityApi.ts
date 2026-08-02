import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  approveOAuthConsent,
  forgotPassword,
  getOAuthConsentRequest,
  getSession,
  login,
  logout,
  resetPassword,
} from '@/features/identity/api/identity.api'

export function useSessionQuery() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
  })
}

export function useOAuthConsentQuery(returnTo: () => string | null) {
  return useQuery({
    queryKey: ['oauth-consent-request', returnTo],
    queryFn: () => getOAuthConsentRequest(returnTo() ?? ''),
    enabled: () => Boolean(returnTo()),
    retry: false,
  })
}

export function useLoginMutation() {
  return useMutation({ mutationFn: login })
}

export function useForgotPasswordMutation() {
  return useMutation({ mutationFn: forgotPassword })
}

export function useResetPasswordMutation() {
  return useMutation({ mutationFn: resetPassword })
}

export function useLogoutMutation() {
  return useMutation({ mutationFn: logout })
}

export function useApproveOAuthConsentMutation() {
  return useMutation({ mutationFn: approveOAuthConsent })
}
