import { defineStore } from 'pinia'

export const useAccountStore = defineStore('account', {
  state: () => ({
    activeAccountIndex: null as number | null,
  }),
  actions: {
    selectAccount(accountIndex: number) {
      this.activeAccountIndex = accountIndex
    },
  },
})
