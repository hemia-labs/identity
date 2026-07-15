import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    sessionId: null as string | null,
  }),
  actions: {
    markAuthenticated(sessionId?: string) {
      this.isAuthenticated = true
      this.sessionId = sessionId ?? this.sessionId
    },
    clearSession() {
      this.isAuthenticated = false
      this.sessionId = null
    },
  },
})
