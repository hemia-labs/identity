<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import ErrorLayout from '@/app/layouts/ErrorLayout.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useLogoutMutation } from '@/features/identity/composables/useIdentityApi'

const authStore = useAuthStore()
const logoutMutation = useLogoutMutation()

onMounted(() => {
  void logoutMutation.mutateAsync().catch(() => undefined)
  authStore.clearSession()
})
</script>

<template>
  <ErrorLayout title="Sesion cerrada" description="Tu sesion local fue limpiada para esta maqueta.">
    <Button as-child>
      <RouterLink to="/login">Entrar otra vez</RouterLink>
    </Button>
  </ErrorLayout>
</template>
