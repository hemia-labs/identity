<script setup lang="ts">
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import ResetPasswordForm from '@/features/auth/components/ResetPasswordForm.vue'
</script>

<template>
  <AuthLayout eyebrow="Nuevo password" title="Actualiza tus credenciales" description="Ingresa el token recibido y define un nuevo password.">
    <ResetPasswordForm />
  </AuthLayout>
</template>
