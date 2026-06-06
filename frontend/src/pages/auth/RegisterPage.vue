<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import RegisterForm from '@/features/auth/components/RegisterForm.vue'
</script>

<template>
  <AuthLayout eyebrow="Registro" title="Crea tu identidad Hemia" description="Prepara tu cuenta para acceso seguro a organizaciones y aplicaciones.">
    <RegisterForm />
    <p class="mt-5 text-center text-sm text-muted-foreground">
      Ya tienes cuenta?
      <RouterLink to="/login" class="font-medium text-foreground">Entrar</RouterLink>
    </p>
  </AuthLayout>
</template>
