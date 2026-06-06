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
  <SelectionLayout title="Autoriza acceso" description="Revisa que aplicacion solicita acceso y que permisos usara.">
    <Alert v-if="!returnTo" variant="destructive" class="max-w-2xl">
      <AlertTitle>Solicitud incompleta</AlertTitle>
      <AlertDescription>Falta returnTo para cargar el flujo OAuth.</AlertDescription>
    </Alert>
    <Alert v-else-if="consentQuery.error.value || approveMutation.error.value" variant="destructive" class="max-w-2xl">
      <AlertDescription>{{ getErrorMessage(consentQuery.error.value ?? approveMutation.error.value) }}</AlertDescription>
    </Alert>
    <Skeleton v-if="consentQuery.isLoading.value" class="h-64 w-full" />
    <Card v-else-if="consentQuery.data.value" class="max-w-2xl">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{{ consentQuery.data.value.clientName }}</CardTitle>
            <p class="mt-1 text-sm text-muted-foreground">{{ consentQuery.data.value.redirectUri }}</p>
          </div>
          <Badge variant="secondary">OIDC ready</Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-5">
        <Alert>
          <AlertTitle>Solicitud de permisos</AlertTitle>
          <AlertDescription>Estos permisos preparan la entrada segura a Hemia Console.</AlertDescription>
        </Alert>
        <div class="space-y-3">
          <div v-for="scope in consentQuery.data.value.scopes" :key="scope.key" class="flex gap-3">
            <Check class="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p class="text-sm font-medium">{{ scope.label }}</p>
              <p class="text-sm text-muted-foreground">{{ scope.description }}</p>
            </div>
          </div>
        </div>
        <Separator />
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" @click="cancel">
            <X class="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button :disabled="approveMutation.isPending.value" @click="approve">Permitir</Button>
        </div>
      </CardContent>
    </Card>
  </SelectionLayout>
</template>
