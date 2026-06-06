<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { ShieldCheck } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage, Form } from '@/components/ui/form'
import { PinInput, PinInputGroup, PinInputSlot } from '@/components/ui/pin-input'
import { mfaSchema } from '@/features/auth/schemas/auth.schemas'

const router = useRouter()
const validationSchema = toTypedSchema(mfaSchema)

function submit() {
  void router.push('/account-selector')
}
</script>

<template>
  <Form v-slot="{ meta, isSubmitting, setFieldValue }" :validation-schema="validationSchema" :initial-values="{ code: [] }" class="space-y-5" @submit="submit">
    <FormField v-slot="{ value }" name="code">
      <FormItem>
        <FormControl>
          <PinInput
            :model-value="value"
            otp
            type="text"
            placeholder="0"
            @update:model-value="(newValue) => setFieldValue('code', newValue)"
          >
            <PinInputGroup>
              <PinInputSlot v-for="index in 6" :key="index" :index="index - 1" class="h-11 w-11" />
            </PinInputGroup>
          </PinInput>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button class="w-full" type="submit" :disabled="!meta.valid || isSubmitting">
      <ShieldCheck class="mr-2 h-4 w-4" />
      Validar codigo
    </Button>
  </Form>
</template>
