<script setup lang="ts">
import { Building2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import SelectionLayout from '@/app/layouts/SelectionLayout.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganizationsQuery } from '@/features/identity/composables/useIdentityMocks'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useOrganizationStore } from '@/features/organizations/stores/organization.store'

const router = useRouter()
const authStore = useAuthStore()
const organizationStore = useOrganizationStore()
const organizationsQuery = useOrganizationsQuery()

function selectOrganization(organizationIndex: number) {
  organizationStore.selectOrganization(organizationIndex)
  authStore.selectedOrganizationIndex = organizationIndex
  void router.push('/consent')
}
</script>

<template>
  <SelectionLayout title="Selecciona una organizacion" description="Tu cuenta tiene acceso a varias organizaciones.">
    <div class="grid gap-3 sm:grid-cols-2">
      <template v-if="organizationsQuery.isLoading.value">
        <Skeleton class="h-28 w-full" />
        <Skeleton class="h-28 w-full" />
      </template>
      <Card v-for="organization in organizationsQuery.data.value" :key="organization.organizationIndex" class="border-[#dce6f8] shadow-sm">
        <CardContent class="p-4">
          <div class="flex items-start justify-between gap-4">
            <Building2 class="mt-1 h-5 w-5 text-[#2f6df6]" />
            <Badge :variant="organization.status === 'active' ? 'default' : 'secondary'">{{ organization.status }}</Badge>
          </div>
          <h2 class="mt-4 font-semibold text-[#14156f]">{{ organization.name }}</h2>
          <p class="text-sm text-muted-foreground">{{ organization.role }}</p>
          <Button class="mt-4 w-full border-[#cfdcf2] text-[#14156f] hover:bg-[#eaf1ff]" variant="outline" @click="selectOrganization(organization.organizationIndex)">
            Continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  </SelectionLayout>
</template>
