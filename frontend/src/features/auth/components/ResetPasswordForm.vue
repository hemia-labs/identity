<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { KeyRound, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import type { GenericObject } from 'vee-validate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetPasswordSchema } from '@/features/auth/schemas/auth.schemas'
import { useResetPasswordMutation } from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'

const router = useRouter()
const validationSchema = toTypedSchema(resetPasswordSchema)
const resetPasswordMutation = useResetPasswordMutation()

async function submit(values: GenericObject) {
  await resetPasswordMutation.mutateAsync({
    token: String(values.token),
    password: String(values.password),
  })
  void router.push('/login')
}
</script>

<template>
  <Form v-slot="{ meta, isSubmitting }" :validation-schema="validationSchema" class="space-y-4" @submit="submit">
    <Alert v-if="resetPasswordMutation.error.value" variant="destructive">
      <AlertDescription>{{ getErrorMessage(resetPasswordMutation.error.value) }}</AlertDescription>
    </Alert>

    <FormField v-slot="{ componentField }" name="token">
      <FormItem>
        <FormLabel>Token</FormLabel>
        <FormControl><Input placeholder="Codigo recibido" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="password">
      <FormItem>
        <FormLabel>Nuevo password</FormLabel>
        <FormControl><Input type="password" autocomplete="new-password" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="confirmPassword">
      <FormItem>
        <FormLabel>Confirmar password</FormLabel>
        <FormControl><Input type="password" autocomplete="new-password" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button class="w-full" type="submit" :disabled="!meta.valid || isSubmitting || resetPasswordMutation.isPending.value">
      <Loader2 v-if="resetPasswordMutation.isPending.value" class="mr-2 h-4 w-4 animate-spin" />
      <KeyRound v-else class="mr-2 h-4 w-4" />
      Actualizar password
    </Button>
  </Form>
</template>
