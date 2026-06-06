<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { GenericObject } from 'vee-validate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { loginSchema } from '@/features/auth/schemas/auth.schemas'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useLoginMutation } from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const validationSchema = toTypedSchema(loginSchema)
const loginMutation = useLoginMutation()
const errorMessage = computed(() => loginMutation.error.value ? getErrorMessage(loginMutation.error.value) : null)

async function submit(values: GenericObject) {
  const result = await loginMutation.mutateAsync({
    identifier: String(values.email),
    password: String(values.password),
    deviceName: window.navigator.userAgent.slice(0, 160),
  })
  authStore.markAuthenticated(result.session.sessionId)

  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : null
  await router.push({
    path: '/account-selector',
    query: returnTo ? { returnTo } : undefined,
  })
}
</script>

<template>
  <Form v-slot="{ meta, isSubmitting }" :validation-schema="validationSchema" class="space-y-5" @submit="submit">
    <Alert v-if="errorMessage" variant="destructive">
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Correo</FormLabel>
        <FormControl>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input class="pl-9" type="email" autocomplete="email" placeholder="tu@empresa.com" v-bind="componentField" />
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="password">
      <FormItem>
        <FormLabel>Password</FormLabel>
        <FormControl>
          <div class="relative">
            <KeyRound class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input class="pl-9" type="password" autocomplete="current-password" placeholder="Minimo 8 caracteres" v-bind="componentField" />
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button class="h-11 w-full" type="submit" :disabled="!meta.valid || isSubmitting || loginMutation.isPending.value">
      <Loader2 v-if="isSubmitting || loginMutation.isPending.value" class="mr-2 h-4 w-4 animate-spin" />
      <ArrowRight v-else class="mr-2 h-4 w-4" />
      Entrar
    </Button>

    <Separator />

    <div class="rounded-md border bg-muted/35 p-3">
      <div class="flex items-start gap-3">
        <ShieldCheck class="mt-0.5 h-4 w-4 text-emerald-600" />
        <div>
          <p class="text-sm font-medium">Sesion protegida</p>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            Despues del login puedes validar MFA, seleccionar cuenta y autorizar permisos.
          </p>
        </div>
      </div>
    </div>
  </Form>
</template>
