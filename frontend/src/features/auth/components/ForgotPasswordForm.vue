<script setup lang="ts">
import { ref } from 'vue'
import { toTypedSchema } from '@vee-validate/zod'
import { Loader2, Mail } from 'lucide-vue-next'
import type { GenericObject } from 'vee-validate'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { forgotPasswordSchema } from '@/features/auth/schemas/auth.schemas'
import { useForgotPasswordMutation } from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'

const sent = ref(false)
const validationSchema = toTypedSchema(forgotPasswordSchema)
const forgotPasswordMutation = useForgotPasswordMutation()

async function submit(values: GenericObject) {
  await forgotPasswordMutation.mutateAsync(String(values.email))
  sent.value = true
}
</script>

<template>
  <Form v-slot="{ meta, isSubmitting }" :validation-schema="validationSchema" class="space-y-4" @submit="submit">
    <Alert v-if="sent">
      <AlertDescription>Enviamos instrucciones si el correo existe.</AlertDescription>
    </Alert>
    <Alert v-if="forgotPasswordMutation.error.value" variant="destructive">
      <AlertDescription>{{ getErrorMessage(forgotPasswordMutation.error.value) }}</AlertDescription>
    </Alert>

    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Correo</FormLabel>
        <FormControl><Input type="email" autocomplete="email" placeholder="tu@empresa.com" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button class="w-full" type="submit" :disabled="!meta.valid || isSubmitting || forgotPasswordMutation.isPending.value">
      <Loader2 v-if="forgotPasswordMutation.isPending.value" class="mr-2 h-4 w-4 animate-spin" />
      <Mail v-else class="mr-2 h-4 w-4" />
      Enviar instrucciones
    </Button>
  </Form>
</template>
