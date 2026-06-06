import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    selectedAccountIndex: null as number | null,
    selectedOrganizationIndex: null as number | null,
    sessionId: null as string | null,
  }),
  actions: {
    markAuthenticated(sessionId?: string) {
      this.isAuthenticated = true
      this.sessionId = sessionId ?? this.sessionId
    },
    clearSession() {
      this.isAuthenticated = false
      this.selectedAccountIndex = null
      this.selectedOrganizationIndex = null
      this.sessionId = null
    },
  },
})
