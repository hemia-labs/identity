<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { consumeGoogleReturnTo } from '@/features/auth/google-login'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getSession } from '@/features/identity/api/identity.api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const errorMessage = ref<string | null>(null)
const returnTo = ref<string | null>(null)

onMounted(async () => {
  authStore.clearSession()
  try {
    returnTo.value = consumeGoogleReturnTo()
    if (route.query.error) {
      errorMessage.value = route.query.error === 'account_link_required'
        ? 'Este correo ya tiene una cuenta en Hemia ID. Inicia sesión con tu método habitual; Google aún no está vinculado.'
        : 'No se pudo completar el inicio de sesión con Google. Intenta de nuevo.'
      return
    }
    const session = await getSession()
    authStore.markAuthenticated(session.sessionId)
    await router.replace(returnTo.value === '/invitations' ? '/invitations' : returnTo.value
      ? { path: '/consent', query: { returnTo: returnTo.value } }
      : '/session')
  } catch {
    errorMessage.value = 'No se pudo verificar tu sesión. Intenta iniciar sesión de nuevo.'
  }
})
</script>

<template>
  <AuthLayout eyebrow="Acceso seguro" title="Iniciar sesión con Google" :description="errorMessage ? 'Vuelve al formulario para continuar.' : 'Estamos verificando tu sesión en Hemia ID.'">
    <div v-if="errorMessage" class="space-y-6">
      <Alert variant="destructive"><AlertDescription>{{ errorMessage }}</AlertDescription></Alert>
      <Button as-child class="w-full">
        <RouterLink :to="{ path: '/login', query: returnTo ? { returnTo } : {} }">Volver a iniciar sesión</RouterLink>
      </Button>
    </div>
    <p v-else role="status" aria-live="polite">Verificando sesión…</p>
  </AuthLayout>
</template>
