<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SelectionLayout from '@/app/layouts/SelectionLayout.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountStore } from '@/features/accounts/stores/account.store'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  useAccountsQuery,
  useSessionQuery,
  useSwitchAccountMutation,
} from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const authStore = useAuthStore()
const accountsQuery = useAccountsQuery()
const sessionQuery = useSessionQuery()
const switchAccountMutation = useSwitchAccountMutation()
const returnTo = computed(() => typeof route.query.returnTo === 'string' ? route.query.returnTo : null)

function getAccountLabel(accountIndex: number) {
  return `Cuenta ${accountIndex + 1}`
}

function getAccountInitials(accountIndex: number) {
  return `C${accountIndex + 1}`
}

function getAccountSubtitle(account: { tenantId?: string | null; organizationId?: string | null; teamId?: string | null }) {
  return account.organizationId ?? account.tenantId ?? account.teamId ?? 'Contexto personal'
}

async function selectAccount(accountIndex: number) {
  await switchAccountMutation.mutateAsync(accountIndex)
  accountStore.selectAccount(accountIndex)
  authStore.selectedAccountIndex = accountIndex

  if (returnTo.value?.startsWith('/oauth/authorize')) {
    await router.push({ path: '/consent', query: { returnTo: returnTo.value } })
    return
  }

  await router.push(returnTo.value ?? '/select-organization')
}
</script>

<template>
  <SelectionLayout title="Selecciona una cuenta" description="Elige la identidad local con la que quieres continuar.">
    <div class="grid gap-3">
      <Alert v-if="accountsQuery.error.value || switchAccountMutation.error.value" variant="destructive">
        <AlertDescription>
          {{ getErrorMessage(accountsQuery.error.value ?? switchAccountMutation.error.value) }}
        </AlertDescription>
      </Alert>
      <template v-if="accountsQuery.isLoading.value">
        <Skeleton class="h-20 w-full" />
        <Skeleton class="h-20 w-full" />
      </template>
      <Card v-for="account in accountsQuery.data.value" :key="account.accountIndex" class="overflow-hidden">
        <button class="w-full text-left disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="switchAccountMutation.isPending.value" @click="selectAccount(account.accountIndex)">
          <CardContent class="flex items-center gap-4 p-4">
            <Avatar>
              <AvatarFallback>{{ getAccountInitials(account.accountIndex) }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ getAccountLabel(account.accountIndex) }}</p>
              <p class="truncate text-sm text-muted-foreground">{{ getAccountSubtitle(account) }}</p>
            </div>
            <Badge variant="secondary">{{ account.status }}</Badge>
          </CardContent>
        </button>
      </Card>
      <Button variant="outline" class="justify-start" @click="router.push('/login')">
        <UserPlus class="mr-2 h-4 w-4" />
        Usar otra cuenta
      </Button>
    </div>
    <p class="mt-6 text-sm text-muted-foreground">
      Sesion {{ sessionQuery.data.value?.sessionId }} · expira {{ sessionQuery.data.value?.expiresAt }}
    </p>
  </SelectionLayout>
</template>
