<script setup lang="ts">
import { RouterLink } from 'vue-router'
import SelectionLayout from '@/app/layouts/SelectionLayout.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSessionQuery } from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'

const sessionQuery = useSessionQuery()
</script>

<template>
  <SelectionLayout compact title="Sesion activa" description="Tu identidad esta autenticada en Hemia ID.">
    <Alert v-if="sessionQuery.error.value" variant="destructive" class="max-w-3xl">
      <AlertDescription>{{ getErrorMessage(sessionQuery.error.value) }}</AlertDescription>
    </Alert>
    <Skeleton v-else-if="sessionQuery.isLoading.value" class="h-44 w-full max-w-3xl rounded-md" />
    <Card v-else-if="sessionQuery.data.value" class="w-full max-w-3xl rounded-md border-[#d5e0f4] bg-white/92 shadow-[0_18px_55px_rgba(20,21,111,0.1)]">
      <CardHeader>
        <CardTitle class="text-xl font-bold text-[#080b67]">
          {{ sessionQuery.data.value.user.email }}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <dl class="grid gap-3 text-sm text-[#5b6d94] sm:grid-cols-2">
          <div>
            <dt class="font-semibold text-[#080b67]">Usuario</dt>
            <dd>{{ sessionQuery.data.value.user.username ?? 'Sin username' }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-[#080b67]">Expira</dt>
            <dd>{{ new Date(sessionQuery.data.value.expiresAt).toLocaleString('es-MX') }}</dd>
          </div>
        </dl>
        <Button as-child>
          <RouterLink to="/logout">Cerrar sesion</RouterLink>
        </Button>
      </CardContent>
    </Card>
  </SelectionLayout>
</template>
