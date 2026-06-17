<script setup lang="ts">
import { ChevronRight, UserPlus } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SelectionLayout from '@/app/layouts/SelectionLayout.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
const isAutoSelecting = ref(false)

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

watch(
  () => accountsQuery.data.value,
  async (accounts) => {
    if (isAutoSelecting.value || accounts?.length !== 1) {
      return
    }

    const account = accounts[0]
    if (!account) {
      return
    }

    isAutoSelecting.value = true
    await selectAccount(account.accountIndex)
  },
)
</script>

<template>
  <SelectionLayout title="Selecciona una cuenta" description="Elige la identidad local con la que quieres continuar.">
    <div class="grid max-w-6xl gap-7">
      <Alert v-if="accountsQuery.error.value || switchAccountMutation.error.value" variant="destructive">
        <AlertDescription>
          {{ getErrorMessage(accountsQuery.error.value ?? switchAccountMutation.error.value) }}
        </AlertDescription>
      </Alert>
      <template v-if="accountsQuery.isLoading.value || isAutoSelecting">
        <Skeleton class="h-40 w-full rounded-md" />
        <Skeleton class="h-24 w-full rounded-md" />
      </template>
      <template v-else>
        <Card v-for="account in accountsQuery.data.value" :key="account.accountIndex" class="overflow-hidden rounded-md border-[#d5e0f4] bg-white/92 shadow-[0_12px_32px_rgba(20,21,111,0.10)] transition-shadow hover:shadow-[0_18px_48px_rgba(20,21,111,0.14)]">
          <button class="w-full text-left disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="switchAccountMutation.isPending.value" @click="selectAccount(account.accountIndex)">
            <CardContent class="flex min-h-[116px] items-center gap-5 p-5 sm:min-h-[154px] sm:gap-8 sm:p-8">
              <Avatar class="h-16 w-16 border border-[#d5e0f4] bg-white p-1 sm:h-[100px] sm:w-[100px]">
                <AvatarFallback class="bg-[#225cff] text-xl font-medium text-white shadow-[inset_0_0_30px_rgba(255,255,255,0.14)] sm:text-[32px]">{{ getAccountInitials(account.accountIndex) }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="text-xl font-bold leading-tight text-[#080b67] sm:text-[28px]">{{ getAccountLabel(account.accountIndex) }}</p>
                <p class="mt-2 truncate text-base text-[#5b6d94] sm:mt-3 sm:text-xl">{{ getAccountSubtitle(account) }}</p>
              </div>
              <Badge variant="secondary" class="rounded-md bg-[#e8eeff] px-3 py-1.5 text-sm font-bold text-[#080b67] sm:px-5 sm:py-2 sm:text-lg">{{ account.status }}</Badge>
            </CardContent>
          </button>
        </Card>
        <button class="flex min-h-[92px] items-center gap-5 rounded-md border border-[#d5e0f4] bg-white/70 px-7 text-left text-[#080b67] shadow-[0_10px_26px_rgba(20,21,111,0.08)] transition hover:bg-white hover:shadow-[0_16px_40px_rgba(20,21,111,0.12)] sm:min-h-[104px] sm:gap-8 sm:px-10" type="button" @click="router.push('/login')">
          <UserPlus class="h-7 w-7 text-[#1f55f2] sm:h-8 sm:w-8" />
          <span class="flex-1 text-xl font-semibold sm:text-2xl">Usar otra cuenta</span>
          <ChevronRight class="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      </template>
    </div>
    <p class="mt-8 text-xl text-[#5b6d94]">
      Sesion {{ sessionQuery.data.value?.sessionId }} · expira {{ sessionQuery.data.value?.expiresAt }}
    </p>
  </SelectionLayout>
</template>
