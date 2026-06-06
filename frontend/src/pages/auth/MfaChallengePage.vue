<script setup lang="ts">
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import MfaCodeForm from '@/features/auth/components/MfaCodeForm.vue'
</script>

<template>
  <AuthLayout eyebrow="MFA" title="Valida tu sesion" description="Ingresa el codigo de 6 digitos de tu app autenticadora o correo.">
    <MfaCodeForm />
  </AuthLayout>
</template>
