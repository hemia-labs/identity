<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { ArrowRight, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerSchema } from '@/features/auth/schemas/auth.schemas'

const router = useRouter()
const validationSchema = toTypedSchema(registerSchema)

function submit() {
  void router.push('/verify-email')
}
</script>

<template>
  <Form v-slot="{ meta, isSubmitting }" :validation-schema="validationSchema" class="space-y-4" @submit="submit">
    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel>Nombre</FormLabel>
        <FormControl><Input autocomplete="name" placeholder="Nombre completo" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Correo</FormLabel>
        <FormControl><Input type="email" autocomplete="email" placeholder="tu@empresa.com" v-bind="componentField" /></FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel>Password</FormLabel>
          <FormControl><Input type="password" autocomplete="new-password" v-bind="componentField" /></FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField v-slot="{ componentField }" name="confirmPassword">
        <FormItem>
          <FormLabel>Confirmar</FormLabel>
          <FormControl><Input type="password" autocomplete="new-password" v-bind="componentField" /></FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <FormField v-slot="{ value, handleChange }" name="acceptTerms" type="checkbox">
      <FormItem class="flex gap-3 rounded-md border p-3">
        <FormControl>
          <Checkbox :model-value="value" @update:model-value="handleChange" />
        </FormControl>
        <div class="space-y-1 leading-none">
          <FormLabel>Acepto terminos de identidad y seguridad</FormLabel>
          <FormMessage />
        </div>
      </FormItem>
    </FormField>

    <Button class="w-full" type="submit" :disabled="!meta.valid || isSubmitting">
      <Loader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
      <ArrowRight v-else class="mr-2 h-4 w-4" />
      Crear cuenta
    </Button>
  </Form>
</template>
