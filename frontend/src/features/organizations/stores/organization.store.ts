import { defineStore } from 'pinia'

export const useOrganizationStore = defineStore('organization', {
  state: () => ({
    activeOrganizationIndex: null as number | null,
  }),
  actions: {
    selectOrganization(organizationIndex: number) {
      this.activeOrganizationIndex = organizationIndex
    },
  },
})
