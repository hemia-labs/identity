import { useQuery } from '@tanstack/vue-query'
import { accountsMock, consentMock, organizationsMock, sessionMock } from '@/mocks/identity.mock'

const wait = async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

export function useSessionQuery() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      await wait()
      return sessionMock
    },
  })
}

export function useAccountsQuery() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      await wait()
      return accountsMock
    },
  })
}

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      await wait()
      return organizationsMock
    },
  })
}

export function useConsentQuery() {
  return useQuery({
    queryKey: ['consent-request'],
    queryFn: async () => {
      await wait()
      return consentMock
    },
  })
}
