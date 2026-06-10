<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import logoIcon from '@/assets/logo.png'
import logoWordmark from '@/assets/logo.svg'

defineProps<{
  title: string
  description: string
  compact?: boolean
}>()
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-[#f7faff]">
    <header class="relative z-10 bg-[#080b67] text-white shadow-[0_12px_38px_rgba(8,11,103,0.16)]">
      <div class="mx-auto flex h-[92px] max-w-7xl items-center justify-between px-6 lg:px-11">
        <RouterLink to="/login" class="inline-flex items-center gap-3 text-xl font-bold text-white sm:text-[23px]">
          <img :src="logoIcon" alt="Hemia" class="h-10 w-10 object-contain brightness-0 invert sm:h-11 sm:w-11">
          <img :src="logoWordmark" alt="HEMIA ID" class="h-9 w-auto object-contain brightness-0 invert sm:h-10">
        </RouterLink>
        <RouterLink
          to="/logout"
          class="inline-flex h-12 items-center gap-3 rounded-md px-3 text-lg font-semibold text-white/92 hover:bg-white/10 sm:text-xl"
        >
          <LogOut class="h-6 w-6" />
          Salir
        </RouterLink>
      </div>
    </header>

    <div class="pointer-events-none absolute right-[-130px] top-[72px] h-[520px] w-[520px] rounded-full border border-[#dce6f8]" />
    <div class="pointer-events-none absolute right-[-65px] top-[128px] h-[390px] w-[390px] rounded-full border border-[#dce6f8]" />
    <div class="pointer-events-none absolute right-[8px] top-[198px] h-[245px] w-[245px] rounded-full border border-[#dce6f8]" />
    <div class="pointer-events-none absolute bottom-[-160px] left-[-160px] h-[340px] w-[340px] rounded-full border border-[#dce6f8]" />
    <div class="pointer-events-none absolute bottom-[-80px] left-[-80px] h-[190px] w-[190px] rounded-full border border-[#dce6f8]" />
    <div class="pointer-events-none absolute right-24 top-56 h-1.5 w-1.5 rounded-full bg-[#b8c9ff] shadow-[-150px_80px_0_#d4defc,140px_120px_0_#c2d2ff,-230px_210px_0_#d4defc]" />
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(47,109,246,0.08),transparent_28%),radial-gradient(circle_at_80%_74%,rgba(47,109,246,0.05),transparent_32%)]" />

    <section :class="['relative z-10 mx-auto w-full max-w-7xl px-6 py-14 lg:px-11 lg:py-20', compact && '!py-8 lg:!py-10']">
      <div class="max-w-3xl">
        <p class="border-l-[3px] border-[#2568ff] pl-5 text-xl font-bold text-[#080b67]">SSO Hemia</p>
        <h1 :class="['mt-8 text-[44px] font-bold leading-tight tracking-normal text-[#080b67] sm:mt-9 sm:text-[56px]', compact && '!mt-3 sm:!mt-3 !text-[28px] sm:!text-[34px]']">{{ title }}</h1>
        <p :class="['mt-6 text-xl leading-8 text-[#5b6d94] sm:text-2xl', compact && '!mt-2 !text-base sm:!text-lg !leading-6']">{{ description }}</p>
      </div>
      <div :class="['mt-12 sm:mt-14', compact && '!mt-6 sm:!mt-7']">
        <slot />
      </div>
    </section>
  </main>
</template>
