<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import LoginForm from '@/features/auth/components/LoginForm.vue'
</script>

<template>
  <AuthLayout eyebrow="Acceso seguro" title="Entra a Hemia ID" description="Continua a tu cuenta, organizacion y autorizacion de Console.">
    <LoginForm />
    <div class="mt-5 flex items-center justify-between text-sm">
      <RouterLink to="/forgot-password" class="text-muted-foreground hover:text-foreground">Olvide password</RouterLink>
      <RouterLink to="/register" class="font-medium">Crear cuenta</RouterLink>
    </div>
  </AuthLayout>
</template>
