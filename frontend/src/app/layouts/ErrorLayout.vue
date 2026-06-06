<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-4">
    <section class="w-full max-w-md text-center">
      <p class="text-sm font-medium text-muted-foreground">Hemia ID</p>
      <h1 class="mt-3 text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p class="mt-3 text-sm leading-6 text-muted-foreground">{{ description }}</p>
      <Button as-child class="mt-8">
        <RouterLink to="/login">Volver a entrar</RouterLink>
      </Button>
    </section>
  </main>
</template>
