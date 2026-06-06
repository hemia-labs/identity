<script setup lang="ts">
import { Building2, CheckCircle2, Fingerprint, ShieldCheck } from 'lucide-vue-next'

defineProps<{
  eyebrow: string
  title: string
  description: string
}>()
</script>

<template>
  <main class="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.55)_100%)]">
    <section class="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      <aside class="relative hidden overflow-hidden border-r lg:block">
        <img
          alt=""
          class="absolute inset-0 h-full w-full object-cover object-center"
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85"
        >
        <div class="absolute inset-0 bg-zinc-950/58" />
        <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.82),rgba(2,6,23,0.38)_48%,rgba(2,6,23,0.66))]" />

        <div class="relative flex min-h-screen max-w-5xl flex-col justify-between px-10 py-10 text-white xl:px-16 2xl:px-20">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur">
              <Fingerprint class="h-5 w-5" />
            </div>
            <div>
              <p class="text-sm font-semibold">Hemia ID</p>
              <p class="text-xs text-white/65">Identity gateway</p>
            </div>
          </div>

          <div class="max-w-xl">
            <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <ShieldCheck class="h-3.5 w-3.5" />
              MFA · multi-cuenta · consentimiento
            </div>
            <h1 class="mt-6 text-4xl font-semibold leading-tight xl:text-5xl">
              Acceso central para cada cuenta, organizacion y app.
            </h1>
            <p class="mt-5 max-w-lg text-sm leading-6 text-white/72">
              Hemia ID concentra autenticacion, seleccion de contexto y permisos antes de abrir Hemia Console.
            </p>
          </div>

          <div class="grid max-w-2xl grid-cols-3 gap-3">
            <div class="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <ShieldCheck class="h-5 w-5 text-emerald-300" />
              <p class="mt-3 text-sm font-medium">Sesion protegida</p>
            </div>
            <div class="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <Building2 class="h-5 w-5 text-sky-300" />
              <p class="mt-3 text-sm font-medium">Org selector</p>
            </div>
            <div class="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
              <CheckCircle2 class="h-5 w-5 text-teal-300" />
              <p class="mt-3 text-sm font-medium">Scopes claros</p>
            </div>
          </div>
        </div>
      </aside>

      <div class="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
        <div class="w-full max-w-[440px]">
          <div class="mb-8 flex items-center gap-3 lg:hidden">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg border bg-card">
              <Fingerprint class="h-5 w-5" />
            </div>
            <div>
              <p class="text-sm font-semibold">Hemia ID</p>
              <p class="text-xs text-muted-foreground">Identity gateway</p>
            </div>
          </div>

          <div class="rounded-lg border bg-card/92 p-5 shadow-sm sm:p-7">
            <div class="mb-6">
              <p class="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck class="h-3.5 w-3.5" />
                {{ eyebrow }}
              </p>
              <h2 class="mt-4 text-2xl font-semibold tracking-tight">{{ title }}</h2>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ description }}</p>
            </div>
            <slot />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
