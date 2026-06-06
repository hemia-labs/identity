<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <main class="min-h-screen bg-background">
    <header class="border-b">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <RouterLink to="/login" class="text-sm font-semibold">Hemia ID</RouterLink>
        <RouterLink
          to="/logout"
          class="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut class="h-4 w-4" />
          Salir
        </RouterLink>
      </div>
    </header>

    <section class="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div class="max-w-2xl">
        <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ description }}</p>
      </div>
      <div class="mt-8">
        <slot />
      </div>
    </section>
  </main>
</template>
