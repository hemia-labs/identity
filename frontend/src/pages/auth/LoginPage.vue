<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import LoginForm from '@/features/auth/components/LoginForm.vue'
</script>

<template>
  <AuthLayout eyebrow="Acceso seguro" title="Inicia sesion en Hemia ID" description="Accede con tu cuenta de trabajo para continuar a tu organizacion y aplicaciones.">
    <LoginForm />
    <div class="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm font-bold text-[#0f5cff]">
      <RouterLink to="/forgot-password" class="hover:text-[#080b67]">¿Olvidaste tu contrasena?</RouterLink>
      <div class="flex items-center gap-4">
        <a href="/aviso-de-privacidad" class="hover:text-[#080b67]">Privacidad</a>
        <span class="text-[#93a2bd]">·</span>
        <a href="/terminos-y-condiciones" class="hover:text-[#080b67]">Terminos</a>
      </div>
    </div>
  </AuthLayout>
</template>
