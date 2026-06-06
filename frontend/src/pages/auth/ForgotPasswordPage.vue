<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import ForgotPasswordForm from '@/features/auth/components/ForgotPasswordForm.vue'
</script>

<template>
  <AuthLayout eyebrow="Recuperacion" title="Recupera acceso" description="Te enviaremos instrucciones para restablecer tu password.">
    <ForgotPasswordForm />
    <RouterLink to="/login" class="mt-5 block text-center text-sm font-medium">Volver a login</RouterLink>
  </AuthLayout>
</template>
