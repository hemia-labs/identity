<script setup lang="ts">
import { MailCheck } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <AuthLayout eyebrow="Verificacion" title="Revisa tu correo" description="Confirma tu cuenta para completar el registro.">
    <div class="rounded-lg border p-5 text-center">
      <MailCheck class="mx-auto h-10 w-10 text-emerald-600" />
      <p class="mt-4 text-sm text-muted-foreground">Enviamos un enlace de verificacion. Si ya confirmaste, puedes entrar.</p>
      <Button as-child class="mt-5 w-full">
        <RouterLink to="/login">Ir a login</RouterLink>
      </Button>
    </div>
  </AuthLayout>
</template>
