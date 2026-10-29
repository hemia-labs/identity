<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { startGoogleLogin } from '@/features/auth/google-login'
import { fetchJson, getErrorMessage } from '@/lib/api'
import { getSession } from '@/features/identity/api/identity.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()
const invitation = ref<{ email: string; organization: string; expiresAt: string } | null>(null)
const sessionEmail = ref<string | null>(null)
const loading = ref(true)
const pending = ref(false)
const error = ref<string | null>(null)
const accepted = ref(false)
const initialToken = ref<string | null>(null)
const terms = ref(false)

function invitationError(e: unknown) {
  const status = (e as { status?: number })?.status
  if (status === 400) return 'La invitación no es válida, venció o ya fue utilizada. Solicita un nuevo enlace.'
  if (status === 409) return 'Este correo ya tiene una cuenta. Inicia sesión con tu método habitual.'
  if (status === 401 || status === 403) return 'Inicia sesión con la cuenta que recibió la invitación.'
  if (status === 429) return 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
  if (status && status >= 500) return 'El servicio de invitaciones no está disponible. Intenta más tarde.'
  return getErrorMessage(e)
}

async function load() {
  loading.value = true
  error.value = null
  initialToken.value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? initialToken.value
  // The token is exchanged for an HttpOnly cookie; never put it in browser storage.
  window.history.replaceState(null, '', window.location.pathname)
  try {
    invitation.value = await fetchJson('/auth/invitations/preview', { method: 'POST', body: initialToken.value ? { token: initialToken.value } : {} })
    initialToken.value = null
    try { const session = await getSession(); sessionEmail.value = session.user.email; auth.markAuthenticated(session.sessionId) }
    catch { sessionEmail.value = null; auth.clearSession() }
  } catch (e) { error.value = invitationError(e) }
  finally { loading.value = false }
}
onMounted(load)

async function accept() {
  pending.value = true
  error.value = null
  try {
    const result = await fetchJson<{ redirect_url: string }>('/auth/invitations/accept', { method: 'POST', body: {} })
    accepted.value = true
    window.location.assign(result.redirect_url)
  } catch (e) { error.value = invitationError(e) }
  finally { pending.value = false }
}

function googleLogin() {
  try {
    startGoogleLogin('/invitations')
  } catch {
    error.value = 'No se pudo iniciar Google. Habilita el almacenamiento del navegador e intenta de nuevo.'
  }
}
</script>

<template>
  <AuthLayout eyebrow="Invitación" title="Únete a Hemia" description="Continúa con Google para aceptar la invitación a tu organización.">
    <div class="space-y-5">
      <p v-if="loading" role="status">Verificando invitación…</p>
      <Alert v-if="error" variant="destructive"><AlertDescription>{{ error }}</AlertDescription></Alert>
      <template v-if="accepted">
        <p role="status">Ya formas parte de {{ invitation?.organization }}.</p>
        <Button class="w-full" @click="router.push('/session')">Ver mi sesión</Button>
      </template>
      <template v-else-if="invitation && !loading">
        <p>Invitación a <strong>{{ invitation.organization }}</strong> para <strong>{{ invitation.email }}</strong>.</p>
        <template v-if="sessionEmail">
          <p v-if="sessionEmail !== invitation.email">Tu sesión usa {{ sessionEmail }}. Inicia sesión con el correo invitado.</p>
          <Button v-else class="w-full" :disabled="pending" @click="accept">{{ pending ? 'Aceptando…' : 'Aceptar invitación' }}</Button>
          <Button as-child variant="outline" class="w-full"><RouterLink :to="{ path: '/login', query: { returnTo: '/invitations' } }">Usar otra cuenta</RouterLink></Button>
        </template>
        <template v-else>
          <p>Usa la cuenta de Google con el correo invitado. Obtendremos tu nombre y apellidos de Google.</p>
          <label class="flex gap-2"><input v-model="terms" type="checkbox" />Acepto los <a href="/terminos-y-condiciones" target="_blank" rel="noopener">términos</a> y el <a href="/aviso-de-privacidad" target="_blank" rel="noopener">aviso de privacidad</a>.</label>
          <Button class="w-full" :disabled="!terms" @click="googleLogin">Continuar con Google</Button>
          <Button as-child variant="outline" class="w-full"><RouterLink :to="{ path: '/login', query: { returnTo: '/invitations' } }">Acceder con contraseña</RouterLink></Button>
        </template>
      </template>
      <Button v-if="error && !invitation" variant="outline" @click="load">Reintentar</Button>
    </div>
  </AuthLayout>
</template>
