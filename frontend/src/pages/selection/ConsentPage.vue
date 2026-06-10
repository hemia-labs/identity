<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SelectionLayout from '@/app/layouts/SelectionLayout.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useApproveOAuthConsentMutation,
  useOAuthConsentQuery,
} from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage, resolveBackendUrl } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const returnTo = computed(() => typeof route.query.returnTo === 'string' ? route.query.returnTo : null)
const consentQuery = useOAuthConsentQuery(() => returnTo.value)
const approveMutation = useApproveOAuthConsentMutation()

async function approve() {
  if (!returnTo.value) {
    return
  }

  const result = await approveMutation.mutateAsync(returnTo.value)
  window.location.assign(resolveBackendUrl(result.authorizeUrl))
}

function cancel() {
  const request = consentQuery.data.value
  if (!request) {
    void router.push('/session-expired')
    return
  }

  const redirectUrl = new URL(request.redirectUri)
  redirectUrl.searchParams.set('error', 'access_denied')
  if (request.state) {
    redirectUrl.searchParams.set('state', request.state)
  }
  window.location.assign(redirectUrl.toString())
}
</script>

<template>
  <SelectionLayout compact title="Autoriza acceso" description="Revisa que aplicacion solicita acceso y que permisos usara.">
    <Alert v-if="!returnTo" variant="destructive" class="max-w-4xl">
      <AlertTitle>Solicitud incompleta</AlertTitle>
      <AlertDescription>Falta returnTo para cargar el flujo OAuth.</AlertDescription>
    </Alert>
    <Alert v-else-if="consentQuery.error.value || approveMutation.error.value" variant="destructive" class="max-w-4xl">
      <AlertDescription>{{ getErrorMessage(consentQuery.error.value ?? approveMutation.error.value) }}</AlertDescription>
    </Alert>
    <Skeleton v-if="consentQuery.isLoading.value" class="h-[380px] w-full max-w-4xl rounded-md" />
    <Card v-else-if="consentQuery.data.value" class="max-w-4xl rounded-md border-[#d5e0f4] bg-white/92 shadow-[0_18px_55px_rgba(20,21,111,0.1)]">
      <CardHeader class="p-4 pb-2 sm:p-6 sm:pb-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle class="text-lg font-bold text-[#080b67] sm:text-xl">{{ consentQuery.data.value.clientName }}</CardTitle>
            <p class="mt-1.5 break-all text-sm text-[#5b6d94] sm:text-base">{{ consentQuery.data.value.redirectUri }}</p>
          </div>
          <Badge variant="secondary" class="rounded-md bg-[#e8eeff] px-3 py-1 text-sm font-bold text-[#0f39b8] sm:px-4 sm:text-base">OIDC ready</Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-4 p-4 pt-2 sm:space-y-5 sm:p-6 sm:pt-3">
        <Alert class="rounded-md border-[#cfdcf2] bg-[#f7fbff] px-4 py-3">
          <AlertTitle class="text-base font-bold text-[#080b67] sm:text-lg">Permisos solicitados</AlertTitle>
          <AlertDescription class="mt-1 text-sm text-[#5b6d94] sm:text-base">Estos permisos permiten el acceso seguro a la aplicacion solicitante.</AlertDescription>
        </Alert>
        <div class="space-y-3 sm:space-y-4">
          <div v-for="scope in consentQuery.data.value.scopes" :key="scope.key" class="flex gap-3 sm:gap-4">
            <Check class="mt-0.5 h-4 w-4 shrink-0 text-[#1f55f2] sm:h-5 sm:w-5" />
            <div>
              <p class="text-base font-bold text-[#080b67] sm:text-lg">{{ scope.label }}</p>
              <p class="mt-1 text-sm text-[#5b6d94] sm:text-base">{{ scope.description }}</p>
            </div>
          </div>
        </div>
        <Separator class="bg-[#dce6f8]" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" class="h-10 border-[#cfdcf2] px-6 text-base font-bold text-[#080b67] shadow-[0_8px_20px_rgba(20,21,111,0.08)] hover:bg-[#eaf1ff]" @click="cancel">
            <X class="mr-3 h-4 w-4" />
            Cancelar
          </Button>
          <Button class="h-10 bg-[#1f55f2] px-8 text-base font-bold shadow-[0_12px_26px_rgba(31,85,242,0.26)] hover:bg-[#1749d8]" :disabled="approveMutation.isPending.value" @click="approve">Permitir</Button>
        </div>
      </CardContent>
    </Card>
  </SelectionLayout>
</template>
