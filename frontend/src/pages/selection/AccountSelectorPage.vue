<script setup lang="ts">
import { Building2, ChevronRight, Layers3, UserPlus, UsersRound } from 'lucide-vue-next'
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
import type { SessionAccount } from '@/features/identity/types/api.types'
import { getErrorMessage } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const authStore = useAuthStore()
const accountsQuery = useAccountsQuery()
const sessionQuery = useSessionQuery()
const switchAccountMutation = useSwitchAccountMutation()
const returnTo = computed(() =>
  typeof route.query.returnTo === 'string' ? route.query.returnTo : null,
)
const isAutoSelecting = ref(false)

function getAccountLabel(account: SessionAccount) {
  return (
    account.team?.name ??
    account.organization?.name ??
    account.tenant?.name ??
    `Cuenta ${account.accountIndex + 1}`
  )
}

function getAccountInitials(account: SessionAccount) {
  return (
    getAccountLabel(account)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || `C${account.accountIndex + 1}`
  )
}

function getAccountKind(account: SessionAccount) {
  if (account.team) {
    return 'Team'
  }

  if (account.organization) {
    return 'Org'
  }

  return 'Tenant'
}

function getInitialsChipClasses(account: SessionAccount) {
  if (account.team) {
    return 'border-[#f3c66d] bg-[#fff8eb] text-[#7a4b00] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_12px_28px_rgba(128,81,0,0.14)]'
  }

  if (account.organization) {
    return 'border-[#9fe2b9] bg-[#effbf5] text-[#12683a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_12px_28px_rgba(18,104,58,0.12)]'
  }

  return 'border-[#b9c9ff] bg-[#edf3ff] text-[#17206f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_12px_28px_rgba(23,32,111,0.12)]'
}

function getAccountSubtitle(account: SessionAccount) {
  const parts = [
    account.organization?.name,
    account.organization?.name !== account.tenant?.name ? account.tenant?.name : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Contexto personal'
}

function getAccountDescription(account: SessionAccount) {
  return (
    account.team?.description ?? account.organization?.legalName ?? account.tenant?.plan ?? null
  )
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    active: 'Activa',
    invited: 'Invitada',
    suspended: 'Suspendida',
    removed: 'Removida',
    trial: 'Prueba',
    cancelled: 'Cancelada',
  }

  return labels[status] ?? status
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
  <SelectionLayout
    title="Selecciona una cuenta"
    description="Elige la identidad local con la que quieres continuar."
  >
    <div class="grid max-w-6xl gap-7">
      <Alert
        v-if="accountsQuery.error.value || switchAccountMutation.error.value"
        variant="destructive"
      >
        <AlertDescription>
          {{ getErrorMessage(accountsQuery.error.value ?? switchAccountMutation.error.value) }}
        </AlertDescription>
      </Alert>
      <template v-if="accountsQuery.isLoading.value || isAutoSelecting">
        <Skeleton class="h-40 w-full rounded-md" />
        <Skeleton class="h-24 w-full rounded-md" />
      </template>
      <template v-else>
        <Card
          v-for="account in accountsQuery.data.value"
          :key="account.accountIndex"
          class="overflow-hidden rounded-md border-[#d5e0f4] bg-white/92 shadow-[0_12px_32px_rgba(20,21,111,0.10)] transition-shadow hover:shadow-[0_18px_48px_rgba(20,21,111,0.14)]"
        >
          <button
            class="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            :disabled="switchAccountMutation.isPending.value"
            @click="selectAccount(account.accountIndex)"
          >
            <CardContent
              class="grid min-h-[156px] gap-5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:p-8"
            >
              <Avatar
                shape="square"
                class="h-[72px] w-[72px] rounded-md border border-[#d5e0f4] bg-white p-1.5 sm:h-[96px] sm:w-[96px]"
              >
                <AvatarFallback
                  :class="[
                    'grid h-full w-full place-items-center rounded-md border text-center',
                    getInitialsChipClasses(account),
                  ]"
                >
                  <span
                    class="text-[10px] font-bold uppercase leading-none text-current/70 sm:text-xs"
                  >
                    {{ getAccountKind(account) }}
                  </span>
                  <span class="text-2xl font-extrabold leading-none sm:text-[34px]">
                    {{ getAccountInitials(account) }}
                  </span>
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="text-xl font-bold leading-tight text-[#080b67] sm:text-[28px]">
                  {{ getAccountLabel(account) }}
                </p>
                <p class="mt-2 text-base text-[#5b6d94] sm:mt-3 sm:text-lg">
                  {{ getAccountSubtitle(account) }}
                </p>
                <p
                  v-if="getAccountDescription(account)"
                  class="mt-1 line-clamp-2 text-sm text-[#6d7da0] sm:text-base"
                >
                  {{ getAccountDescription(account) }}
                </p>
                <div class="mt-4 flex flex-wrap gap-2">
                  <Badge
                    v-if="account.tenant"
                    variant="secondary"
                    class="rounded-md bg-[#edf3ff] px-2.5 py-1 text-xs font-semibold text-[#17206f]"
                  >
                    <Layers3 class="mr-1.5 h-3.5 w-3.5" />
                    {{ account.tenant.name }}
                  </Badge>
                  <Badge
                    v-if="account.organization"
                    variant="secondary"
                    class="rounded-md bg-[#eefbf4] px-2.5 py-1 text-xs font-semibold text-[#12683a]"
                  >
                    <Building2 class="mr-1.5 h-3.5 w-3.5" />
                    {{ account.organization.name }}
                  </Badge>
                  <Badge
                    v-if="account.team"
                    variant="secondary"
                    class="rounded-md bg-[#fff7e8] px-2.5 py-1 text-xs font-semibold text-[#805100]"
                  >
                    <UsersRound class="mr-1.5 h-3.5 w-3.5" />
                    {{ account.team.name }}
                  </Badge>
                </div>
              </div>
              <div class="flex items-center justify-between gap-3 sm:block sm:text-right">
                <Badge
                  variant="secondary"
                  class="rounded-md bg-[#e8eeff] px-3 py-1.5 text-sm font-bold text-[#080b67] sm:px-5 sm:py-2 sm:text-base"
                  >{{ formatStatus(account.status) }}</Badge
                >
                <ChevronRight class="h-6 w-6 text-[#5b6d94] sm:ml-auto sm:mt-5" />
              </div>
            </CardContent>
          </button>
        </Card>
        <button
          class="flex min-h-[92px] items-center gap-5 rounded-md border border-[#d5e0f4] bg-white/70 px-7 text-left text-[#080b67] shadow-[0_10px_26px_rgba(20,21,111,0.08)] transition hover:bg-white hover:shadow-[0_16px_40px_rgba(20,21,111,0.12)] sm:min-h-[104px] sm:gap-8 sm:px-10"
          type="button"
          @click="router.push('/login')"
        >
          <UserPlus class="h-7 w-7 text-[#1f55f2] sm:h-8 sm:w-8" />
          <span class="flex-1 text-xl font-semibold sm:text-2xl">Usar otra cuenta</span>
          <ChevronRight class="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      </template>
    </div>
    <p class="mt-8 text-base text-[#5b6d94] sm:text-lg">
      {{ sessionQuery.data.value?.user.email }}
      <span v-if="formatDateTime(sessionQuery.data.value?.expiresAt)">
        · expira {{ formatDateTime(sessionQuery.data.value?.expiresAt) }}</span
      >
    </p>
  </SelectionLayout>
</template>
