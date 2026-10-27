<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { GenericObject } from 'vee-validate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginSchema } from '@/features/auth/schemas/auth.schemas'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useLoginMutation } from '@/features/identity/composables/useIdentityApi'
import { getErrorMessage } from '@/lib/api'
import { startGoogleLogin } from '@/features/auth/google-login'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const validationSchema = toTypedSchema(loginSchema)
const loginMutation = useLoginMutation()
const errorMessage = computed(() => loginMutation.error.value ? getErrorMessage(loginMutation.error.value) : null)
const showPassword = ref(false)
const passwordLogin = ref(false)
const googleError = ref<string | null>(null)
function googleLogin() {
  try {
    startGoogleLogin(typeof route.query.returnTo === 'string' ? route.query.returnTo : null)
  } catch {
    googleError.value = 'No se pudo iniciar Google. Habilita el almacenamiento del navegador e intenta de nuevo.'
  }
}

async function submit(values: GenericObject) {
  let result
  try {
    result = await loginMutation.mutateAsync({
      identifier: String(values.email),
      password: String(values.password),
      deviceName: window.navigator.userAgent.slice(0, 160),
    })
  } catch {
    // The mutation error is displayed in the form alert.
    return
  }
  authStore.markAuthenticated(result.session.sessionId)

  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : null
  await router.push(returnTo === '/invitations' ? '/invitations' : returnTo ? { path: '/consent', query: { returnTo } } : '/session')
}
</script>

<template>
  <div class="space-y-6">
    <Button class="h-12 w-full gap-3 rounded-md border-[#747775] bg-white px-4 text-sm font-medium tracking-[0.25px] text-[#1f1f1f] shadow-none transition-[background-color,box-shadow] hover:bg-[#f8faff] hover:text-[#1f1f1f] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[#4285f4] focus-visible:ring-offset-2 active:bg-[#edf2fc]" variant="outline" type="button" :disabled="loginMutation.isPending.value" @click="googleLogin">
      <img src="/google-g.png" alt="" aria-hidden="true" width="20" height="20" class="size-5 shrink-0 object-contain" />
      <span>Iniciar sesión con Google</span>
    </Button>
    <Alert v-if="googleError" variant="destructive">
      <AlertDescription>{{ googleError }}</AlertDescription>
    </Alert>

    <Button v-if="!passwordLogin" class="h-12 w-full gap-3 rounded-md border-[#c4d2eb] bg-[#f4f7fd] text-sm font-semibold text-[#182253] shadow-sm hover:border-[#9db5e0] hover:bg-[#eaf0fb] hover:text-[#080b67] active:bg-[#dfe9f9]" variant="outline" type="button" @click="passwordLogin = true">
      <KeyRound class="size-4" />
      Continuar con contraseña
    </Button>

    <Form v-if="passwordLogin" v-slot="{ isSubmitting }" :validation-schema="validationSchema" class="space-y-6" @submit="submit">
      <Alert v-if="errorMessage" variant="destructive">
        <AlertDescription>{{ errorMessage }}</AlertDescription>
      </Alert>

      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel class="text-[#080b67]">Correo de trabajo</FormLabel>
          <FormControl>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7383a1]" />
              <Input class="h-12 rounded-md border-[#cfd9ec] bg-white pl-14 text-base shadow-none placeholder:text-[#71809b] focus-visible:ring-[#2568ff]" type="email" autocomplete="email" placeholder="nombre@empresa.com" v-bind="componentField" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel class="text-[#080b67]">Contrasena</FormLabel>
          <FormControl>
            <div class="relative">
              <KeyRound class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7383a1]" />
              <Input class="h-12 rounded-md border-[#cfd9ec] bg-white px-14 text-base shadow-none placeholder:text-[#71809b] focus-visible:ring-[#2568ff]" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Minimo 8 caracteres" v-bind="componentField" />
              <button class="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#465a7f] hover:bg-[#edf3ff]" type="button" :aria-label="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'" @click="showPassword = !showPassword">
                <EyeOff v-if="showPassword" class="h-5 w-5" />
                <Eye v-else class="h-5 w-5" />
              </button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button class="h-12 w-full bg-[#2568ff] text-base font-bold shadow-[0_14px_28px_rgba(37,104,255,0.28)] hover:bg-[#1558ef]" type="submit" :disabled="isSubmitting || loginMutation.isPending.value">
        <Loader2 v-if="isSubmitting || loginMutation.isPending.value" class="mr-2 h-4 w-4 animate-spin" />
        Continuar
      </Button>

    </Form>

    <div class="rounded-md border border-[#dce6f8] bg-[#f7fbff] p-4">
      <div class="flex items-start gap-3">
        <ShieldCheck class="mt-1 h-7 w-7 text-[#0f5cff]" />
        <div>
          <p class="text-base leading-7 text-[#182253]">
            Tu inicio de sesion usa OAuth2/OIDC con cookies HttpOnly y puede requerir MFA.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
