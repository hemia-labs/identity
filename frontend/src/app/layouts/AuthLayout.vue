<script setup lang="ts">
import { Fingerprint, Link2, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import logoIcon from '@/assets/logo.png'
import logoText from '@/assets/logo.svg'

defineProps<{
  eyebrow: string
  title: string
  description: string
}>()
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-[#f7faff]">
    <section class="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      <aside class="relative hidden overflow-hidden bg-[#080b67] lg:block">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_85%_100%,#285cff_0%,rgba(40,92,255,0.55)_18%,rgba(8,11,103,0)_42%),linear-gradient(145deg,#070850_0%,#0c1175_55%,#071064_100%)]" />
        <div class="absolute left-[-130px] top-[-120px] h-[760px] w-[760px] rounded-full border border-white/8" />
        <div class="absolute left-[-60px] top-[-50px] h-[610px] w-[610px] rounded-full border border-white/8" />
        <div class="absolute left-[20px] top-[35px] h-[450px] w-[450px] rounded-full border border-white/8" />
        <div class="absolute left-[115px] top-[135px] h-[255px] w-[255px] rounded-full border border-white/8" />
        <div class="absolute bottom-[-210px] right-[-210px] h-[660px] w-[660px] rounded-full border border-[#4f73ff]/35" />
        <div class="absolute bottom-[-115px] right-[-120px] h-[470px] w-[470px] rounded-full border border-[#6d8dff]/25" />
        <div class="absolute bottom-20 right-24 h-2 w-2 rounded-full bg-[#315dff] shadow-[80px_90px_0_rgba(49,93,255,0.8),145px_170px_0_rgba(103,198,255,0.45),-70px_-140px_0_rgba(103,198,255,0.22)]" />

        <div class="relative flex min-h-screen max-w-3xl flex-col justify-between px-10 py-12 text-white xl:px-16 2xl:px-20">
          <div class="flex items-center gap-4">
            <img :src="logoIcon" alt="Hemia" class="h-[72px] w-[72px] object-contain">
            <img :src="logoText" alt="Hemia Technologies" class="h-16 w-auto max-w-[240px] object-contain brightness-0 invert">
          </div>

          <div class="max-w-lg">
            <h1 class="text-[38px] font-bold leading-tight xl:text-[44px]">
              Acceso unificado para aplicaciones y equipos Hemia
            </h1>
            <div class="mt-8 h-1 w-14 rounded-full bg-[#2568ff]" />
            <p class="mt-8 max-w-md text-[17px] leading-8 text-white/80">
              Una experiencia segura y centralizada para tu organizacion.
            </p>

            <div class="mt-14 space-y-7">
              <div class="grid grid-cols-[64px_1fr] items-start gap-5">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#2530bd] shadow-[0_15px_34px_rgba(47,109,246,0.38)]">
                  <LockKeyhole class="h-7 w-7" />
                </div>
                <div class="border-b border-white/10 pb-5">
                  <p class="font-bold text-white">Autenticacion centralizada</p>
                  <p class="mt-2 max-w-sm text-sm leading-6 text-white/68">
                    Gestiona identidades y accesos desde un solo lugar.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-[64px_1fr] items-start gap-5">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#2530bd] shadow-[0_15px_34px_rgba(47,109,246,0.32)]">
                  <Link2 class="h-7 w-7" />
                </div>
                <div class="border-b border-white/10 pb-5">
                  <p class="font-bold text-white">SSO y OAuth para aplicaciones Hemia</p>
                  <p class="mt-2 max-w-sm text-sm leading-6 text-white/68">
                    Conectate de forma segura a todas tus aplicaciones empresariales.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-[64px_1fr] items-start gap-5">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#2530bd] shadow-[0_15px_34px_rgba(47,109,246,0.32)]">
                  <Fingerprint class="h-7 w-7" />
                </div>
                <div>
                  <p class="font-bold text-white">MFA y control de acceso</p>
                  <p class="mt-2 max-w-sm text-sm leading-6 text-white/68">
                    Proteccion avanzada con verificacion en multiples factores y politicas de acceso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="pb-4">
            <div class="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-[#6be7aa]">
              <ShieldCheck class="h-5 w-5" />
              Plataforma segura y confiable
            </div>
          </div>
        </div>
      </aside>

      <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fbfdff] px-4 py-8 sm:px-8">
        <div class="absolute right-0 top-0 hidden h-64 w-64 bg-[radial-gradient(#d2dcf2_1px,transparent_1px)] [background-size:14px_14px] lg:block" />
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_8%_100%,rgba(47,109,246,0.06),transparent_34%)]" />

        <div class="relative w-full max-w-[620px]">
          <div class="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <img :src="logoIcon" alt="Hemia" class="h-12 w-12 object-contain">
            <img :src="logoText" alt="Hemia Technologies" class="h-10 w-auto max-w-[190px] object-contain">
          </div>

          <div class="rounded-[18px] border border-[#d8e2f2] bg-white/92 px-5 py-8 shadow-[0_24px_70px_rgba(20,21,111,0.11)] backdrop-blur sm:px-12 sm:py-11">
            <div class="mb-8 text-center">
              <p class="inline-flex items-center gap-2 rounded-full bg-[#edf3ff] px-4 py-2 text-xs font-bold uppercase text-[#0f5cff]">
                <ShieldCheck class="h-3.5 w-3.5" />
                {{ eyebrow }}
              </p>
              <h2 class="mt-6 text-3xl font-bold tracking-normal text-[#080b67] sm:text-[34px]">{{ title }}</h2>
              <p class="mx-auto mt-4 max-w-[420px] text-base leading-7 text-[#52627f]">{{ description }}</p>
            </div>
            <slot />
          </div>

          <div class="mt-7 text-center text-sm text-[#52627f]">
            <p class="inline-flex items-center gap-2 font-medium">
              <LockKeyhole class="h-4 w-4 text-[#32b47a]" />
              Sesion protegida
            </p>
            <p class="mt-1">Tus datos estan cifrados y protegidos</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
